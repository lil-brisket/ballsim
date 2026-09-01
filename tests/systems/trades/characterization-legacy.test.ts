/**
 * Characterization tests — lock legacy trade behavior before valuation refactor.
 * These assert current contracts so refactors preserve salary rules, pick ownership,
 * block behavior, and evaluateTradeOffer shape.
 */
import { describe, expect, it } from "vitest";
import {
  addToTradeBlock,
  calculateDraftPickValue,
  evaluateTradeOffer,
  executeTrade,
  generateAiTradeProposal,
  getTradeBlock,
  validateTrade,
} from "@/systems/trades";
import { applyTradeSalaryRule } from "@/systems/trades/trade-salary-rules";
import { gmTradeAcceptanceThreshold } from "@/systems/staff-effects";
import { DRAFT_PICK_VALUE_ROUND_1, DRAFT_PICK_VALUE_ROUND_2 } from "@/systems/trades-config";
import {
  createTradeFixture,
  pickForTeam,
  playerForPlayerProposal,
  playerOnTeam,
  teamIds,
} from "./fixture";
import { createDraftPick } from "@/domain/entities/draft-pick";
import { asDraftPickId, asTeamId } from "@/domain/ids";

describe("legacy characterization — draft pick value", () => {
  it("uses round-only constants for R1 and R2", () => {
    const r1 = createDraftPick({
      id: asDraftPickId("pick_t_2026_r1"),
      originalTeamId: asTeamId("t1"),
      ownerTeamId: asTeamId("t1"),
      seasonYear: 2026,
      round: 1,
    });
    const r2 = createDraftPick({
      id: asDraftPickId("pick_t_2027_r2"),
      originalTeamId: asTeamId("t1"),
      ownerTeamId: asTeamId("t1"),
      seasonYear: 2027,
      round: 2,
    });
    expect(calculateDraftPickValue(r1)).toBe(DRAFT_PICK_VALUE_ROUND_1);
    expect(calculateDraftPickValue(r2)).toBe(DRAFT_PICK_VALUE_ROUND_2);
    expect(DRAFT_PICK_VALUE_ROUND_1).toBe(80);
    expect(DRAFT_PICK_VALUE_ROUND_2).toBe(50);
  });
});

describe("legacy characterization — evaluateTradeOffer", () => {
  it("returns accepted/net/incoming/outgoing/tradeBlockBonus shape", () => {
    const state = createTradeFixture();
    const { teamA } = teamIds(state);
    const proposal = playerForPlayerProposal(state);
    const evaluation = evaluateTradeOffer(state, teamA, proposal);
    expect(evaluation).toMatchObject({
      accepted: expect.any(Boolean),
      netValue: expect.any(Number),
      incomingValue: expect.any(Number),
      outgoingValue: expect.any(Number),
      tradeBlockBonus: expect.any(Number),
    });
    expect(evaluation.objectiveNetValue).toEqual(expect.any(Number));
  });

  it("is deterministic for the same state and proposal", () => {
    const state = createTradeFixture();
    const { teamA } = teamIds(state);
    const proposal = playerForPlayerProposal(state);
    const a = evaluateTradeOffer(state, teamA, proposal);
    const b = evaluateTradeOffer(state, teamA, proposal);
    expect(a).toEqual(b);
  });

  it("GM threshold remains finite; decision uses makeTradeDecision layer", () => {
    const state = createTradeFixture();
    const { teamA } = teamIds(state);
    const threshold = gmTradeAcceptanceThreshold(state, teamA);
    expect(Number.isFinite(threshold)).toBe(true);
    const proposal = playerForPlayerProposal(state);
    const evaluation = evaluateTradeOffer(state, teamA, proposal);
    expect(typeof evaluation.accepted).toBe("boolean");
    expect(evaluation.decisionAction === "accept" || evaluation.decisionAction === "reject" || evaluation.decisionAction === "counter").toBe(true);
  });
});

describe("legacy characterization — salary rules", () => {
  it("salary matching still gates over-cap incoming surplus", () => {
    const result = applyTradeSalaryRule({
      outgoingSalary: 10_000_000,
      incomingSalary: 20_000_000,
      currentPayroll: 150_000_000,
      salaryCap: 100_000_000,
      matchingPercent: 0.25,
    });
    expect(result.valid).toBe(false);
  });

  it("allows matching within percent when over cap", () => {
    const result = applyTradeSalaryRule({
      outgoingSalary: 10_000_000,
      incomingSalary: 12_000_000,
      currentPayroll: 150_000_000,
      salaryCap: 100_000_000,
      matchingPercent: 0.25,
    });
    expect(result.valid).toBe(true);
  });
});

describe("legacy characterization — trade block and AI proposal", () => {
  it("addToTradeBlock persists player asset", () => {
    const state = createTradeFixture();
    const { teamA } = teamIds(state);
    const playerId = playerOnTeam(state, teamA, 0);
    const next = addToTradeBlock(state, teamA, {
      kind: "player",
      playerId,
    });
    const block = getTradeBlock(next.state, teamA);
    expect(block.assets.some((a) => a.kind === "player" && a.playerId === playerId)).toBe(
      true,
    );
  });

  it("generateAiTradeProposal finds valid 1-for-1 from blocks", () => {
    const state = createTradeFixture();
    const { teamA, teamB } = teamIds(state);
    let next = addToTradeBlock(state, teamA, {
      kind: "player",
      playerId: playerOnTeam(state, teamA, 0),
    }).state;
    next = addToTradeBlock(next, teamB, {
      kind: "player",
      playerId: playerOnTeam(next, teamB, 0),
    }).state;
    const proposal = generateAiTradeProposal(next, teamA);
    expect(proposal).toBeDefined();
    expect(validateTrade(next, proposal!).valid).toBe(true);
  });
});

describe("legacy characterization — executeTrade ownership", () => {
  it("moves players and draft picks between teams", () => {
    const state = createTradeFixture();
    const { teamA, teamB } = teamIds(state);
    const playerA = playerOnTeam(state, teamA, 0);
    const pickB = pickForTeam(state, teamB, 1, 1);
    const proposal = {
      sideA: {
        teamId: teamA,
        playerIds: [playerA],
        draftPickIds: [],
      },
      sideB: {
        teamId: teamB,
        playerIds: [],
        draftPickIds: [pickB],
      },
    };
    expect(validateTrade(state, proposal).valid).toBe(true);
    const executed = executeTrade(state, proposal);
    expect(executed.success).toBe(true);
    expect(executed.state.world.players[playerA]?.teamId).toBe(teamB);
    expect(executed.state.world.draftPicks[pickB]?.ownerTeamId).toBe(teamA);
    expect(executed.state.world.teams[teamA]!.roster.includes(playerA)).toBe(false);
    expect(executed.state.world.teams[teamB]!.roster.includes(playerA)).toBe(true);
  });
});
