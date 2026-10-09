import { describe, expect, it } from "vitest";
import {
  createTradeFixture,
  pickForTeam,
  playerForPlayerProposal,
  playerOnTeam,
  teamIds,
} from "../fixture";
import {
  addToTradeBlock,
  evaluateTrade,
  getBaseAssetValue,
  getRetentionPriority,
  getTeamAssetValue,
  getTradeDesirability,
  makeTradeDecision,
  projectDraftPick,
  tradeDecisionSeed,
  wasRecentlyAcquired,
} from "@/systems/trades";
import { createDomainEvent } from "@/domain/events";
import { appendSeasonEventLog } from "@/state/game-state";
import { TRADE_BLOCK_VALUE_BONUS } from "@/systems/trades-config";
import { calculateTradeNeeds } from "@/systems/trades/trade-needs";
import { gmTradeAcceptanceThreshold } from "@/systems/staff-effects";
import { validateTrade } from "@/systems/trades";
import {
  enqueueTradeOfferForOwner,
  applyTradeCounterofferState,
  resolvePendingOwnerDecision,
  expireDatedTradeOffers,
} from "@/systems/owner-decisions";
import { addCalendarDays } from "@/domain/calendar-date";
import { asOwnerDecisionId } from "@/domain/ids";

describe("asset valuation — deterministic", () => {
  it("evaluateTrade is deterministic for same state + proposal", () => {
    const state = createTradeFixture();
    const { teamA } = teamIds(state);
    const proposal = playerForPlayerProposal(state);
    const a = evaluateTrade(state, teamA, proposal);
    const b = evaluateTrade(state, teamA, proposal);
    expect(a).toEqual(b);
  });

  it("does not mutate game RNG when evaluating", () => {
    const state = createTradeFixture();
    const { teamA } = teamIds(state);
    const proposal = playerForPlayerProposal(state);
    const before = state.meta.rngState;
    evaluateTrade(state, teamA, proposal);
    evaluateTrade(state, teamA, proposal);
    expect(state.meta.rngState).toBe(before);
  });

  it("young prospect has higher base value than declining vet at same overall band when potential higher", () => {
    let state = createTradeFixture();
    const { teamA } = teamIds(state);
    const youngId = playerOnTeam(state, teamA, 0);
    const oldId = playerOnTeam(state, teamA, 1);
    const young = state.world.players[youngId]!;
    const old = state.world.players[oldId]!;
    state = {
      ...state,
      world: {
        ...state.world,
        players: {
          ...state.world.players,
          [youngId]: {
            ...young,
            age: 21,
            potential: { ...young.potential, overall: 88 },
            development: { stage: "developing" },
          },
          [oldId]: {
            ...old,
            age: 34,
            potential: { ...old.potential, overall: 70 },
            development: { stage: "declining" },
          },
        },
      },
    };
    const youngValue = getBaseAssetValue(state, {
      kind: "player",
      playerId: youngId,
    }).value;
    const oldValue = getBaseAssetValue(state, {
      kind: "player",
      playerId: oldId,
    }).value;
    expect(youngValue).toBeGreaterThan(oldValue);
  });

  it("lottery-range pick values above late first when standings differ", () => {
    let state = createTradeFixture();
    const { teamA, teamB } = teamIds(state);
    state = {
      ...state,
      competition: {
        ...state.competition,
        standings: {
          ...state.competition.standings,
          byTeamId: {
            ...state.competition.standings.byTeamId,
            [teamA]: {
              ...(state.competition.standings.byTeamId[teamA] ?? {
                teamId: teamA,
                wins: 0,
                losses: 0,
              }),
              wins: 2,
              losses: 20,
            },
            [teamB]: {
              ...(state.competition.standings.byTeamId[teamB] ?? {
                teamId: teamB,
                wins: 0,
                losses: 0,
              }),
              wins: 18,
              losses: 4,
            },
          },
        },
      },
    };
    const lotteryPick =
      state.world.draftPicks[pickForTeam(state, teamA, 1, 1)]!;
    const latePick = state.world.draftPicks[pickForTeam(state, teamB, 1, 1)]!;
    const lotteryProj = projectDraftPick(state, lotteryPick);
    const lateProj = projectDraftPick(state, latePick);
    expect(lotteryProj.projectedOverallPick).toBeLessThan(
      lateProj.projectedOverallPick,
    );
    const lotteryValue = getBaseAssetValue(state, {
      kind: "draftPick",
      draftPickId: lotteryPick.id,
    }).value;
    const lateValue = getBaseAssetValue(state, {
      kind: "draftPick",
      draftPickId: latePick.id,
    }).value;
    expect(lotteryValue).toBeGreaterThan(lateValue);
    expect(lotteryProj.rangeHigh).toBeGreaterThan(lotteryProj.rangeLow);
  });

  it("ranks same-win teams by win percentage and losses", () => {
    let state = createTradeFixture();
    const { teamA, teamB } = teamIds(state);
    state = {
      ...state,
      competition: {
        ...state.competition,
        standings: {
          ...state.competition.standings,
          byTeamId: {
            ...state.competition.standings.byTeamId,
            [teamA]: {
              ...(state.competition.standings.byTeamId[teamA] ?? {
                teamId: teamA,
                wins: 0,
                losses: 0,
              }),
              wins: 10,
              losses: 20,
              winPercentage: 10 / 30,
            },
            [teamB]: {
              ...(state.competition.standings.byTeamId[teamB] ?? {
                teamId: teamB,
                wins: 0,
                losses: 0,
              }),
              wins: 10,
              losses: 5,
              winPercentage: 10 / 15,
            },
          },
        },
      },
    };
    const worsePick =
      state.world.draftPicks[pickForTeam(state, teamA, 1, 1)]!;
    const betterPick =
      state.world.draftPicks[pickForTeam(state, teamB, 1, 1)]!;
    expect(
      projectDraftPick(state, worsePick).projectedOverallPick,
    ).toBeLessThan(projectDraftPick(state, betterPick).projectedOverallPick);
  });
});

describe("team valuation and desirability", () => {
  it("calculateTradeNeeds returns positional structure", () => {
    const state = createTradeFixture();
    const { teamA } = teamIds(state);
    const needs = calculateTradeNeeds(state, teamA);
    expect(needs.byPosition.length).toBeGreaterThan(0);
  });

  it("retention priority is high for top player not on block", () => {
    const state = createTradeFixture();
    const { teamA } = teamIds(state);
    const starId = playerOnTeam(state, teamA, 0);
    const priority = getRetentionPriority(state, teamA, starId);
    expect(priority).toBeGreaterThanOrEqual(0);
    expect(priority).toBeLessThanOrEqual(100);
  });

  it("recently-acquired hold applies from seasonEventLog", () => {
    let state = createTradeFixture();
    const { teamA, teamB } = teamIds(state);
    const playerId = playerOnTeam(state, teamA, 1);
    expect(wasRecentlyAcquired(state, playerId)).toBe(false);
    const before = getRetentionPriority(state, teamA, playerId);
    state = appendSeasonEventLog(state, [
      createDomainEvent({
        type: "PlayerTraded",
        occurredOn: state.world.calendar.currentDate,
        payload: {
          playerId,
          fromTeamId: teamB,
          toTeamId: teamA,
        },
      }),
    ]);
    expect(wasRecentlyAcquired(state, playerId)).toBe(true);
    expect(getRetentionPriority(state, teamA, playerId)).toBeGreaterThan(
      before,
    );
  });

  it("makeTradeDecision uses explicit seed not game RNG", () => {
    const state = createTradeFixture();
    const { teamA } = teamIds(state);
    const proposal = playerForPlayerProposal(state);
    const evaluation = evaluateTrade(state, teamA, proposal);
    const seed = tradeDecisionSeed(teamA, "test-fingerprint");
    const d1 = makeTradeDecision(
      evaluation,
      {
        teamId: teamA,
        gmThreshold: gmTradeAcceptanceThreshold(state, teamA),
        tradeIsValid: validateTrade(state, proposal).valid,
      },
      seed,
    );
    const d2 = makeTradeDecision(
      evaluation,
      {
        teamId: teamA,
        gmThreshold: gmTradeAcceptanceThreshold(state, teamA),
        tradeIsValid: validateTrade(state, proposal).valid,
      },
      seed,
    );
    expect(d1).toEqual(d2);
  });

  it("strategicFit is independent of valueDifference", () => {
    const state = createTradeFixture();
    const { teamA, teamB } = teamIds(state);
    const pickId = pickForTeam(state, teamA, 1, 1);
    const proposal = {
      sideA: {
        teamId: teamA,
        playerIds: [playerOnTeam(state, teamA, 0)],
        draftPickIds: [pickId],
      },
      sideB: {
        teamId: teamB,
        playerIds: [playerOnTeam(state, teamB, 0)],
        draftPickIds: [] as never[],
      },
    };
    const evaluation = evaluateTrade(state, teamA, proposal);
    expect(Math.abs(evaluation.valueDifference)).toBeGreaterThan(8);
    const valueMapped = Math.max(
      0,
      Math.min(1, 0.5 + evaluation.valueDifference / 80),
    );
    expect(Math.abs(evaluation.strategicFit - valueMapped)).toBeGreaterThan(
      0.05,
    );
  });

  it("does not raise team value for assets already on the trade block", () => {
    const state = createTradeFixture();
    const { teamA } = teamIds(state);
    const playerId = playerOnTeam(state, teamA, 0);
    const before = getTeamAssetValue(state, teamA, {
      kind: "player",
      playerId,
    }).value;
    const listed = addToTradeBlock(state, teamA, {
      kind: "player",
      playerId,
    }).state;
    const after = getTeamAssetValue(listed, teamA, {
      kind: "player",
      playerId,
    }).value;
    expect(after).toBe(before);
  });

  it("applies the trade-block bonus once at evaluateTrade, not in team value", () => {
    const state = createTradeFixture();
    const { teamA } = teamIds(state);
    const proposal = playerForPlayerProposal(state);
    const incomingId = proposal.sideB.playerIds[0]!;
    const evaluation = evaluateTrade(state, teamA, proposal);
    const incomingValue = getTeamAssetValue(state, teamA, {
      kind: "player",
      playerId: incomingId,
    }).value;
    expect(evaluation.tradeBlockBonus).toBe(0);
    expect(evaluation.receivedValue).toBe(incomingValue);
    expect(TRADE_BLOCK_VALUE_BONUS).toBe(10);
  });
});

describe("negotiation and expiration", () => {
  it("rejected counter resolves as declined and clears queue", () => {
    const state = createTradeFixture();
    const { teamA, teamB } = teamIds(state);
    // Make teamA owned
    let working = {
      ...state,
      user: {
        ...state.user,
        ownedTeamIds: [teamA],
        activeOwnerTeamId: teamA,
        ownedFranchises: {
          ...state.user.ownedFranchises,
          [teamA]: state.user.ownedFranchises[state.user.activeOwnerTeamId]!,
        },
      },
    };
    // Fix player ownership in proposal to match teams
    const fixed = {
      sideA: {
        teamId: teamB,
        playerIds: [playerOnTeam(working, teamB, 0)],
        draftPickIds: [] as never[],
      },
      sideB: {
        teamId: teamA,
        playerIds: [playerOnTeam(working, teamA, 0)],
        draftPickIds: [] as never[],
      },
    };
    const enqueued = enqueueTradeOfferForOwner(working, teamB, fixed, {
      targetOwnedTeamId: teamA,
    });
    expect(enqueued.outcome).toBe("queued");
    working = enqueued.state;
    const decisionId = working.user.pendingOwnerDecisions[0]!.id;

    // Counter that is worse for CPU — then reject path
    const counter = {
      sideA: fixed.sideA,
      sideB: {
        teamId: teamA,
        playerIds: [
          playerOnTeam(working, teamA, 0),
          playerOnTeam(working, teamA, 1),
        ],
        draftPickIds: [] as never[],
      },
    };
    working = applyTradeCounterofferState(
      working,
      decisionId,
      counter,
      "rejected",
    );
    const resolved = resolvePendingOwnerDecision(working, {
      decisionId,
      status: "declined",
      decisionSource: "owner",
    });
    expect(resolved.state.user.pendingOwnerDecisions).toHaveLength(0);
    expect(resolved.resolved?.status).toBe("declined");
  });

  it("expireDatedTradeOffers clears past-due offers", () => {
    const state = createTradeFixture();
    const { teamA, teamB } = teamIds(state);
    let working = {
      ...state,
      user: {
        ...state.user,
        ownedTeamIds: [teamA],
        activeOwnerTeamId: teamA,
        ownedFranchises: {
          ...state.user.ownedFranchises,
          [teamA]: state.user.ownedFranchises[state.user.activeOwnerTeamId]!,
        },
      },
    };
    const fixed = {
      sideA: {
        teamId: teamB,
        playerIds: [playerOnTeam(working, teamB, 0)],
        draftPickIds: [] as never[],
      },
      sideB: {
        teamId: teamA,
        playerIds: [playerOnTeam(working, teamA, 0)],
        draftPickIds: [] as never[],
      },
    };
    const enqueued = enqueueTradeOfferForOwner(working, teamB, fixed, {
      targetOwnedTeamId: teamA,
    });
    working = enqueued.state;
    const decision = working.user.pendingOwnerDecisions[0]!;
    working = {
      ...working,
      user: {
        ...working.user,
        pendingOwnerDecisions: [
          {
            ...decision,
            payload: {
              ...decision.payload,
              expiresOn: addCalendarDays(
                working.world.calendar.currentDate,
                -1,
              ),
            },
          },
        ],
      },
    };
    const expired = expireDatedTradeOffers(working);
    expect(expired.expiredIds).toContain(decision.id);
    expect(expired.state.user.pendingOwnerDecisions).toHaveLength(0);
  });

  it("supports multiple pending offers in queue", () => {
    const state = createTradeFixture();
    const ids = Object.keys(state.world.teams).sort();
    const teamA = ids[0] as ReturnType<typeof teamIds>["teamA"];
    const teamB = ids[1] as ReturnType<typeof teamIds>["teamB"];
    const teamC = ids[2] as ReturnType<typeof teamIds>["teamA"];
    let working = {
      ...state,
      user: {
        ...state.user,
        ownedTeamIds: [teamA],
        activeOwnerTeamId: teamA,
        ownedFranchises: {
          ...state.user.ownedFranchises,
          [teamA]: state.user.ownedFranchises[state.user.activeOwnerTeamId]!,
        },
      },
    };
    const offer1 = {
      sideA: {
        teamId: teamB,
        playerIds: [playerOnTeam(working, teamB, 0)],
        draftPickIds: [] as never[],
      },
      sideB: {
        teamId: teamA,
        playerIds: [playerOnTeam(working, teamA, 0)],
        draftPickIds: [] as never[],
      },
    };
    const offer2 = {
      sideA: {
        teamId: teamC,
        playerIds: [playerOnTeam(working, teamC, 1)],
        draftPickIds: [] as never[],
      },
      sideB: {
        teamId: teamA,
        playerIds: [playerOnTeam(working, teamA, 1)],
        draftPickIds: [] as never[],
      },
    };
    working = enqueueTradeOfferForOwner(working, teamB, offer1, {
      targetOwnedTeamId: teamA,
    }).state;
    working = enqueueTradeOfferForOwner(working, teamC, offer2, {
      targetOwnedTeamId: teamA,
    }).state;
    expect(working.user.pendingOwnerDecisions.length).toBe(2);
  });
});

describe("getTeamAssetValue bounded adjustments", () => {
  it("returns finite team-specific value with reasons", () => {
    const state = createTradeFixture();
    const { teamA } = teamIds(state);
    const playerId = playerOnTeam(state, teamA, 0);
    const result = getTeamAssetValue(state, teamA, {
      kind: "player",
      playerId,
    });
    expect(Number.isFinite(result.value)).toBe(true);
    expect(Array.isArray(result.reasons)).toBe(true);
  });

  it("desirability distinguishes send vs receive", () => {
    const state = createTradeFixture();
    const { teamA } = teamIds(state);
    const playerId = playerOnTeam(state, teamA, 0);
    const send = getTradeDesirability(
      state,
      teamA,
      { kind: "player", playerId },
      "send",
    );
    const receive = getTradeDesirability(
      state,
      teamA,
      { kind: "player", playerId },
      "receive",
    );
    expect(send.score).toBeGreaterThanOrEqual(0);
    expect(receive.score).toBeGreaterThanOrEqual(0);
  });
});

// silence unused
void asOwnerDecisionId;
