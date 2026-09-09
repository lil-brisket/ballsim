/**
 * Phase 5 — Calendar ↔ Offseason lifecycle and nav visibility.
 */

import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createTestGameState } from "../factories/game-state";
import { ownerNavGroupsForState } from "@/application/owner-nav-config";
import { toOffseasonHubView } from "@/state/offseason-hub-selectors";
import { toDraftHubView } from "@/state/draft-hub-selectors";
import { toFreeAgencyHubView } from "@/state/free-agency-hub-selectors";
import { toScoutingHubView } from "@/state/scouting-hub-selectors";
import type { GameState } from "@/state/game-state";

function withSeason(
  state: GameState,
  phase: GameState["competition"]["season"]["phase"],
  stage: GameState["competition"]["season"]["offseasonStage"] = "none",
): GameState {
  return {
    ...state,
    competition: {
      ...state.competition,
      season: {
        ...state.competition.season,
        phase,
        offseasonStage: stage,
      },
    },
  };
}

describe("phase5 offseason lifecycle", () => {
  it("before offseason: nav absent, hubs inactive, routes remain loadable", () => {
    let state = createTestGameState({ saveId: "lifecycle_before" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    state = withSeason(state, "regular");

    const nav = ownerNavGroupsForState(state);
    expect(nav.some((g) => g.id === "offseason")).toBe(false);
    const hrefs = nav.flatMap((g) => g.items.map((i) => i.href));
    expect(hrefs).not.toContain("/draft");
    expect(hrefs).not.toContain("/free-agency");

    expect(toOffseasonHubView(state).active).toBe(false);
    expect(toDraftHubView(state).active).toBe(false);
    expect(toFreeAgencyHubView(state).active).toBe(false);
    // Direct URL still yields a view (inactive), not a throw
    expect(toScoutingHubView(state).inactiveReason).toBeTruthy();
  });

  it("enter offseason: nav appears with Draft/Scouting/FA; command center active", () => {
    let state = createTestGameState({ saveId: "lifecycle_enter" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    state = withSeason(state, "offseason", "roster_decisions");

    const nav = ownerNavGroupsForState(state);
    const off = nav.find((g) => g.id === "offseason");
    expect(off).toBeDefined();
    expect(off!.items.map((i) => i.href)).toEqual([
      "/offseason",
      "/draft",
      "/scouting",
      "/free-agency",
    ]);

    const hub = toOffseasonHubView(state);
    expect(hub.active).toBe(true);
    expect(hub.timeline.length).toBeGreaterThanOrEqual(0);
    expect(hub.status.length).toBeGreaterThan(0);
  });

  it("exit offseason: nav disappears and hubs go inactive", () => {
    let state = createTestGameState({ saveId: "lifecycle_exit" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    state = withSeason(state, "offseason", "free_agency");
    expect(ownerNavGroupsForState(state).some((g) => g.id === "offseason")).toBe(
      true,
    );

    state = withSeason(state, "preseason", "none");
    expect(ownerNavGroupsForState(state).some((g) => g.id === "offseason")).toBe(
      false,
    );
    expect(toOffseasonHubView(state).active).toBe(false);
    expect(toFreeAgencyHubView(state).active).toBe(false);
  });

  it("playoffs phase injects Playoffs nav without offseason destinations", () => {
    let state = createTestGameState({ saveId: "lifecycle_playoffs" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    state = withSeason(state, "playoffs");

    const nav = ownerNavGroupsForState(state);
    expect(nav.some((g) => g.id === "offseason")).toBe(false);
    const league = nav.find((g) => g.id === "league");
    expect(league?.items.some((i) => i.href === "/playoffs")).toBe(true);
    expect(league?.items.some((i) => i.href === "/draft")).toBe(false);
  });
});
