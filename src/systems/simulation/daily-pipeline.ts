import type { DomainEvent } from "@/domain/events";
import type { Rng } from "@/domain/rng";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import type { Game } from "@/domain/entities/game";
import { simulateGamesForDate } from "@/systems/game-simulation";
import { simulateNextPlayoffGame } from "@/systems/playoff-simulation";
import { updateStandings } from "@/systems/standings";
import type { SimulationProfiler } from "@/systems/simulation/simulation-profiler";
import { tickDailyRecovery, processExposureEvent } from "@/systems/injury/injury-service";
import { processPostGameInjuryExposures } from "@/systems/injury/injury-post-game";
import {
  createOffseasonTrainingExposure,
  createOffCourtExposure,
} from "@/systems/injury/injury-exposure";
import { redistributeRotationForInjuries } from "@/systems/rotation/rotation-injury-response";
import { cloneTeamRosterManagement } from "@/domain/entities/team-roster-management";
import type { TeamId } from "@/domain/ids";
import { runDevelopmentLeaguePipeline } from "@/systems/development-league/daily-pipeline";

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

    const dlResult = runDevelopmentLeaguePipeline(current, rng, profiler);
    current = dlResult.state;
    events.push(...dlResult.events);
    gamesSimulated += dlResult.gamesSimulated;
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
    for (const event of playoffResult.events) {
      if (event.type !== "GameCompleted") continue;
      const payload = event.payload as { gameId?: string };
      if (typeof payload.gameId !== "string") continue;
      const game = current.competition.games[payload.gameId];
      if (game != null && game.status === "final") {
        newlyFinalized.push(game);
      }
    }
  }

  // Post-game injury exposures (acute + overuse; mutually exclusive per player)
  for (const game of newlyFinalized) {
    const injuryResult = processPostGameInjuryExposures(current, game, rng);
    current = injuryResult.state;
    events.push(...injuryResult.events);
    if (injuryResult.events.some((e) => e.type === "PlayerInjured")) {
      for (const teamId of [game.homeTeamId, game.awayTeamId] as TeamId[]) {
        const team = current.world.teams[teamId];
        if (team == null) continue;
        const response = redistributeRotationForInjuries(
          current,
          teamId,
          team.rosterManagement,
        );
        current = {
          ...current,
          world: {
            ...current.world,
            teams: {
              ...current.world.teams,
              [teamId]: {
                ...team,
                rosterManagement: cloneTeamRosterManagement(response.management),
              },
            },
          },
        };
      }
    }
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

  // Offseason: explicit low-rate training / off-court exposure (not blanket daily rolls)
  if (phase === "offseason") {
    for (const player of Object.values(current.world.players)) {
      if (player.retired || player.teamId == null) continue;
      if (rng.chance(0.02)) {
        const result = processExposureEvent(
          current,
          createOffseasonTrainingExposure({
            playerId: player.id,
            teamId: player.teamId,
            date,
          }),
          rng,
        );
        current = result.state;
        events.push(...result.events);
      } else if (rng.chance(0.002)) {
        const result = processExposureEvent(
          current,
          createOffCourtExposure({
            playerId: player.id,
            teamId: player.teamId,
            date,
          }),
          rng,
        );
        current = result.state;
        events.push(...result.events);
      }
    }
  }

  // Single authoritative daily recovery clock
  const recovery = tickDailyRecovery(current, rng);
  current = recovery.state;
  events.push(...recovery.events);

  if (profiler) {
    profiler.bumpGames(gamesSimulated);
  }

  return {
    ...systemResult(current, events),
    gamesSimulated,
  };
}
