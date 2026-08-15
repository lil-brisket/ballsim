import type { DomainEvent } from "@/domain/events";
import type { Rng } from "@/domain/rng";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { simulateGamesForDate } from "@/systems/game-simulation";
import { simulateNextPlayoffGame } from "@/systems/playoff-simulation";
import { updateStandings } from "@/systems/standings";

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
): DailyPipelineResult {
  const events: DomainEvent[] = [];
  let current = state;
  let gamesSimulated = 0;
  const phase = current.competition.season.phase;
  const date = current.world.calendar.currentDate;

  if (phase === "regular") {
    const gamesResult = simulateGamesForDate(current, rng, date);
    current = gamesResult.state;
    events.push(...gamesResult.events);
    gamesSimulated += gamesResult.events.length;
  }

  if (
    phase === "playoffs" &&
    current.competition.playoffs.status === "in_progress"
  ) {
    const playoffResult = simulateNextPlayoffGame(current, rng);
    current = playoffResult.state;
    events.push(...playoffResult.events);
    gamesSimulated += playoffResult.events.filter(
      (event) => event.type === "GameCompleted",
    ).length;
  }

  const standingsResult = updateStandings(current);
  current = standingsResult.state;
  events.push(...standingsResult.events);

  return {
    ...systemResult(current, events),
    gamesSimulated,
  };
}
