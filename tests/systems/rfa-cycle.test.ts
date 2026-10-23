import { describe, expect, it } from "vitest";
import { addCalendarDays } from "@/domain/calendar-date";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import type { PlayerId, TeamId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import { validateGameState } from "@/persistence/validate-game-state";
import { createInitialGameState } from "@/state/create-initial-state";
import type { GameState } from "@/state/game-state";
import { setActivePhase } from "@/systems/phase-engine";
import {
  declineRfaOfferSheet,
  decideCpuRfaMatches,
  expireRfaOfferSheets,
  getOfferSheetBlockReason,
  careerServiceYears,
  isRestrictedEligible,
  issueQualifyingOffer,
  matchRfaOfferSheet,
  pendingOutgoingSheets,
  resolveQualifyingOffersAtFreeAgencyClose,
  submitRfaOfferSheet,
} from "@/systems/rfa";
import { getLeagueSalaryCap } from "@/systems/league-salary-cap";
import {
  processOffseasonLifecycle,
  processPhaseEnter,
  processPhaseExit,
} from "@/systems/simulation/offseason-lifecycle";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { getContractSigningYear, getTeamCapSpace } from "@/systems/salary-cap";
import { RFA_MATCH_WINDOW_DAYS } from "@/systems/league-rules/invariants";

type Fixture = {
  state: GameState;
  ownerTeamId: TeamId;
  cpuTeamId: TeamId;
  otherTeamId: TeamId;
  ownerRfa: PlayerId;
  cpuRfa: PlayerId;
};

/**
 * Offseason after season Y with one young expiring player on the owner team
 * and one on a CPU team (both good enough to qualify), entering roster
 * decisions. Overall 72: below the CPU extension floor (80), above the
 * qualifying-offer bar.
 */
function fixture(settings = CBL_GAME_SETTINGS, seed = 51): Fixture {
  const initial = createInitialGameState({
    saveId: `rfa_${seed}`,
    rngSeed: seed,
    settings,
  });
  let state = bootstrapWorld(
    initial,
    createSeededRng(initial.meta.rngState),
  ).state;
  const year = state.competition.season.year;
  const ownerTeamId = state.user.activeOwnerTeamId;
  const others = (Object.keys(state.world.teams) as TeamId[])
    .filter((id) => id !== ownerTeamId)
    .sort();
  const cpuTeamId = others[0]!;
  const otherTeamId = others[1]!;

  const youngExpiring = (teamId: TeamId): PlayerId => {
    const playerId = state.world.teams[teamId]!.roster.find(
      (id) => state.world.players[id]?.contractId != null,
    )!;
    const player = state.world.players[playerId]!;
    const contractId = player.contractId!;
    const attributes = Object.fromEntries(
      Object.keys(player.attributes).map((key) => [key, 72]),
    ) as typeof player.attributes;
    state = {
      ...state,
      world: {
        ...state.world,
        players: {
          ...state.world.players,
          [playerId]: { ...player, age: 21, attributes },
        },
      },
      business: {
        ...state.business,
        contracts: {
          ...state.business.contracts,
          [contractId]: {
            id: contractId,
            playerId,
            teamId,
            startYear: year - 1,
            endYear: year,
            salaryByYear: {
              [String(year - 1)]: 2_000_000,
              [String(year)]: 2_000_000,
            },
          },
        },
      },
    };
    return playerId;
  };
  const ownerRfa = youngExpiring(ownerTeamId);
  const cpuRfa = youngExpiring(cpuTeamId);
  state = setActivePhase(state, "offseason.roster_decisions");
  state = processPhaseEnter(state, "offseason.roster_decisions").state;
  return { state, ownerTeamId, cpuTeamId, otherTeamId, ownerRfa, cpuRfa };
}

function toFreeAgency(state: GameState): GameState {
  const exited = processPhaseExit(state, "offseason.roster_decisions").state;
  return setActivePhase(exited, "offseason.free_agency");
}

function sheet(
  state: GameState,
  playerId: PlayerId,
  offeringTeamId: TeamId,
  salary = Math.round(getLeagueSalaryCap(state) * 0.12),
) {
  return submitRfaOfferSheet(state, {
    playerId,
    offeringTeamId,
    salary,
    years: 3,
    contractId: `contract_sheet_${playerId}`,
  });
}

describe("restricted free agency cycle", () => {
  it("classifies expiring young players while their contracts still exist", () => {
    const { state, ownerRfa, cpuRfa, cpuTeamId } = fixture();
    const cpu = state.business.rfaStatuses[cpuRfa]!;
    expect(cpu).toMatchObject({
      originalTeamId: cpuTeamId,
      hasQualifyingOffer: true,
      resolution: "pending_rfa",
    });
    // The owner decides during the phase.
    expect(state.business.rfaStatuses[ownerRfa]).toMatchObject({
      hasQualifyingOffer: false,
      resolution: "unsigned_ufa",
    });
  });

  it("keeps qualified players restricted through free agency", () => {
    const f = fixture();
    let state = issueQualifyingOffer(f.state, f.ownerRfa).state;
    state = toFreeAgency(state);
    expect(state.world.players[f.ownerRfa]!.teamId).toBeNull();
    expect(state.business.rfaStatuses[f.ownerRfa]!.resolution).toBe(
      "pending_rfa",
    );
    expect(() => validateGameState(state)).not.toThrow();
  });

  it("lets the owner match a sheet and keep the player on its terms", () => {
    const f = fixture();
    let state = toFreeAgency(issueQualifyingOffer(f.state, f.ownerRfa).state);
    const signed = sheet(state, f.ownerRfa, f.otherTeamId);
    expect(signed.signed).toBe(true);
    state = signed.result.state;
    expect(state.business.rfaStatuses[f.ownerRfa]!.resolution).toBe(
      "pending_match",
    );
    const matched = matchRfaOfferSheet(state, f.ownerRfa, f.ownerTeamId);
    const player = matched.state.world.players[f.ownerRfa]!;
    expect(player.teamId).toBe(f.ownerTeamId);
    const contract = matched.state.business.contracts[player.contractId!]!;
    expect(contract.endYear - contract.startYear + 1).toBe(3);
    expect(matched.state.business.rfaStatuses[f.ownerRfa]!.resolution).toBe(
      "matched",
    );
    expect(() => validateGameState(matched.state)).not.toThrow();
  });

  it("sends him to the offering team on decline", () => {
    const f = fixture();
    let state = toFreeAgency(issueQualifyingOffer(f.state, f.ownerRfa).state);
    state = sheet(state, f.ownerRfa, f.otherTeamId).result.state;
    const declined = declineRfaOfferSheet(state, f.ownerRfa, f.ownerTeamId);
    expect(declined.state.world.players[f.ownerRfa]!.teamId).toBe(
      f.otherTeamId,
    );
    expect(declined.state.business.rfaStatuses[f.ownerRfa]!.resolution).toBe(
      "signed_elsewhere",
    );
  });

  it("treats an unanswered sheet as declined when the window closes", () => {
    const f = fixture();
    let state = toFreeAgency(issueQualifyingOffer(f.state, f.ownerRfa).state);
    state = sheet(state, f.ownerRfa, f.otherTeamId).result.state;
    state = {
      ...state,
      world: {
        ...state.world,
        calendar: {
          ...state.world.calendar,
          currentDate: addCalendarDays(
            state.world.calendar.currentDate,
            RFA_MATCH_WINDOW_DAYS + 1,
          ),
        },
      },
    };
    const expired = expireRfaOfferSheets(state);
    expect(expired.events.map((e) => e.type)).toContain("RfaOfferSheetExpired");
    expect(expired.state.world.players[f.ownerRfa]!.teamId).toBe(f.otherTeamId);
  });

  it("has CPU teams answer sheets for their players", () => {
    const f = fixture();
    let state = toFreeAgency(f.state);
    state = sheet(state, f.cpuRfa, f.otherTeamId).result.state;
    const decided = decideCpuRfaMatches(state);
    const resolution = decided.state.business.rfaStatuses[f.cpuRfa]!.resolution;
    expect(["matched", "signed_elsewhere"]).toContain(resolution);
    expect(decided.state.world.players[f.cpuRfa]!.teamId).not.toBeNull();
  });

  it("refuses a sheet below the qualifying offer", () => {
    const f = fixture();
    const state = toFreeAgency(f.state);
    expect(() => sheet(state, f.cpuRfa, f.otherTeamId, 1_000_000)).toThrow(
      /qualifying offer/,
    );
  });

  it("returns a restricted free agent with no sheet on his qualifying offer", () => {
    const f = fixture();
    const state = toFreeAgency(f.state);
    const qo = f.state.business.rfaStatuses[f.cpuRfa]!.qualifyingOfferSalary;
    const closed = resolveQualifyingOffersAtFreeAgencyClose(state);
    const player = closed.state.world.players[f.cpuRfa]!;
    expect(player.teamId).toBe(f.cpuTeamId);
    const contract = closed.state.business.contracts[player.contractId!]!;
    expect(contract.startYear).toBe(contract.endYear);
    expect(contract.salaryByYear[String(contract.startYear)]).toBe(qo);
    expect(closed.state.business.rfaStatuses[f.cpuRfa]!.resolution).toBe(
      "accepted_qo",
    );
  });

  it("classifies nobody when the rule is off", () => {
    const f = fixture({
      ...CBL_GAME_SETTINGS,
      offseason: {
        ...CBL_GAME_SETTINGS.offseason,
        restrictedFreeAgency: false,
      },
    });
    expect(f.state.business.rfaStatuses).toEqual({});
    const state = toFreeAgency(f.state);
    expect(state.world.players[f.cpuRfa]!.teamId).toBeNull();
  });
});

describe("restricted eligibility", () => {
  it("is for one qualifying offer early in a career", () => {
    const f = fixture();
    const veteran: GameState = {
      ...f.state,
      world: {
        ...f.state.world,
        players: {
          ...f.state.world.players,
          [f.cpuRfa]: { ...f.state.world.players[f.cpuRfa]!, age: 27 },
        },
      },
    };
    expect(isRestrictedEligible(veteran, f.cpuRfa)).toBe(false);
    const afterQo: GameState = {
      ...f.state,
      business: {
        ...f.state.business,
        rfaStatuses: {
          ...f.state.business.rfaStatuses,
          [f.cpuRfa]: {
            ...f.state.business.rfaStatuses[f.cpuRfa]!,
            resolution: "accepted_qo",
          },
        },
      },
    };
    expect(isRestrictedEligible(afterQo, f.cpuRfa)).toBe(false);
    expect(isRestrictedEligible(f.state, f.cpuRfa)).toBe(true);
  });
});

describe("offer sheet commitments", () => {
  it("count a team's pending sheets against its cap room and roster", () => {
    const f = fixture();
    let state = toFreeAgency(issueQualifyingOffer(f.state, f.ownerRfa).state);
    const cap = getLeagueSalaryCap(state);
    const room = getTeamCapSpace(
      f.otherTeamId,
      getContractSigningYear(state),
      state,
    );
    // One sheet takes nearly all of the team's room...
    const big = Math.max(
      state.business.rfaStatuses[f.cpuRfa]!.qualifyingOfferSalary,
      room - Math.round(cap * 0.01),
    );
    state = sheet(state, f.cpuRfa, f.otherTeamId, big).result.state;
    expect(pendingOutgoingSheets(state, f.otherTeamId).salary).toBe(big);
    // ...so a second sheet no longer fits.
    expect(
      getOfferSheetBlockReason(state, {
        playerId: f.ownerRfa,
        offeringTeamId: f.otherTeamId,
        salary: Math.round(cap * 0.05),
        years: 1,
        contractId: "contract_second_sheet",
      }),
    ).toMatch(/cap space/);
  });
});

describe("career service", () => {
  it("counts a veteran's age when history only covers this league", () => {
    const f = fixture();
    const veteran: GameState = {
      ...f.state,
      world: {
        ...f.state.world,
        players: {
          ...f.state.world.players,
          [f.cpuRfa]: { ...f.state.world.players[f.cpuRfa]!, age: 30 },
        },
      },
    };
    // One season of history in a new league does not make him a youngster.
    expect(careerServiceYears(veteran, f.cpuRfa)).toBeGreaterThanOrEqual(11);
    expect(isRestrictedEligible(veteran, f.cpuRfa)).toBe(false);
  });
});

describe("season transition", () => {
  it("classifies restricted free agents when roster decisions begin on the calendar", () => {
    const f = fixture();
    // Rewind: back in season transition with no classification yet.
    let state: GameState = {
      ...setActivePhase(f.state, "offseason.season_transition"),
      business: { ...f.state.business, rfaStatuses: {} },
    };
    state = {
      ...state,
      competition: {
        ...state.competition,
        season: {
          ...state.competition.season,
          rfaQualificationComplete: false,
        },
      },
    };
    const next = processOffseasonLifecycle(state, createSeededRng(5)).state;
    expect(next.competition.phase.activePhaseId).toBe(
      "offseason.roster_decisions",
    );
    expect(next.business.rfaStatuses[f.ownerRfa]).toBeDefined();
  });
});
