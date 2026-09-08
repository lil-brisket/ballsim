import { describe, expect, it } from "vitest";
import { toLeagueHubView, LEAGUE_HUB_TIER2_LIMIT } from "@/state/league-hub-selectors";
import { createTestGameState } from "../factories/game-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createSeededRng } from "@/domain/rng";

describe("league-hub-selectors", () => {
  it("builds hub view with my team context and tier-2 preview limits", () => {
    let state = createTestGameState({ saveId: "league_hub_test" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;

    const hub = toLeagueHubView(state);
    expect(hub.saveId).toBe("league_hub_test");
    expect(hub.leagueName.length).toBeGreaterThan(0);
    expect(hub.myTeam).not.toBeNull();
    expect(hub.standingsPreview.length).toBeGreaterThan(0);
    expect(hub.transactions.length).toBeLessThanOrEqual(LEAGUE_HUB_TIER2_LIMIT);
    expect(hub.injuries.length).toBeLessThanOrEqual(LEAGUE_HUB_TIER2_LIMIT);
    expect(hub.media.length).toBeLessThanOrEqual(LEAGUE_HUB_TIER2_LIMIT);
    expect(hub.snapshot.userRank).toBeGreaterThan(0);
  });

  it("highlights user team in standings preview", () => {
    let state = createTestGameState({ saveId: "league_hub_user" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;

    const hub = toLeagueHubView(state);
    expect(hub.standingsPreview.some((r) => r.isUserTeam)).toBe(true);
  });
});
