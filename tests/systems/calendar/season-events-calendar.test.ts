import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createInitialGameState } from "@/state/create-initial-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { beginRegularSeasonFromPreseason } from "@/systems/simulation/season-lifecycle";
import { generateRosters } from "@/systems/roster-generation";
import { projectCalendarEvents } from "@/systems/calendar/project-calendar-events";

describe("season events calendar projection", () => {
  it("shows planned season events as league special events", () => {
    let state = createInitialGameState({
      saveId: "cal_se",
      rngSeed: 7,
      settings: CBL_GAME_SETTINGS,
    });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    state = generateRosters(state, rng).state;
    state = beginRegularSeasonFromPreseason(state).state;

    const events = projectCalendarEvents(state);
    const seasonEvents = events.filter((e) =>
      e.sourceKey.startsWith("season_event:"),
    );
    expect(seasonEvents.length).toBeGreaterThan(0);
    expect(
      seasonEvents.some(
        (e) =>
          e.title.includes("Fan Voting") ||
          e.title.includes("⭐") ||
          e.sourceKey.startsWith("season_event:"),
      ),
    ).toBe(true);
    expect(seasonEvents.every((e) => e.category === "league")).toBe(true);
  });
});
