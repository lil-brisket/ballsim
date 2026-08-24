import type { DomainEvent } from "@/domain/events";
import type { OffseasonStage } from "@/domain/entities/season";
import { createSeededRng } from "@/domain/rng";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { startPlayoffs } from "@/systems/playoff-simulation";
import { generateSchedule } from "@/systems/schedule-generation";
import { transitionPhase } from "@/systems/simulation/phase-machine";

/**
 * True when the regular season has a non-empty schedule and every listed game is final.
 * An empty schedule is never "complete."
 */
export function isRegularSeasonComplete(state: GameState): boolean {
  const { schedule, games } = state.competition;
  if (schedule.gameIds.length === 0) {
    return false;
  }
  for (const gameId of schedule.gameIds) {
    const game = games[gameId];
    if (!game || game.status !== "final") {
      return false;
    }
  }
  return true;
}

function setOffseasonStage(
  state: GameState,
  offseasonStage: OffseasonStage,
): GameState {
  if (state.competition.season.offseasonStage === offseasonStage) {
    return state;
  }
  return {
    ...state,
    competition: {
      ...state.competition,
      season: {
        ...state.competition.season,
        offseasonStage,
      },
    },
  };
}

function withRegularSeasonStartDate(
  state: GameState,
  regularSeasonStartDate: string,
): GameState {
  if (state.competition.season.regularSeasonStartDate === regularSeasonStartDate) {
    return state;
  }
  return {
    ...state,
    competition: {
      ...state.competition,
      season: {
        ...state.competition.season,
        regularSeasonStartDate,
      },
    },
  };
}

/**
 * Evaluates season-phase transitions appropriate for the current competition state.
 * Does not advance the calendar. transitionPhase is the sole phase writer.
 *
 * Postseason is a player-paced Season Review checkpoint: it does NOT auto-advance
 * to offseason. Callers use beginOffseason / enterOffseasonFromPostseason.
 */
export function processSeasonLifecycle(state: GameState): SystemResult {
  const events: DomainEvent[] = [];
  let current = state;
  const phase = current.competition.season.phase;

  if (phase === "preseason") {
    const phaseResult = transitionPhase(current, "regular");
    current = phaseResult.state;
    events.push(...phaseResult.events);

    current = withRegularSeasonStartDate(
      current,
      current.world.calendar.currentDate,
    );

    if (current.competition.schedule.gameIds.length === 0) {
      const scheduleResult = generateSchedule(current);
      current = scheduleResult.state;
      events.push(...scheduleResult.events);
    }
    return systemResult(current, events);
  }

  if (phase === "regular" && isRegularSeasonComplete(current)) {
    const playoffTeams = current.settings.playoffs.playoffTeams;
    const liveTeamCount = Object.keys(current.world.teams).length;

    if (playoffTeams > 0 && playoffTeams <= liveTeamCount) {
      const rng = createSeededRng(current.meta.rngState);
      const started = startPlayoffs(current, rng);
      current = {
        ...started.state,
        meta: {
          ...started.state.meta,
          rngState: rng.getState(),
        },
      };
      events.push(...started.events);
      const phaseResult = transitionPhase(current, "playoffs");
      current = phaseResult.state;
      events.push(...phaseResult.events);
      return systemResult(current, events);
    }

    const phaseResult = transitionPhase(current, "postseason");
    current = phaseResult.state;
    events.push(...phaseResult.events);
    return systemResult(current, events);
  }

  if (
    phase === "playoffs" &&
    current.competition.playoffs.status === "complete"
  ) {
    const phaseResult = transitionPhase(current, "postseason");
    current = phaseResult.state;
    events.push(...phaseResult.events);
    return systemResult(current, events);
  }

  // postseason: hold for player-paced Season Review (beginOffseason).
  return systemResult(current, events);
}

/**
 * Player-paced exit from Season Review into offseason finalization.
 * Does not run finalization processors — the next advanceSimulation day does.
 */
export function enterOffseasonFromPostseason(state: GameState): SystemResult {
  if (state.competition.season.phase !== "postseason") {
    throw new Error(
      `enterOffseasonFromPostseason requires phase "postseason"; got "${state.competition.season.phase}".`,
    );
  }
  const phaseResult = transitionPhase(state, "offseason");
  let current = phaseResult.state;
  current = setOffseasonStage(current, "season_finalization");
  return systemResult(current, phaseResult.events);
}
