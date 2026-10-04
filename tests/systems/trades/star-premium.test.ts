import { describe, expect, it } from "vitest";
import { uniformPlayerAttributes } from "../../factories/player";
import { createTradeFixture, pickForTeam, teamIds } from "./fixture";
import { getBaseAssetValue } from "@/systems/trades/asset-valuation/base-asset-value";
import { evaluateTrade } from "@/systems/trades/asset-valuation/complete-trade-evaluation";
import { makeTradeDecision } from "@/systems/trades/asset-valuation/trade-decision";
import { isInterruptWorthyTradeOffer } from "@/systems/owner-decisions/trade-offer-quality";
import { evaluateTradeOffer } from "@/systems/trades/trade-evaluation";

describe("star trade premium", () => {
  it("rejects a 92 for a 59 and a late first", () => {
    const state = createTradeFixture();
    const { teamA, teamB } = teamIds(state);
    const starId = state.world.teams[teamA]!.roster[0]!;
    const scrubId = state.world.teams[teamB]!.roster[0]!;
    const star = state.world.players[starId]!;
    const scrub = state.world.players[scrubId]!;
    state.world.players[starId] = {
      ...star,
      attributes: uniformPlayerAttributes(92),
      potential: { overall: 92 },
    };
    state.world.players[scrubId] = {
      ...scrub,
      attributes: uniformPlayerAttributes(59),
      potential: { overall: 62 },
    };
    const lateFirst = pickForTeam(state, teamB, 2, 1);
    const pick = state.world.draftPicks[lateFirst];
    if (pick) {
      state.world.draftPicks[lateFirst] = {
        ...pick,
        round: 1,
        seasonYear: state.competition.season.year + 2,
      };
    }
    const proposal = {
      sideA: {
        teamId: teamA,
        playerIds: [starId],
        draftPickIds: [],
      },
      sideB: {
        teamId: teamB,
        playerIds: [scrubId],
        draftPickIds: [lateFirst],
      },
    };
    const evaluation = evaluateTrade(state, teamA, proposal);
    const decision = makeTradeDecision(
      evaluation,
      { teamId: teamA, gmThreshold: 0, tradeIsValid: true },
      1,
    );
    expect(decision.action).toBe("reject");
    expect(evaluation.sentValue).toBeGreaterThan(evaluation.receivedValue);
  });

  it("still values a 75-for-75 swap as roughly even", () => {
    const state = createTradeFixture();
    const { teamA, teamB } = teamIds(state);
    const aId = state.world.teams[teamA]!.roster[0]!;
    const bId = state.world.teams[teamB]!.roster[0]!;
    for (const id of [aId, bId]) {
      const player = state.world.players[id]!;
      state.world.players[id] = {
        ...player,
        attributes: uniformPlayerAttributes(75),
        potential: { overall: 78 },
      };
    }
    const starValue = getBaseAssetValue(state, {
      kind: "player",
      playerId: aId,
    }).value;
    const other = getBaseAssetValue(state, {
      kind: "player",
      playerId: bId,
    }).value;
    expect(Math.abs(starValue - other)).toBeLessThan(8);
  });

  it("does not interrupt for a junk future pick", () => {
    const state = createTradeFixture();
    const { teamA, teamB } = teamIds(state);
    const pickId = pickForTeam(state, teamB, 3, 2);
    const pick = state.world.draftPicks[pickId];
    if (pick) {
      state.world.draftPicks[pickId] = {
        ...pick,
        round: 2,
        seasonYear: state.competition.season.year + 3,
      };
    }
    const proposal = {
      sideA: { teamId: teamA, playerIds: [], draftPickIds: [] },
      sideB: { teamId: teamB, playerIds: [], draftPickIds: [pickId] },
    };
    const cpuEval = evaluateTradeOffer(state, teamB, proposal);
    expect(
      isInterruptWorthyTradeOffer(state, teamA, proposal, cpuEval),
    ).toBe(false);
  });
});
