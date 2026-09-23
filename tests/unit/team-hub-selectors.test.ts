import { describe, expect, it } from "vitest";
import { toTeamHubView } from "@/state/team-hub-selectors";
import { createTestGameState } from "../factories/game-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createSeededRng } from "@/domain/rng";

describe("team-hub-selectors", () => {
  it("composes hub sections from existing game state", () => {
    let state = createTestGameState({ saveId: "hub_test" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;

    const hub = toTeamHubView(state);
    expect(hub.saveId).toBe("hub_test");
    expect(hub.city.length).toBeGreaterThan(0);
    expect(hub.recentForm.games.length).toBeLessThanOrEqual(5);
    expect(hub.rotation.target).toBeGreaterThan(0);
    expect(Array.isArray(hub.corePlayers)).toBe(true);
    expect(Array.isArray(hub.recentHistory)).toBe(true);
    expect(hub.recentHistory.length).toBeLessThanOrEqual(5);
    expect(hub.standings).toBeDefined();
    expect(hub).not.toHaveProperty("upcomingGames");
    expect(hub).not.toHaveProperty("decisions");
  });
});
