import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createInitialGameState } from "@/state/create-initial-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { beginRegularSeasonFromPreseason } from "@/systems/simulation/season-lifecycle";
import { resetDomainEventSequenceForTests } from "@/domain/events/domain-event";
import { addCalendarDays } from "@/domain/calendar-date";
import { buildSimulationSummary } from "@/systems/calendar/simulation-summary";

describe("buildSimulationSummary", () => {
  it("links owner-team finals in the simulated range", () => {
    resetDomainEventSequenceForTests();
    const state = createInitialGameState({
      saveId: "sim_summary_games",
      rngSeed: 19,
      settings: CBL_GAME_SETTINGS,
    });
    const rng = createSeededRng(state.meta.rngState);
    let current = bootstrapWorld(state, rng).state;
    current = beginRegularSeasonFromPreseason(current).state;
    const teamId = current.user.activeOwnerTeamId;
    const fromDate = addCalendarDays(current.world.calendar.currentDate, -2);
    const toDate = current.world.calendar.currentDate;
    const ownerGame = Object.values(current.competition.games).find(
      (game) => game.homeTeamId === teamId || game.awayTeamId === teamId,
    );
    expect(ownerGame).toBeDefined();
    const games = {
      ...current.competition.games,
      [ownerGame!.id]: {
        ...ownerGame!,
        status: "final" as const,
        date: fromDate,
        score: { home: 108, away: 101 },
      },
    };
    current = {
      ...current,
      competition: { ...current.competition, games },
    };

    const summary = buildSimulationSummary(current, [], {
      fromDate,
      toDate,
    });
    expect(summary.teamGames.length).toBeGreaterThan(0);
    expect(summary.teamGames[0]?.gameId).toBe(ownerGame!.id);
    expect(summary.teamGames[0]?.headline).toMatch(/vs /);
  });
});
