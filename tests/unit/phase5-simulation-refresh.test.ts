/**
 * Phase 5 hubs must refresh from GameState after simulation ticks.
 */

import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { processSeasonPlayerDevelopment } from "@/systems/season-player-development";
import { createTestGameState } from "../factories/game-state";
import { toOffseasonHubView } from "@/state/offseason-hub-selectors";
import { toDraftHubView } from "@/state/draft-hub-selectors";
import { toScoutingHubView } from "@/state/scouting-hub-selectors";
import { toFreeAgencyHubView } from "@/state/free-agency-hub-selectors";
import { toAwardsHubView } from "@/state/awards-hub-selectors";
import { toPlayoffHubView } from "@/state/playoff-hub-selectors";

describe("phase5 simulation refresh", () => {
  it("rebuilds all Phase 5 hubs after player development tick", () => {
    let state = createTestGameState({ saveId: "phase5_refresh" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;

    expect(toOffseasonHubView(state)).toBeDefined();
    expect(toDraftHubView(state)).toBeDefined();
    expect(toScoutingHubView(state)).toBeDefined();
    expect(toFreeAgencyHubView(state)).toBeDefined();
    expect(toAwardsHubView(state)).toBeDefined();
    expect(toPlayoffHubView(state)).toBeDefined();

    const developed = processSeasonPlayerDevelopment(
      state,
      createSeededRng(42),
    );
    state = developed.state;

    const offseason = toOffseasonHubView(state);
    const draft = toDraftHubView(state);
    const scouting = toScoutingHubView(state);
    const fa = toFreeAgencyHubView(state);
    const awards = toAwardsHubView(state);
    const playoffs = toPlayoffHubView(state);

    expect(offseason.currentDate).toBe(state.world.calendar.currentDate);
    expect(draft.saveId).toBe(state.meta.saveId);
    expect(scouting.coverage).toBeDefined();
    expect(fa.playerPayroll).toBeTypeOf("number");
    expect(awards.currentSeasonYear).toBe(state.competition.season.year);
    expect(playoffs.tournamentStatus).toBe(state.competition.playoffs.status);
  });
});
