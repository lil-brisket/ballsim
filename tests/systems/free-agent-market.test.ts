import { describe, expect, it } from "vitest";
import { addCalendarDays } from "@/domain/calendar-date";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import {
  asContractId,
  asOfferId,
  type PlayerId,
  type TeamId,
} from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import type { GameState } from "@/state/game-state";
import {
  answerStandingOffers,
  defaultEvaluatePlayerInterest,
  makeOffer,
  releasePlayerToFreeAgency,
} from "@/systems/free-agency";
import {
  cpuContractYears,
  FREE_AGENT_CLOSING_ASK_SHARE,
  freeAgentAsk,
  freeAgentAskShare,
  freeAgentMarketSalary,
} from "@/systems/free-agent-market";
import { getLeagueSalaryCap } from "@/systems/league-salary-cap";
import { checkFreeAgencySigning } from "@/systems/league-rules/free-agency-rules";
import { scoreFreeAgentSigning } from "@/systems/ownership-alignment-signals";
import { getContractSigningYear } from "@/systems/salary-cap";
import { vetMinSalary } from "@/systems/salary-scale";
import { transitionPhase } from "@/systems/simulation/phase-machine";
import { bootstrapWorld } from "@/systems/world-pipeline";

function offseason(): GameState {
  const initial = createInitialGameState({
    saveId: "fa_market",
    rngSeed: 33,
    settings: CBL_GAME_SETTINGS,
  });
  let state = bootstrapWorld(
    initial,
    createSeededRng(initial.meta.rngState),
  ).state;
  state = transitionPhase(state, "regular").state;
  state = transitionPhase(state, "postseason").state;
  return transitionPhase(state, "offseason").state;
}

/** Free agency opened `daysAgo` days before today. */
function inFreeAgency(state: GameState, daysAgo: number): GameState {
  return {
    ...state,
    competition: {
      ...state.competition,
      phase: {
        ...state.competition.phase,
        activePhaseId: "offseason.free_agency",
        enteredDate: addCalendarDays(
          state.world.calendar.currentDate,
          -daysAgo,
        ),
      },
    },
  };
}

/** A star (all ratings 95) whose deal just ended, in free agency. */
function withStarFreeAgent(state: GameState): {
  state: GameState;
  playerId: PlayerId;
} {
  const teamId = Object.keys(state.world.teams).sort()[1] as TeamId;
  const playerId = state.world.teams[teamId]!.roster.find(
    (id) => state.world.players[id]?.contractId != null,
  )!;
  const player = state.world.players[playerId]!;
  const contract = state.business.contracts[player.contractId!]!;
  const attributes = Object.fromEntries(
    Object.keys(player.attributes).map((key) => [key, 95]),
  ) as typeof player.attributes;
  const starred: GameState = {
    ...state,
    world: {
      ...state.world,
      players: {
        ...state.world.players,
        [playerId]: { ...player, age: 27, attributes },
      },
    },
    business: {
      ...state.business,
      contracts: {
        ...state.business.contracts,
        [contract.id]: {
          ...contract,
          endYear: state.competition.season.year,
        },
      },
    },
  };
  return {
    state: releasePlayerToFreeAgency(starred, playerId).state,
    playerId,
  };
}

function offerFrom(
  state: GameState,
  playerId: PlayerId,
  salary: number,
  teamId: TeamId = state.user.activeOwnerTeamId,
): { state: GameState; teamId: TeamId } {
  const year = getContractSigningYear(state);
  const salaryByYear: Record<string, number> = {};
  for (let y = year; y < year + 5; y += 1) salaryByYear[String(y)] = salary;
  const offered = makeOffer(state, {
    id: asOfferId("offer_market_test"),
    playerId,
    teamId,
    terms: {
      id: asContractId("contract_market_test"),
      playerId,
      teamId,
      startYear: year,
      endYear: year + 4,
      salaryByYear,
    },
  });
  return { state: offered.state, teamId };
}

describe("free-agent ask", () => {
  it("is his full market salary before free agency opens", () => {
    const base = offseason();
    const state: GameState = {
      ...base,
      competition: {
        ...base.competition,
        phase: {
          ...base.competition.phase,
          activePhaseId: "offseason.roster_decisions",
        },
      },
    };
    expect(freeAgentAskShare(state)).toBe(1);
  });

  it("falls evenly through the window to the closing share", () => {
    const base = offseason();
    const duration = base.settings.offseason.freeAgency.durationDays;
    expect(freeAgentAskShare(inFreeAgency(base, 0))).toBe(1);
    expect(freeAgentAskShare(inFreeAgency(base, duration / 2))).toBeCloseTo(
      (1 + FREE_AGENT_CLOSING_ASK_SHARE) / 2,
    );
    expect(freeAgentAskShare(inFreeAgency(base, duration))).toBe(
      FREE_AGENT_CLOSING_ASK_SHARE,
    );
    expect(freeAgentAskShare(inFreeAgency(base, duration + 10))).toBe(
      FREE_AGENT_CLOSING_ASK_SHARE,
    );
  });

  it("never drops below the veteran minimum", () => {
    const state = offseason();
    const player = Object.values(state.world.players)[0]!;
    const floor = vetMinSalary(getLeagueSalaryCap(state));
    expect(freeAgentAsk(state, player, 0)).toBe(floor);
    expect(freeAgentAsk(state, player, 1)).toBe(
      Math.max(floor, freeAgentMarketSalary(state, player)),
    );
  });
});

describe("offseason offers", () => {
  it("weigh the first-season salary: a star refuses the minimum", () => {
    const { state, playerId } = withStarFreeAgent(inFreeAgency(offseason(), 0));
    const minimum = vetMinSalary(getLeagueSalaryCap(state));
    const low = offerFrom(state, playerId, minimum);
    const lowInterest = defaultEvaluatePlayerInterest(
      playerId,
      low.teamId,
      low.state,
    );
    expect(lowInterest.factors.money).toBeLessThan(0);
    expect(lowInterest.interested).toBe(false);

    const market = offerFrom(
      state,
      playerId,
      freeAgentMarketSalary(state, state.world.players[playerId]!),
    );
    const marketInterest = defaultEvaluatePlayerInterest(
      playerId,
      market.teamId,
      market.state,
    );
    expect(marketInterest.factors.money).toBeGreaterThan(0);
  });

  it("count a late-window offer against his lowered ask", () => {
    const base = withStarFreeAgent(inFreeAgency(offseason(), 0));
    const player = base.state.world.players[base.playerId]!;
    const salary = Math.round(freeAgentMarketSalary(base.state, player) * 0.6);
    const duration = base.state.settings.offseason.freeAgency.durationDays;
    const money = (daysAgo: number) => {
      const offered = offerFrom(
        inFreeAgency(base.state, daysAgo),
        base.playerId,
        salary,
      );
      return defaultEvaluatePlayerInterest(
        base.playerId,
        offered.teamId,
        offered.state,
      ).factors.money;
    };
    expect(money(duration)).toBeGreaterThan(money(0));
  });
});

describe("CPU contract length", () => {
  it("runs longer for better players", () => {
    expect(cpuContractYears(25, 85)).toBe(4);
    expect(cpuContractYears(25, 75)).toBe(3);
    expect(cpuContractYears(25, 68)).toBe(2);
    expect(cpuContractYears(25, 60)).toBe(1);
  });

  it("stops at the end age and is at least one season", () => {
    expect(cpuContractYears(31, 85)).toBe(2);
    expect(cpuContractYears(33, 85)).toBe(1);
    expect(cpuContractYears(37, 90)).toBe(1);
  });
});

describe("standing offers", () => {
  it("are accepted once the offer meets his falling ask", () => {
    const base = withStarFreeAgent(inFreeAgency(offseason(), 0));
    const player = base.state.world.players[base.playerId]!;
    const salary = Math.round(freeAgentMarketSalary(base.state, player) * 0.6);
    // Free a roster spot on the owner's team.
    const ownerId = base.state.user.activeOwnerTeamId;
    const spareId = base.state.world.teams[ownerId]!.roster.at(-1)!;
    const spare = base.state.world.players[spareId]!;
    const roomy = releasePlayerToFreeAgency(
      {
        ...base.state,
        business: {
          ...base.state.business,
          contracts: {
            ...base.state.business.contracts,
            [spare.contractId!]: {
              ...base.state.business.contracts[spare.contractId!]!,
              endYear: base.state.competition.season.year,
            },
          },
        },
      },
      spareId,
    ).state;
    const offered = offerFrom(roomy, base.playerId, salary);

    const early = answerStandingOffers(offered.state).state;
    expect(early.world.players[base.playerId]!.teamId).toBeNull();
    expect(
      early.business.freeAgency.offers[asOfferId("offer_market_test")]!.status,
    ).toBe("pending");

    const late = answerStandingOffers(
      offered.state,
      FREE_AGENT_CLOSING_ASK_SHARE,
    ).state;
    expect(late.world.players[base.playerId]!.teamId).toBe(offered.teamId);
  });
});

describe("standing offers and ownership", () => {
  it("record ownership evidence like a direct signing", () => {
    let state = inFreeAgency(offseason(), 0);
    const ownerId = state.user.activeOwnerTeamId;
    // A bench player whose deal just ended, back on the market.
    const playerId = state.world.teams[ownerId]!.roster.at(-1)!;
    const player = state.world.players[playerId]!;
    state = releasePlayerToFreeAgency(
      {
        ...state,
        world: {
          ...state.world,
          players: {
            ...state.world.players,
            [playerId]: {
              ...player,
              attributes: Object.fromEntries(
                Object.keys(player.attributes).map((key) => [key, 50]),
              ) as typeof player.attributes,
            },
            // Weak teammates, so he would start for the owner.
            ...Object.fromEntries(
              state.world.teams[ownerId]!.roster.filter(
                (id) => id !== playerId,
              ).map((id) => {
                const mate = state.world.players[id]!;
                return [
                  id,
                  {
                    ...mate,
                    attributes: Object.fromEntries(
                      Object.keys(mate.attributes).map((key) => [key, 35]),
                    ) as typeof mate.attributes,
                  },
                ];
              }),
            ),
          },
        },
        business: {
          ...state.business,
          contracts: {
            ...state.business.contracts,
            [player.contractId!]: {
              ...state.business.contracts[player.contractId!]!,
              endYear: state.competition.season.year,
            },
          },
        },
      },
      playerId,
    ).state;
    // A low-commitment deal, comfortably above his ask.
    const salary = 2_000_000;
    const year = getContractSigningYear(state);
    const offered = makeOffer(state, {
      id: asOfferId("offer_evidence_test"),
      playerId,
      teamId: ownerId,
      terms: {
        id: asContractId("contract_evidence_test"),
        playerId,
        teamId: ownerId,
        startYear: year,
        endYear: year,
        salaryByYear: { [String(year)]: salary },
      },
    }).state;
    const evidence = scoreFreeAgentSigning(offered, playerId, salary, 1);
    expect(evidence).not.toBeNull();

    const signed = answerStandingOffers(offered).state;
    expect(signed.world.players[playerId]!.teamId).toBe(ownerId);
    const recent =
      signed.user.ownedFranchises[ownerId]!.ownershipConfidence.recentEvidence;
    expect(recent.some((entry) => entry.id === evidence!.id)).toBe(true);
  });
});

describe("standing offers from CPU teams", () => {
  it("are never picked up by the owners' daily answers", () => {
    const base = withStarFreeAgent(inFreeAgency(offseason(), 0));
    const cpuTeamId = Object.keys(base.state.world.teams)
      .sort()
      .find((id) => id !== base.state.user.activeOwnerTeamId) as TeamId;
    const offered = offerFrom(
      base.state,
      base.playerId,
      freeAgentMarketSalary(
        base.state,
        base.state.world.players[base.playerId]!,
      ),
      cpuTeamId,
    );
    const answered = answerStandingOffers(
      offered.state,
      FREE_AGENT_CLOSING_ASK_SHARE,
    ).state;
    expect(answered.world.players[base.playerId]!.teamId).toBeNull();
  });
});

describe("in-season signings", () => {
  it("are allowed in preseason and the regular season, not the playoffs", () => {
    const base = offseason();
    const playerId = Object.keys(base.world.players)[0] as PlayerId;
    const at = (phaseId: string) =>
      checkFreeAgencySigning(
        {
          ...base,
          competition: {
            ...base.competition,
            phase: {
              ...base.competition.phase,
              activePhaseId: phaseId as never,
            },
          },
        },
        playerId,
      ).violations.some((v) => v.code === "FA_NOT_OPEN");
    expect(at("offseason.free_agency")).toBe(false);
    expect(at("preseason.preparation")).toBe(false);
    expect(at("regular")).toBe(false);
    expect(at("playoffs")).toBe(true);
    expect(at("offseason.draft")).toBe(true);
  });

  it("price free agents at their closing ask", () => {
    const base = offseason();
    const regular: GameState = {
      ...base,
      competition: {
        ...base.competition,
        phase: { ...base.competition.phase, activePhaseId: "regular" },
      },
    };
    expect(freeAgentAskShare(regular)).toBe(FREE_AGENT_CLOSING_ASK_SHARE);
  });
});
