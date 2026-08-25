import type { DomainEvent } from "@/domain/events";
import type { Rng } from "@/domain/rng";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import type { Game } from "@/domain/entities/game";
import { simulateGamesForDate } from "@/systems/game-simulation";
import { simulateNextPlayoffGame } from "@/systems/playoff-simulation";
import { updateStandings } from "@/systems/standings";
import type { SimulationProfiler } from "@/systems/simulation/simulation-profiler";

export type DailyPipelineResult = SystemResult & {
  gamesSimulated: number;
};

/**
 * Deterministic daily simulation work for the current calendar date.
 * Runs after lifecycle and scheduled events so phase is up to date.
 */
export function runDailyPipeline(
  state: GameState,
  rng: Rng,
  profiler?: SimulationProfiler,
): DailyPipelineResult {
  const events: DomainEvent[] = [];
  let current = state;
  let gamesSimulated = 0;
  const phase = current.competition.season.phase;
  const date = current.world.calendar.currentDate;
  const newlyFinalized: Game[] = [];

  if (phase === "regular") {
    const gamesResult = simulateGamesForDate(current, rng, date, profiler);
    current = gamesResult.state;
    events.push(...gamesResult.events);
    gamesSimulated += gamesResult.events.length;
    for (const event of gamesResult.events) {
      if (event.type !== "GameCompleted") {
        continue;
      }
      const payload = event.payload as { gameId?: string };
      if (typeof payload.gameId !== "string") {
        continue;
      }
      const game = current.competition.games[payload.gameId];
      if (game != null && game.status === "final") {
        newlyFinalized.push(game);
      }
    }
  }

  if (
    phase === "playoffs" &&
    current.competition.playoffs.status === "in_progress"
  ) {
    const playoffStart = performance.now();
    const playoffResult = simulateNextPlayoffGame(current, rng);
    if (profiler) {
      profiler.addSeason("gameSimMs", performance.now() - playoffStart);
      profiler.bumpPlayoffGames(
        playoffResult.events.filter((event) => event.type === "GameCompleted")
          .length,
      );
    }
    current = playoffResult.state;
    events.push(...playoffResult.events);
    gamesSimulated += playoffResult.events.filter(
      (event) => event.type === "GameCompleted",
    ).length;
  }

  if (newlyFinalized.length > 0) {
    const standingsStart = performance.now();
    const standingsResult = updateStandings(current, newlyFinalized);
    if (profiler) {
      profiler.addSeason("standingsMs", performance.now() - standingsStart);
    }
    current = standingsResult.state;
    events.push(...standingsResult.events);
  }

  if (profiler) {
    profiler.bumpGames(gamesSimulated);
  }

  return {
    ...systemResult(current, events),
    gamesSimulated,
  };
}
