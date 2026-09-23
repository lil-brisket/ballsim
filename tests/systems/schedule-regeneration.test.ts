/**
 * Existing materialized schedules must not be partially re-dated in place.
 * New seasons clear competition.games / schedule and regenerate with the
 * round-based calendar scheduler.
 */

import { describe, expect, it } from "vitest";
import { calendarDaysBetween } from "@/domain/calendar-date";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createSeededRng } from "@/domain/rng";
import { resetDomainEventSequenceForTests } from "@/domain/events/domain-event";
import { createInitialGameState } from "@/state/create-initial-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { beginRegularSeasonFromPreseason } from "@/systems/simulation/season-lifecycle";
import { initializeNewSeason } from "@/systems/simulation/offseason-lifecycle";
import { generateSchedule } from "@/systems/schedule-generation";
import { addCalendarDays } from "@/domain/calendar-date";
import type { GameState } from "@/state/game-state";

function withDailyCompressedSchedule(state: GameState): GameState {
  // Force the old 1-round-per-day layout by rewriting dates after generation.
  const games = { ...state.competition.games };
  const opener =
    state.competition.season.regularSeasonStartDate ??
    "2026-10-01";
  const sorted = Object.values(games)
    .filter((g) => g.competitionType === "regular_season")
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const roundDates = [...new Set(sorted.map((g) => g.date))].sort();
  const remappedDates = new Map<string, string>();
  for (let i = 0; i < roundDates.length; i += 1) {
    remappedDates.set(roundDates[i]!, addCalendarDays(opener, i));
  }
  for (const gameId of Object.keys(games)) {
    const game = games[gameId]!;
    const nextDate = remappedDates.get(game.date);
    if (nextDate) {
      games[gameId] = { ...game, date: nextDate };
    }
  }
  return {
    ...state,
    competition: {
      ...state.competition,
      games,
    },
  };
}

describe("schedule regeneration across seasons", () => {
  it("does not mutate dates of an existing materialized schedule on generateSchedule", () => {
    resetDomainEventSequenceForTests();
    let state = createInitialGameState({
      saveId: "regen_idempotent",
      rngSeed: 11,
      settings: CBL_GAME_SETTINGS,
    });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    state = beginRegularSeasonFromPreseason(state).state;
    state = withDailyCompressedSchedule(state);

    const before = Object.values(state.competition.games)
      .filter((g) => g.competitionType === "regular_season")
      .map((g) => `${g.id}:${g.date}`)
      .sort();

    const again = generateSchedule(state).state;
    const after = Object.values(again.competition.games)
      .filter((g) => g.competitionType === "regular_season")
      .map((g) => `${g.id}:${g.date}`)
      .sort();

    expect(after).toEqual(before);
  });

  it("initializeNewSeason clears schedule so the next generate uses the new scheduler", () => {
    resetDomainEventSequenceForTests();
    let state = createInitialGameState({
      saveId: "regen_new_season",
      rngSeed: 13,
      settings: CBL_GAME_SETTINGS,
    });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    state = beginRegularSeasonFromPreseason(state).state;
    state = withDailyCompressedSchedule(state);

    const compressed = Object.values(state.competition.games).filter(
      (g) => g.competitionType === "regular_season",
    );
    const compressedSpan = calendarDaysBetween(
      [...compressed].map((g) => g.date).sort()[0]!,
      [...compressed].map((g) => g.date).sort().at(-1)!,
    );
    expect(compressedSpan).toBeLessThan(40);

    // Move into a state initializeNewSeason accepts (staff_development / offseason).
    state = {
      ...state,
      competition: {
        ...state.competition,
        season: {
          ...state.competition.season,
          phase: "offseason",
          offseasonStage: "league_initialization",
          year: state.competition.season.year,
        },
        phase: {
          activePhaseId: "offseason.staff_development",
          enteredDate: state.world.calendar.currentDate,
        },
      },
    };

    const initialized = initializeNewSeason(state).state;
    expect(initialized.competition.schedule.gameIds).toHaveLength(0);
    expect(Object.keys(initialized.competition.games)).toHaveLength(0);

    const regenerated = generateSchedule(initialized).state;
    const games = Object.values(regenerated.competition.games).filter(
      (g) => g.competitionType === "regular_season",
    );
    const dates = games.map((g) => g.date).sort();
    const span = calendarDaysBetween(dates[0]!, dates[dates.length - 1]!);
    // New scheduler: span driven by targetGamesPerWeek, not 1 day per round.
    expect(span).toBeGreaterThan(compressedSpan);
    expect(span).toBeGreaterThan(30);
  });
});
