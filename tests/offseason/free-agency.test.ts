/**
 * Free agency, end to end: the pool when Roster Decisions ends, the rules a
 * signing goes through (interest, cap, roster, veteran rights, RFA) and what
 * CPU teams do with a thirty-day window.
 *
 * One league (CBL, 12 teams) is built to Roster Decisions and run through the
 * real engine to free agency. The first offseason's pool is thin and every
 * roster is full, so the free-agency window starts from a stressed copy: each
 * CPU team has lost its three best players to the pool, one team is over its
 * payroll budget and one is over the cap.
 */

import { beforeAll, describe, expect, it } from "vitest";
import type { Contract } from "@/domain/entities/contract";
import { isOpenOffer } from "@/domain/entities/free-agency-offer";
import type { EvaluatePlayerInterest } from "@/domain/free-agency/player-interest";
import { emptyInterestFactors } from "@/domain/free-agency/player-interest";
import {
  asContractId,
  asOfferId,
  type PlayerId,
  type TeamId,
} from "@/domain/ids";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { GameState } from "@/state/game-state";
import { aiPayrollBudget, aiPayrollRoom } from "@/systems/ai-payroll-budget";
import { CPU_RESIGN_ROTATION_SIZE } from "@/systems/contract-extensions";
import {
  acceptOffer,
  answerStandingOffers,
  evaluateInterestAtSalary,
  isFreeAgent,
  listFreeAgents,
  makeOffer,
  negotiateOffer,
  releaseExpiredContracts,
  releasePlayerToFreeAgency,
} from "@/systems/free-agency";
import { FREE_AGENCY_INTEREST_CONFIG } from "@/systems/free-agency-config";
import {
  FREE_AGENT_CLOSING_ASK_SHARE,
  freeAgentAsk,
} from "@/systems/free-agent-market";
import { getLeagueSalaryCap } from "@/systems/league-salary-cap";
import { canPerformAction } from "@/systems/league-rules/action-guards";
import { getActivePhaseId } from "@/systems/phase-engine";
import { AI_FA_MIN_SALARY } from "@/systems/owner-objectives-config";
import { luxuryTaxThreshold } from "@/systems/payroll-rules";
import { finalizeRfaQualification } from "@/systems/rfa";
import { getTeamCapSpace, getTeamPayroll } from "@/systems/salary-cap";
import { isSalaryLowball, vetMinSalary } from "@/systems/salary-scale";
import { TRADE_ROSTER_RULES } from "@/systems/trades-config";
import { aiWillPayTax, aiVeteranRightsRoom } from "@/systems/veteran-rights";
import { TEST_RNG_SEED } from "../helpers/determinism";
import {
  advanceThroughPhase,
  buildOffseasonFixture,
  type OffseasonUserAction,
} from "./driver";
import { assertOffseasonInvariants } from "./invariants";

const SEED = TEST_RNG_SEED;
const MAX_ROSTER = TRADE_ROSTER_RULES.maxRosterSize;

/**
 * "Star": the free-agent tier every team should chase. The stressed pool holds
 * players of 94, 88, 87, 84 and 83. Leftovers of 75 or more may stay unsigned
 * only when no CPU team has a roster spot and the room to pay the closing ask.
 */
const STAR_OVERALL = 75;
/**
 * A CPU team with cap room that is short of a rotation (fewer than this many
 * players) must have been filled by the close. Teams of 13 or 14 may sit out:
 * a cash-preserving team is allowed to stand pat on non-urgent needs.
 */
const URGENT_ROSTER_FLOOR = 13;

type Run = {
  /** State before each simulated day, then the final state. */
  states: GameState[];
  end: GameState;
  events: { type: string; payload: Record<string, unknown> }[];
};

type Setup = {
  year: number;
  /** Roster Decisions, as parked (RFA qualifying offers issued). */
  rdStart: GameState;
  rd: Run;
  /** Players whose contracts end this season, with their team. */
  expiring: Map<PlayerId, TeamId>;
  rfaPlayer: PlayerId;
  rfaTeam: TeamId;
  /** Free agency as it opens, before the stress edits. */
  faOpen: GameState;
  /** The stressed free-agency start. */
  faStart: GameState;
  fa: Run;
  userTeam: TeamId;
  /** Released onto the market by the stress edit, with the team they left. */
  released: Map<PlayerId, TeamId>;
  overBudgetTeam: TeamId;
  overCapTeam: TeamId;
  startPool: PlayerId[];
};

let setup: Setup;

function ovr(state: GameState, playerId: PlayerId): number {
  const player = state.world.players[playerId]!;
  return calculatePlayerOverall(player.position, player.attributes);
}

function cpuTeamIds(state: GameState): TeamId[] {
  return (Object.keys(state.world.teams) as TeamId[])
    .filter((teamId) => !state.user.ownedTeamIds.includes(teamId))
    .sort();
}

function withContract(state: GameState, contract: Contract): GameState {
  return {
    ...state,
    business: {
      ...state.business,
      contracts: { ...state.business.contracts, [contract.id]: contract },
    },
  };
}

function setAttributes(
  state: GameState,
  playerId: PlayerId,
  patch: { age?: number; rating: number },
): GameState {
  const player = state.world.players[playerId]!;
  const attributes = Object.fromEntries(
    Object.keys(player.attributes).map((key) => [key, patch.rating]),
  ) as typeof player.attributes;
  return {
    ...state,
    world: {
      ...state.world,
      players: {
        ...state.world.players,
        [playerId]: { ...player, age: patch.age ?? player.age, attributes },
      },
    },
  };
}

/** Ends the player's contract this season and drops him into the pool. */
function expireAndRelease(state: GameState, playerId: PlayerId): GameState {
  const year = state.competition.season.year;
  const contract =
    state.business.contracts[state.world.players[playerId]!.contractId!]!;
  const salaryByYear = Object.fromEntries(
    Object.entries(contract.salaryByYear).filter(
      ([season]) => Number(season) <= year,
    ),
  );
  const ended = withContract(state, {
    ...contract,
    endYear: year,
    salaryByYear,
  });
  return releasePlayerToFreeAgency(ended, playerId).state;
}

/** Moves a team's next-season payroll by `delta` through its richest deal. */
function shiftPayroll(
  state: GameState,
  teamId: TeamId,
  delta: number,
): GameState {
  const key = String(state.competition.season.year + 1);
  const richest = state.world.teams[teamId]!.roster.map(
    (id) => state.business.contracts[state.world.players[id]!.contractId!]!,
  )
    .filter((contract) => contract.salaryByYear[key] !== undefined)
    .sort((a, b) => b.salaryByYear[key]! - a.salaryByYear[key]!)[0]!;
  return withContract(state, {
    ...richest,
    salaryByYear: {
      ...richest.salaryByYear,
      [key]: richest.salaryByYear[key]! + Math.round(delta),
    },
  });
}

function captureEveryDay(into: GameState[]): OffseasonUserAction[] {
  return Array.from({ length: 80 }, (_, day) => ({
    label: `capture ${day}`,
    onDay: day,
    run: (state) => {
      into.push(state);
      return state;
    },
  }));
}

function runPhase(
  state: GameState,
  phase: Parameters<typeof advanceThroughPhase>[1],
): Run {
  const states: GameState[] = [];
  const result = advanceThroughPhase(state, phase, {
    userActions: captureEveryDay(states),
  });
  states.push(result.state);
  return {
    states,
    end: result.state,
    events: result.events.map((event) => ({
      type: event.type,
      payload: event.payload,
    })),
  };
}

function signingsOf(run: Run): { playerId: PlayerId; teamId: TeamId }[] {
  return run.events
    .filter((event) => event.type === "FreeAgentSigned")
    .map((event) => ({
      playerId: event.payload.playerId as PlayerId,
      teamId: event.payload.teamId as TeamId,
    }));
}

function build(): Setup {
  let state = buildOffseasonFixture({
    seed: SEED,
    phase: "offseason.roster_decisions",
  }).state;
  const year = state.competition.season.year;
  const userTeam = state.user.activeOwnerTeamId;
  const cpuTeams = cpuTeamIds(state);

  // A young player on an expiring deal at a CPU team, qualified at 72; his
  // nine best teammates are stronger so his team does not re-sign him first.
  const rfaTeam = cpuTeams[2]!;
  const rfaPlayer = state.world.teams[rfaTeam]!.roster.find(
    (id) => state.world.players[id]!.contractId != null,
  )!;
  const rfaContract =
    state.business.contracts[state.world.players[rfaPlayer]!.contractId!]!;
  state = setAttributes(state, rfaPlayer, { age: 21, rating: 72 });
  state = withContract(state, {
    ...rfaContract,
    startYear: year - 1,
    endYear: year,
    salaryByYear: {
      [String(year - 1)]: 2_000_000,
      [String(year)]: 2_000_000,
    },
  });
  for (const id of state.world.teams[rfaTeam]!.roster.filter(
    (id) => id !== rfaPlayer,
  ).slice(0, CPU_RESIGN_ROTATION_SIZE)) {
    state = setAttributes(state, id, { rating: 90 });
  }
  state = {
    ...state,
    competition: {
      ...state.competition,
      season: { ...state.competition.season, rfaQualificationComplete: false },
    },
  };
  state = finalizeRfaQualification(state, {
    autoIssueQoForAiTeams: true,
  }).state;
  const rdStart = state;

  const expiring = new Map<PlayerId, TeamId>();
  for (const player of Object.values(state.world.players)) {
    const contract =
      player.contractId === null
        ? undefined
        : state.business.contracts[player.contractId];
    if (
      player.teamId != null &&
      player.retired !== true &&
      contract !== undefined &&
      contract.endYear <= year
    ) {
      expiring.set(player.id, player.teamId);
    }
  }

  const rd = runPhase(state, "offseason.roster_decisions");
  const draftPrep = advanceThroughPhase(rd.end, "offseason.draft_preparation");
  const draft = advanceThroughPhase(draftPrep.state, "offseason.draft");
  const faOpen = draft.state;
  expect(getActivePhaseId(faOpen)).toBe("offseason.free_agency");

  // Stress edits.
  let stressed = faOpen;
  const released = new Map<PlayerId, TeamId>();
  for (const teamId of cpuTeams) {
    const best = [...stressed.world.teams[teamId]!.roster]
      .filter((id) => {
        const contract =
          stressed.business.contracts[stressed.world.players[id]!.contractId!];
        return (
          contract !== undefined &&
          contract.startYear <= year &&
          id !== rfaPlayer
        );
      })
      .sort((a, b) => ovr(stressed, b) - ovr(stressed, a))
      .slice(0, 3);
    for (const id of best) {
      stressed = expireAndRelease(stressed, id);
      released.set(id, teamId);
    }
  }
  const candidates = cpuTeams.filter((id) => id !== rfaTeam);
  const overBudgetTeam = candidates[0]!;
  const overCapTeam = candidates[1]!;
  const budget = aiPayrollBudget(stressed, overBudgetTeam)!;
  stressed = shiftPayroll(
    stressed,
    overBudgetTeam,
    budget + 5_000_000 - getTeamPayroll(overBudgetTeam, year + 1, stressed),
  );
  stressed = shiftPayroll(
    stressed,
    overCapTeam,
    getLeagueSalaryCap(stressed) +
      3_000_000 -
      getTeamPayroll(overCapTeam, year + 1, stressed),
  );

  const fa = runPhase(stressed, "offseason.free_agency");
  return {
    year,
    rdStart,
    rd,
    expiring,
    rfaPlayer,
    rfaTeam,
    faOpen,
    faStart: stressed,
    fa,
    userTeam,
    released,
    overBudgetTeam,
    overCapTeam,
    startPool: listFreeAgents(stressed).playerIds,
  };
}

const alwaysInterested: EvaluatePlayerInterest = (playerId, teamId) => ({
  playerId,
  teamId,
  score: 100,
  interested: true,
  factors: emptyInterestFactors(),
});

function offerTerms(
  state: GameState,
  teamId: TeamId,
  playerId: PlayerId,
  salary: number,
  tag: string,
) {
  const year = state.competition.season.year + 1;
  return {
    id: asOfferId(`offer_${tag}_${playerId}`),
    playerId,
    teamId,
    terms: {
      id: asContractId(`contract_${tag}_${playerId}`),
      playerId,
      teamId,
      startYear: year,
      endYear: year,
      salaryByYear: { [String(year)]: salary },
    },
  };
}

/** Same league, with `teamId` handed to the user. */
function ownedBy(state: GameState, teamId: TeamId): GameState {
  const franchise = state.user.ownedFranchises[state.user.activeOwnerTeamId]!;
  return {
    ...state,
    user: {
      ...state.user,
      activeOwnerTeamId: teamId,
      ownedTeamIds: [teamId],
      ownedFranchises: { [teamId]: franchise },
    },
  };
}

function offerStatus(state: GameState, offerId: string): string | undefined {
  return state.business.freeAgency.offers[offerId]?.status;
}

/** A pool player below replacement level (a vet-min signing). */
function fringePlayer(state: GameState): PlayerId {
  return listFreeAgents(state)
    .playerIds.filter((id) => state.business.rfaStatuses[id] === undefined)
    .sort((a, b) => ovr(state, a) - ovr(state, b))[0]!;
}

function starOf(state: GameState): PlayerId {
  return listFreeAgents(state).playerIds.sort(
    (a, b) => ovr(state, b) - ovr(state, a),
  )[0]!;
}

/** A CPU team with room and a short roster, that the stress edits left alone. */
function roomyTeam(): TeamId {
  return cpuTeamIds(setup.faStart).filter(
    (id) =>
      id !== setup.overBudgetTeam &&
      id !== setup.overCapTeam &&
      id !== setup.rfaTeam &&
      setup.faStart.world.teams[id]!.roster.length < MAX_ROSTER - 1,
  )[0]!;
}

beforeAll(() => {
  setup = build();
}, 120_000);

describe("the pool when Roster Decisions ends", () => {
  it("keeps expiring players on their teams until the phase ends, then pools them", () => {
    const { year, expiring, rd } = setup;
    expect(expiring.size).toBeGreaterThan(10);
    const beforeEnd = rd.states.slice(0, -1);
    expect(beforeEnd.length).toBeGreaterThanOrEqual(1);

    for (const state of beforeEnd) {
      expect(getActivePhaseId(state)).toBe("offseason.roster_decisions");
      for (const [playerId, teamId] of expiring) {
        const player = state.world.players[playerId]!;
        if (player.retired === true) continue;
        // Re-signed players keep a new deal; the rest are still bound to
        // their team on the expired one.
        expect(player.teamId, `${playerId} before the phase ends`).toBe(teamId);
        expect(state.world.teams[teamId]!.roster).toContain(playerId);
      }
    }

    const end = rd.end;
    expect(getActivePhaseId(end)).toBe("offseason.draft_preparation");
    const pooled = new Set(listFreeAgents(end).playerIds);
    let released = 0;
    for (const playerId of expiring.keys()) {
      const player = end.world.players[playerId]!;
      const contract =
        player.contractId === null
          ? undefined
          : end.business.contracts[player.contractId];
      const resigned = contract !== undefined && contract.endYear > year;
      if (player.retired === true) continue;
      if (resigned) {
        expect(pooled.has(playerId)).toBe(false);
        expect(player.teamId).not.toBeNull();
      } else {
        released += 1;
        expect(pooled.has(playerId)).toBe(true);
        expect(player.teamId).toBeNull();
        for (const team of Object.values(end.world.teams)) {
          expect(team.roster).not.toContain(playerId);
        }
      }
    }
    expect(released).toBeGreaterThan(0);
  });

  it("leaves a player re-signed before the release out of the pool", () => {
    const { rdStart, year, expiring } = setup;
    const [playerId, teamId] = [...expiring][0]!;
    const player = rdStart.world.players[playerId]!;
    const contract = rdStart.business.contracts[player.contractId!]!;
    const extended = withContract(rdStart, {
      ...contract,
      endYear: year + 2,
      salaryByYear: {
        ...contract.salaryByYear,
        [String(year + 1)]: contract.salaryByYear[String(year)] ?? 2_000_000,
        [String(year + 2)]: contract.salaryByYear[String(year)] ?? 2_000_000,
      },
    });
    const released = releaseExpiredContracts(extended).state;
    expect(released.world.players[playerId]!.teamId).toBe(teamId);
    expect(released.world.teams[teamId]!.roster).toContain(playerId);
    expect(released.world.players[playerId]!.contractId).toBe(contract.id);
    // Everyone else on an expired deal went to the market.
    const others = [...expiring.keys()].filter((id) => id !== playerId);
    expect(
      others.every(
        (id) =>
          released.world.players[id]!.teamId === null ||
          released.world.players[id]!.retired === true,
      ),
    ).toBe(true);
  });

  it("holds a player with a pending qualifying offer behind the restricted process", () => {
    const { rdStart, faOpen, rfaPlayer, rfaTeam, userTeam, year } = setup;
    expect(rdStart.business.rfaStatuses[rfaPlayer]).toMatchObject({
      originalTeamId: rfaTeam,
      hasQualifyingOffer: true,
      resolution: "pending_rfa",
    });
    // He is in the pool and off every roster, but only an offer sheet reaches him.
    expect(listFreeAgents(faOpen).playerIds).toContain(rfaPlayer);
    expect(faOpen.world.players[rfaPlayer]!.teamId).toBeNull();
    for (const teamId of [userTeam, cpuTeamIds(faOpen)[0]!]) {
      const result = canPerformAction(faOpen, {
        kind: "sign_free_agent",
        playerId: rfaPlayer,
        teamId,
      });
      expect(result.allowed).toBe(false);
      expect(result.violations.map((v) => v.code)).toContain(
        "RFA_REQUIRES_OFFER_SHEET",
      );
    }
    const open = offerTerms(
      faOpen,
      cpuTeamIds(faOpen)[0]!,
      rfaPlayer,
      5_000_000,
      "rfa",
    );
    const offered = makeOffer(faOpen, open).state;
    expect(() =>
      acceptOffer(offered, open.id, { evaluateInterest: alwaysInterested }),
    ).toThrow(/restricted free-agency process/);

    // Through the whole window nobody signs him as an ordinary free agent.
    expect(
      signingsOf(setup.fa).filter((s) => s.playerId === rfaPlayer),
    ).toEqual([]);
    const status = setup.fa.end.business.rfaStatuses[rfaPlayer]!;
    expect(status.seasonYear).toBe(year);
    expect(["pending_rfa", "pending_match"]).not.toContain(status.resolution);
  });
});

describe("interest in an offer", () => {
  it("rises with the money, within the bounds of the money term", () => {
    const { faStart } = setup;
    const star = starOf(faStart);
    const ask = freeAgentAsk(faStart, faStart.world.players[star]!, 1);
    const scoreAt = (teamId: TeamId, share: number) =>
      evaluateInterestAtSalary(
        faStart,
        star,
        teamId,
        Math.round(ask * share),
        1,
      ).score;
    for (const teamId of cpuTeamIds(faStart)) {
      const scores = [0.3, 0.7, 1, 1.2].map((share) => scoreAt(teamId, share));
      for (let index = 1; index < scores.length; index += 1) {
        expect(scores[index]!).toBeGreaterThanOrEqual(scores[index - 1]!);
      }
      expect(scores[3]!).toBeGreaterThan(scores[0]!);
      // The money term is bounded: -40 at the bottom, +20 at the top.
      expect(scores[3]! - scores[0]!).toBeLessThanOrEqual(60.001);
    }
  });

  it("splits into baseline, reputation, money and motivations for every pool player", () => {
    const { faStart } = setup;
    const teamId = cpuTeamIds(faStart)[3]!;
    for (const playerId of listFreeAgents(faStart).playerIds.slice(0, 12)) {
      const interest = evaluateInterestAtSalary(
        faStart,
        playerId,
        teamId,
        null,
      );
      const f = interest.factors;
      const parts =
        FREE_AGENCY_INTEREST_CONFIG.baselineScore +
        f.reputation +
        f.money +
        f.teamQuality +
        f.playingTime +
        f.location +
        f.personality +
        f.coach;
      expect(interest.score).toBeCloseTo(parts, 5);
      expect(interest.interested).toBe(
        interest.score >= FREE_AGENCY_INTEREST_CONFIG.interestThreshold,
      );
      // No offer yet: money is neutral.
      expect(f.money).toBe(0);
    }
  });

  it("declines a lowball from a star and signs him on a better one", () => {
    const { faStart } = setup;
    const star = starOf(faStart);
    const ask = freeAgentAsk(faStart, faStart.world.players[star]!, 1);
    // The CPU team the star likes best at a generous offer.
    const generous = Math.round(ask * 1.2);
    const teamId = cpuTeamIds(faStart)
      .filter(
        (id) =>
          id !== setup.overBudgetTeam &&
          id !== setup.overCapTeam &&
          getTeamCapSpace(id, setup.year + 1, faStart) >= generous &&
          faStart.world.teams[id]!.roster.length < MAX_ROSTER,
      )
      .sort(
        (a, b) =>
          evaluateInterestAtSalary(faStart, star, b, generous, 1).score -
          evaluateInterestAtSalary(faStart, star, a, generous, 1).score,
      )[0]!;
    expect(
      evaluateInterestAtSalary(faStart, star, teamId, generous).interested,
    ).toBe(true);

    const low = offerTerms(faStart, teamId, star, Math.round(ask * 0.3), "low");
    const lowOffered = makeOffer(faStart, low).state;
    expect(negotiateOffer(lowOffered, low.id).state).toSatisfy(
      (state: GameState) => offerStatus(state, low.id) === "rejected",
    );
    const declined = acceptOffer(lowOffered, low.id).state;
    expect(offerStatus(declined, low.id)).toBe("rejected");
    expect(isFreeAgent(declined, star)).toBe(true);
    expect(declined.world.teams[teamId]!.roster).toEqual(
      faStart.world.teams[teamId]!.roster,
    );

    const good = offerTerms(faStart, teamId, star, generous, "good");
    const signed = acceptOffer(makeOffer(faStart, good).state, good.id).state;
    expect(offerStatus(signed, good.id)).toBe("accepted");
    expect(signed.world.players[star]!.teamId).toBe(teamId);
    expect(signed.world.teams[teamId]!.roster).toContain(star);
    expect(isFreeAgent(signed, star)).toBe(false);
  });
});

describe("signing rules are the same for a user team and a CPU team", () => {
  const controls = ["cpu", "user"] as const;

  it.each(controls)(
    "(%s) holds a team to its cap room, except for a vet-min deal",
    (control) => {
      const base = setup.faStart;
      const teamId = roomyTeam();
      const year = setup.year + 1;
      const minimum = vetMinSalary(getLeagueSalaryCap(base));
      // Leave the team half a minimum deal of room.
      const room = getTeamCapSpace(teamId, year, base);
      const tight = shiftPayroll(base, teamId, room - Math.round(minimum / 2));
      const state = control === "user" ? ownedBy(tight, teamId) : tight;
      const [first, second] = listFreeAgents(state)
        .playerIds.filter((id) => state.business.rfaStatuses[id] === undefined)
        .slice(0, 2);

      const above = offerTerms(state, teamId, first!, minimum * 3, "above");
      const rejected = acceptOffer(makeOffer(state, above).state, above.id, {
        evaluateInterest: alwaysInterested,
      });
      expect(offerStatus(rejected.state, above.id)).toBe("withdrawn");
      expect(rejected.events.map((e) => e.type)).toContain(
        "FreeAgencyOfferInvalidated",
      );
      expect(isFreeAgent(rejected.state, first!)).toBe(true);

      const exception = offerTerms(state, teamId, second!, minimum, "min");
      const signed = acceptOffer(
        makeOffer(state, exception).state,
        exception.id,
        { evaluateInterest: alwaysInterested },
      ).state;
      expect(offerStatus(signed, exception.id)).toBe("accepted");
      expect(signed.world.teams[teamId]!.roster).toContain(second);
      // The exception does not make room: the team is still over the cap.
      expect(getTeamCapSpace(teamId, year, signed)).toBeLessThan(0);
    },
  );

  it.each(controls)(
    "(%s) lets a roster of 14 sign one more and blocks a roster of 15",
    (control) => {
      const base = setup.faStart;
      const teamId = roomyTeam();
      const roster = base.world.teams[teamId]!.roster;
      // Fill the team to 14 with players it already has on file.
      const pool = listFreeAgents(base).playerIds.filter(
        (id) => base.business.rfaStatuses[id] === undefined,
      );
      let state = control === "user" ? ownedBy(base, teamId) : base;
      let size = roster.length;
      let index = 0;
      const sign = (playerId: PlayerId) => {
        const offer = offerTerms(
          state,
          teamId,
          playerId,
          vetMinSalary(getLeagueSalaryCap(state)),
          `fill${index}`,
        );
        index += 1;
        return acceptOffer(makeOffer(state, offer).state, offer.id, {
          evaluateInterest: alwaysInterested,
        }).state;
      };
      while (size < MAX_ROSTER - 1) {
        state = sign(pool[index]!);
        size += 1;
      }
      expect(state.world.teams[teamId]!.roster).toHaveLength(MAX_ROSTER - 1);

      state = sign(pool[index]!);
      expect(state.world.teams[teamId]!.roster).toHaveLength(MAX_ROSTER);

      const extra = offerTerms(
        state,
        teamId,
        pool[index]!,
        vetMinSalary(getLeagueSalaryCap(state)),
        "extra",
      );
      const offered = makeOffer(state, extra).state;
      expect(() =>
        acceptOffer(offered, extra.id, { evaluateInterest: alwaysInterested }),
      ).toThrow(/maximum roster size of 15/);
      expect(isFreeAgent(offered, pool[index]!)).toBe(true);
      expect(offered.world.teams[teamId]!.roster).toHaveLength(MAX_ROSTER);
    },
  );

  it("answers an owner's standing offer the way an accepted CPU offer is answered", () => {
    const base = setup.faStart;
    const teamId = roomyTeam();
    const star = starOf(base);
    const fringe = fringePlayer(base);
    for (const playerId of [star, fringe]) {
      const ask = freeAgentAsk(base, base.world.players[playerId]!);
      for (const share of [0.3, 1, 1.2]) {
        const salary = Math.max(
          vetMinSalary(getLeagueSalaryCap(base)),
          Math.round(ask * share),
        );
        const offer = offerTerms(base, teamId, playerId, salary, `std${share}`);
        const cpu = acceptOffer(makeOffer(base, offer).state, offer.id).state;
        const owned = ownedBy(makeOffer(base, offer).state, teamId);
        const user = answerStandingOffers(owned).state;
        const cpuSigned = cpu.world.players[playerId]!.teamId === teamId;
        const userSigned = user.world.players[playerId]!.teamId === teamId;
        expect(userSigned, `${playerId} at ${share}x`).toBe(cpuSigned);
        if (cpuSigned) {
          expect(user.world.players[playerId]!.contractId).toBe(
            cpu.world.players[playerId]!.contractId,
          );
        }
      }
    }
  });

  it("gives the user team and a CPU team the same answer from canPerformAction", () => {
    const { faOpen, rdStart, userTeam } = setup;
    const cpuTeam = cpuTeamIds(faOpen)[0]!;
    const freeAgent = fringePlayer(faOpen);
    for (const kind of ["sign_free_agent", "make_free_agent_offer"] as const) {
      const outcomes = [userTeam, cpuTeam].map((teamId) =>
        canPerformAction(faOpen, { kind, playerId: freeAgent, teamId }),
      );
      expect(outcomes[0]).toEqual(outcomes[1]);
      expect(outcomes[0]!.allowed).toBe(true);

      // Not before free agency opens.
      const early = [userTeam, cpuTeam].map((teamId) =>
        canPerformAction(rdStart, { kind, playerId: freeAgent, teamId }),
      );
      expect(early[0]).toEqual(early[1]);
      expect(early[0]!.violations.map((v) => v.code)).toContain("FA_NOT_OPEN");
    }
  });
});

describe("veteran rights, luxury tax and morale", () => {
  /** A released player with his old team, for rules that depend on both. */
  function formerPair(state: GameState): [PlayerId, TeamId] {
    return [...setup.released].find(
      ([playerId, teamId]) =>
        teamId !== setup.overBudgetTeam &&
        teamId !== setup.overCapTeam &&
        state.business.playerHistory[playerId]?.seasons.at(-1)?.contractSnapshot
          .teamId === teamId &&
        state.world.teams[teamId]!.roster.length < MAX_ROSTER,
    )!;
  }

  it("lets a team re-sign its own player over the cap, and no one else", () => {
    const base = setup.faStart;
    const [playerId, teamId] = formerPair(base);
    const other = cpuTeamIds(base).find(
      (id) =>
        id !== teamId &&
        id !== setup.overBudgetTeam &&
        id !== setup.overCapTeam &&
        base.world.teams[id]!.roster.length < MAX_ROSTER,
    )!;
    const rights = (state: GameState, enabled: boolean): GameState => ({
      ...state,
      settings: {
        ...state.settings,
        financialRules: {
          ...state.settings.financialRules,
          veteranRightsEnabled: enabled,
          veteranRightsSeasons: 1,
        },
      },
    });
    const minimum = vetMinSalary(getLeagueSalaryCap(base));
    const salary = minimum * 4;
    const tryTeam = (state: GameState, signer: TeamId) => {
      const tight = [teamId, other].reduce(
        (current, id) =>
          shiftPayroll(
            current,
            id,
            getTeamCapSpace(id, setup.year + 1, current) -
              Math.round(minimum / 2),
          ),
        state,
      );
      const offer = offerTerms(tight, signer, playerId, salary, "vr");
      return offerStatus(
        acceptOffer(makeOffer(tight, offer).state, offer.id, {
          evaluateInterest: alwaysInterested,
        }).state,
        offer.id,
      );
    };
    expect(tryTeam(rights(base, true), teamId)).toBe("accepted");
    expect(tryTeam(rights(base, true), other)).toBe("withdrawn");
    expect(tryTeam(rights(base, false), teamId)).toBe("withdrawn");
  });

  it("keeps a CPU team's over-the-cap re-signing below the tax line unless it pays tax", () => {
    const { faStart, year } = setup;
    const line = luxuryTaxThreshold(
      faStart.settings,
      getLeagueSalaryCap(faStart),
    );
    expect(faStart.settings.financialRules.luxuryTaxEnabled).toBe(true);
    for (const teamId of cpuTeamIds(faStart)) {
      const payroll = getTeamPayroll(teamId, year + 1, faStart);
      const room = aiVeteranRightsRoom(faStart, teamId, year + 1);
      if (!aiWillPayTax(faStart, teamId)) {
        expect(room, teamId).toBeLessThanOrEqual(line - payroll);
      }
      const budget = aiPayrollBudget(faStart, teamId);
      if (budget !== null) {
        expect(room, teamId).toBeLessThanOrEqual(budget - payroll);
      }
    }
  });

  it("keeps CPU teams that began under the tax line under it", () => {
    const { faStart, fa, year } = setup;
    const line = luxuryTaxThreshold(
      faStart.settings,
      getLeagueSalaryCap(faStart),
    );
    for (const teamId of cpuTeamIds(faStart)) {
      const before = getTeamPayroll(teamId, year + 1, faStart);
      const after = getTeamPayroll(teamId, year + 1, fa.end);
      if (before <= line) {
        expect(after, teamId).toBeLessThanOrEqual(line);
      }
    }
  });

  it("makes an unhappy player less drawn to his old team, and no other", () => {
    const base = setup.faStart;
    // Loyalty only pulls a player who has some, toward the team he left.
    const [playerId, teamId] = [...setup.released].find(
      ([id, team]) =>
        base.world.players[id]!.personality.loyalty >= 30 &&
        base.business.playerHistory[id]?.seasons.at(-1)?.contractSnapshot
          .teamId === team,
    )!;
    const other = cpuTeamIds(base).find((id) => id !== teamId)!;
    const withMorale = (value: number): GameState => ({
      ...base,
      business: {
        ...base.business,
        playerMorale: {
          ...base.business.playerMorale,
          [playerId]: {
            value,
            reason: "settled",
            lowWeeks: 0,
            tradeRequestSeason: null,
            complaintSeason: null,
          },
        },
      },
    });
    const pull = (state: GameState, team: TeamId) =>
      evaluateInterestAtSalary(state, playerId, team, null).factors.personality;
    expect(pull(withMorale(100), teamId)).toBeGreaterThan(
      pull(withMorale(0), teamId),
    );
    expect(pull(withMorale(100), other)).toBe(pull(withMorale(0), other));
  });
});

describe("CPU teams through the free-agency window", () => {
  it("opens with a pool worth chasing and runs for the whole phase", () => {
    const { faStart, fa } = setup;
    expect(getActivePhaseId(faStart)).toBe("offseason.free_agency");
    expect(getActivePhaseId(fa.end)).toBe("offseason.staff_development");
    expect(fa.states.length).toBeGreaterThan(10);
    const stars = setup.startPool.filter(
      (id) => ovr(faStart, id) >= STAR_OVERALL,
    );
    expect(stars.length).toBeGreaterThanOrEqual(10);
    assertOffseasonInvariants(faStart, {
      label: `seed ${SEED}, stressed pool`,
    });
  });

  it("never grows the pool", () => {
    // The league opens with unsigned filler players (ids `player_fa_*`) that
    // were never part of the stressed pool; count only the stressed pool.
    const sizes = setup.fa.states.map(
      (state) =>
        listFreeAgents(state).playerIds.filter(
          (id) => !String(id).startsWith("player_fa_"),
        ).length,
    );
    for (let day = 1; day < sizes.length; day += 1) {
      expect(sizes[day]!, `day ${day}`).toBeLessThanOrEqual(sizes[day - 1]!);
    }
    // AI teams budget staff from contracts (not booked expense), which leaves
    // them less room: about half of this stressed pool, not under half, is
    // signed.
    expect(sizes.at(-1)!).toBeLessThan(sizes[0]! * 0.6);
  });

  it("signs nobody twice and keeps one contract per player", () => {
    const { fa, year } = setup;
    const signings = signingsOf(fa);
    expect(signings.length).toBeGreaterThanOrEqual(20);
    expect(new Set(signings.map((s) => s.playerId)).size).toBe(signings.length);
    const live = new Map<string, number>();
    for (const contract of Object.values(fa.end.business.contracts)) {
      if (contract.endYear < year + 1) continue;
      if (contract.startYear > year + 1) continue;
      const player = fa.end.world.players[contract.playerId];
      if (player?.contractId !== contract.id) continue;
      live.set(contract.playerId, (live.get(contract.playerId) ?? 0) + 1);
    }
    for (const [playerId, count] of live) {
      expect(count, playerId).toBe(1);
    }
    for (const { playerId, teamId } of signings) {
      expect(fa.end.world.players[playerId]!.teamId).toBe(teamId);
    }
  });

  it("signs the best players first", () => {
    const { faStart, fa, startPool } = setup;
    const byOverall = [...startPool].sort(
      (a, b) => ovr(faStart, b) - ovr(faStart, a),
    );
    const stillFree = new Set(listFreeAgents(fa.end).playerIds);
    const top = byOverall.slice(0, 5);
    expect(top.filter((id) => stillFree.has(id))).toEqual([]);
    // Every one of the top five signed before anyone left over is better.
    const leftBest = Math.max(
      ...[...stillFree]
        .filter((id) => startPool.includes(id))
        .map((id) => ovr(faStart, id)),
    );
    expect(Math.min(...top.map((id) => ovr(faStart, id)))).toBeGreaterThan(
      leftBest,
    );

    // The first days clear the market from the top: the players gone by day
    // 3 are better on average than those gone later or never.
    const free3 = new Set(listFreeAgents(fa.states[3]!).playerIds);
    const early = startPool.filter((id) => !free3.has(id));
    const late = startPool.filter((id) => free3.has(id));
    const mean = (ids: PlayerId[]) =>
      ids.reduce((sum, id) => sum + ovr(faStart, id), 0) / ids.length;
    expect(early.length).toBeGreaterThan(10);
    expect(mean(early)).toBeGreaterThan(mean(late));
  });

  it(`leaves no ${STAR_OVERALL}+ star unsigned while a CPU team has room, a spot and a need`, () => {
    const { fa, year } = setup;
    const stars = listFreeAgents(fa.end).playerIds.filter(
      (id) => ovr(fa.end, id) >= STAR_OVERALL,
    );
    for (const playerId of stars) {
      // What a team has to be able to pay at the close: not a lowball.
      const price = freeAgentAsk(
        fa.end,
        fa.end.world.players[playerId]!,
        FREE_AGENT_CLOSING_ASK_SHARE,
      );
      for (const teamId of cpuTeamIds(fa.end)) {
        const roster = fa.end.world.teams[teamId]!.roster.length;
        const room = aiPayrollRoom(fa.end, teamId, year + 1);
        // Teams at 13-14 may stand pat (see URGENT_ROSTER_FLOOR); only a team
        // that needs bodies has to take an affordable star.
        const couldSign =
          roster < URGENT_ROSTER_FLOOR &&
          !isSalaryLowball(Math.min(room, price), price);
        expect(couldSign, `${playerId} unsigned, ${teamId} could sign`).toBe(
          false,
        );
      }
    }
  });

  it("fills a short CPU roster that has the room to sign", () => {
    const { faStart, fa, year } = setup;
    for (const teamId of cpuTeamIds(faStart)) {
      const room = aiPayrollRoom(faStart, teamId, year + 1);
      if (room < AI_FA_MIN_SALARY) continue;
      expect(
        fa.end.world.teams[teamId]!.roster.length,
        teamId,
      ).toBeGreaterThanOrEqual(URGENT_ROSTER_FLOOR);
    }
  });

  it("never takes a CPU roster past the maximum through signings", () => {
    const { faStart, fa } = setup;
    for (const teamId of cpuTeamIds(faStart)) {
      const start = faStart.world.teams[teamId]!.roster.length;
      for (const [day, state] of fa.states.entries()) {
        expect(
          state.world.teams[teamId]!.roster.length,
          `${teamId} day ${day}`,
        ).toBeLessThanOrEqual(Math.max(start, MAX_ROSTER));
      }
    }
  });

  it("holds CPU payroll to the cap and to each team's budget", () => {
    const { faStart, fa, year, overBudgetTeam, overCapTeam } = setup;
    const cap = getLeagueSalaryCap(faStart);
    for (const teamId of cpuTeamIds(faStart)) {
      const before = getTeamPayroll(teamId, year + 1, faStart);
      const after = getTeamPayroll(teamId, year + 1, fa.end);
      expect(after, teamId).toBeLessThanOrEqual(Math.max(before, cap));
    }
    // A team over its budget or the cap signs no one at all.
    const signedBy = (teamId: TeamId) =>
      signingsOf(fa).filter((s) => s.teamId === teamId);
    expect(aiPayrollRoom(faStart, overBudgetTeam, year + 1)).toBeLessThan(
      AI_FA_MIN_SALARY,
    );
    expect(signedBy(overBudgetTeam)).toEqual([]);
    expect(aiPayrollRoom(faStart, overCapTeam, year + 1)).toBeLessThan(
      AI_FA_MIN_SALARY,
    );
    expect(signedBy(overCapTeam)).toEqual([]);
    // Teams that did sign paid within their room: no deal above the cap room
    // they had on the day, and the unsigned offers are all closed.
    for (const offer of Object.values(fa.end.business.freeAgency.offers)) {
      expect(isOpenOffer(offer.status)).toBe(false);
    }
  });

  it("ends with a valid league", () => {
    const { fa, faOpen } = setup;
    assertOffseasonInvariants(fa.end, {
      label: `seed ${SEED}, after free agency`,
      previous: faOpen,
    });
    // And on the way, every tenth day.
    for (const [day, state] of fa.states.entries()) {
      if (day % 10 !== 5) continue;
      assertOffseasonInvariants(state, {
        label: `seed ${SEED}, free agency day ${day}`,
      });
    }
    // The player the pool lost to a team is on that team's roster once.
    const rostered = new Map<PlayerId, TeamId>();
    for (const team of Object.values(fa.end.world.teams)) {
      for (const playerId of team.roster) {
        expect(rostered.has(playerId)).toBe(false);
        rostered.set(playerId, team.id);
      }
    }
  });
});
