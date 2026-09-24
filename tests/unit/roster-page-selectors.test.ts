import { describe, expect, it } from "vitest";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createSeededRng } from "@/domain/rng";
import { createTestGameState } from "../factories/game-state";
import {
  toFreeAgentViews,
  toRosterView,
} from "@/state/selectors";
import {
  toRosterPageView,
  toTradeBlockView,
  toTradeFinderRowViews,
} from "@/state/roster-page-selectors";
import { addToTradeBlock, findTrades } from "@/systems/trades";
import { asPlayerId, asTeamId } from "@/domain/ids";

describe("toRosterPageView", () => {
  it("composes roster management view without candidates on the page model", () => {
    let state = createTestGameState({ saveId: "roster_page_test" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;

    const view = toRosterPageView(state);

    expect(view.saveId).toBe("roster_page_test");
    expect(view.roster.length).toBe(toRosterView(state).length);
    expect(view.freeAgents.length).toBe(toFreeAgentViews(state).length);
    expect(view.rosterNeeds).toHaveLength(5);
    expect(view.depthChart.PG).toBeDefined();
    expect(view.tradeFinder).toEqual({
      suggestedOutgoingPlayerId: expect.any(String),
    });
    expect(view.tradeFinder).not.toHaveProperty("candidates");
    expect(view.summary.rosterCount).toBe(view.roster.length);
    expect(view.roster.every((row) => typeof row.rotationRole === "string")).toBe(
      true,
    );
    expect(view.roster.every((row) => row.roleDisplayLabel.length > 0)).toBe(
      true,
    );
  });

  it("splits trade block into players and picks", () => {
    let state = createTestGameState({ saveId: "roster_block_test" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    const teamId = state.user.activeOwnerTeamId;
    const playerId = state.world.teams[teamId]!.roster[0]!;
    state = addToTradeBlock(state, teamId, {
      kind: "player",
      playerId: asPlayerId(playerId),
    }).state;

    const block = toTradeBlockView(state, teamId);
    expect(block.players.some((row) => row.playerId === playerId)).toBe(true);
    expect(Array.isArray(block.picks)).toBe(true);

    const view = toRosterPageView(state);
    expect(view.summary.tradeBlockPlayerCount).toBeGreaterThanOrEqual(1);
    expect(
      view.roster.find((row) => row.playerId === playerId)?.onTradeBlock,
    ).toBe(true);
  });

  it("maps findTrades candidates via pure toTradeFinderRowViews", () => {
    let state = createTestGameState({ saveId: "roster_finder_map" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    const teamId = state.user.activeOwnerTeamId;
    const playerId = asPlayerId(state.world.teams[teamId]!.roster[0]!);

    const otherTeamId = Object.keys(state.world.teams).find(
      (id) => id !== teamId,
    );
    if (otherTeamId) {
      const otherPlayer = state.world.teams[otherTeamId]!.roster[0]!;
      state = addToTradeBlock(state, asTeamId(otherTeamId), {
        kind: "player",
        playerId: asPlayerId(otherPlayer),
      }).state;
    }

    const raw = findTrades(state, {
      direction: "move",
      teamId,
      asset: { kind: "player", playerId },
    });
    const rows = toTradeFinderRowViews(state, raw, "roster_finder_map");
    expect(rows.length).toBe(raw.length);
    for (const row of rows) {
      expect(row.counterpartyAbbreviation.length).toBeGreaterThan(0);
      expect(row.reviewHref).toContain("/dashboard/roster_finder_map/");
      expect(row.outgoingSummary.length).toBeGreaterThan(0);
    }
  });
});
