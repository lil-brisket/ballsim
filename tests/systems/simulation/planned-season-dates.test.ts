import { describe, expect, it } from "vitest";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import type { GameState } from "@/state/game-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import {
  canonicalPreseasonStartDate,
  canonicalRegularSeasonStartDate,
  derivePlannedPreseasonStartDate,
  derivePlannedRegularSeasonStartDate,
  deriveUpcomingPreseasonStartDate,
  deriveUpcomingRegularSeasonStartDate,
  upcomingSeasonYear,
} from "@/systems/simulation/planned-season-dates";
import { beginRegularSeasonFromPreseason } from "@/systems/simulation/season-lifecycle";
import { PRESEASON_LENGTH_DAYS } from "@/systems/simulation/offseason-calendar-config";
import { addCalendarDays } from "@/domain/calendar-date";
import type { LeaguePhaseId } from "@/systems/phase-engine/phase-types";

function bootPreseason(): GameState {
  const state = createInitialGameState({
    saveId: "planned_dates",
    rngSeed: 4,
    settings: CBL_GAME_SETTINGS,
  });
  return bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
}

describe("canonical season start dates", () => {
  it("keeps opening night on October 1 for every season year", () => {
    expect(canonicalRegularSeasonStartDate(2026)).toBe("2026-10-01");
    expect(canonicalRegularSeasonStartDate(2027)).toBe("2027-10-01");
    expect(canonicalRegularSeasonStartDate(2031)).toBe("2031-10-01");
  });

  it("places preseason a fixed number of days before opening night", () => {
    expect(canonicalPreseasonStartDate(2026)).toBe("2026-09-10");
    expect(canonicalPreseasonStartDate(2027)).toBe(
      addCalendarDays("2027-10-01", -PRESEASON_LENGTH_DAYS),
    );
    expect(canonicalPreseasonStartDate(2027)).toBe("2027-09-10");
  });
});

describe("planned and upcoming season dates", () => {
  it("uses the canonical opener while a fresh save is still in preseason", () => {
    const state = bootPreseason();
    expect(derivePlannedPreseasonStartDate(state)).toBe("2026-09-10");
    expect(derivePlannedRegularSeasonStartDate(state)).toBe("2026-10-01");
    expect(upcomingSeasonYear(state)).toBe(2026);
  });

  it("points offseason windows at next year's canonical dates", () => {
    const base = beginRegularSeasonFromPreseason(bootPreseason()).state;
    const state: GameState = {
      ...base,
      world: {
        ...base.world,
        calendar: {
          ...base.world.calendar,
          currentDate: "2027-06-20",
        },
      },
      competition: {
        ...base.competition,
        phase: {
          activePhaseId: "offseason.staff_development" as LeaguePhaseId,
          enteredDate: "2027-06-01",
        },
        season: {
          ...base.competition.season,
          phase: "offseason",
          offseasonStage: "staff_development",
          offseasonStageEnteredDate: "2027-06-01",
          regularSeasonStartDate: "2026-10-01",
        },
      },
    };

    expect(upcomingSeasonYear(state)).toBe(2027);
    expect(deriveUpcomingPreseasonStartDate(state)).toBe("2027-09-10");
    expect(deriveUpcomingRegularSeasonStartDate(state)).toBe("2027-10-01");
    expect(derivePlannedPreseasonStartDate(state)).toBeNull();
    expect(derivePlannedRegularSeasonStartDate(state)).toBe("2026-10-01");
  });
});
