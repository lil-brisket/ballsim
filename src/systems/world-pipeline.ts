import type { Rng } from "@/domain/rng";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { mergeDraftPicksForSeason } from "@/domain/draft-picks/generate-draft-picks";
import { generateFantasyPlayerPool } from "@/systems/fantasy-draft/player-pool";
import { canBeginRegularSeason } from "@/systems/league-rules/phase-prerequisites";
import { generateRosters } from "@/systems/roster-generation";
import { generatePreseasonSchedule } from "@/systems/preseason-schedule-generation";
import { generateSchedule } from "@/systems/schedule-generation";
import { advanceSimulation } from "@/systems/simulation/advance-simulation";
import { needsRegularSeasonInitialization } from "@/systems/simulation/planned-season-dates";

export type WorldPipelineCommand = {
  type: "advanceDay";
};

/**
 * Ensures roster and draft picks exist (world-gen bootstrap).
 * Fantasy mode generates an unassigned player pool instead of team rosters.
 *
 * Lifecycle owns phase transition (preseason → regular). Bootstrap may
 * pre-materialize the main regular-season schedule so calendar projections can
 * display upcoming games before the first simulation step. Development-league
 * schedule remains owned by beginRegularSeasonFromPreseason.
 *
 * Idempotent; safe before advance day or on new save creation.
 */
export function bootstrapWorld(state: GameState, rng: Rng): SystemResult {
  const afterPlayers =
    state.settings.draft.mode === "fantasy"
      ? generateFantasyPlayerPool(state, rng)
      : generateRosters(state, rng);
  let current = ensureDraftPicks(afterPlayers.state);
  const events = [...afterPlayers.events];

  // Materialize the regular-season schedule early so calendar projections
  // can display upcoming games before the first simulation step.
  // This does not initialize the regular season or advance phase.
  if (
    current.competition.schedule.gameIds.length === 0 &&
    needsRegularSeasonInitialization(current) &&
    canBeginRegularSeason(current).allowed
  ) {
    const scheduled = generateSchedule(current);
    current = scheduled.state;
    events.push(...scheduled.events);
  }

  if (current.competition.season.phase === "preseason") {
    const preseason = generatePreseasonSchedule(current);
    current = preseason.state;
    events.push(...preseason.events);
  }

  return systemResult(current, events);
}

/**
 * Idempotently ensures every team has picks for the next three seasons
 * relative to competition.season.year. Preserves existing picks.
 */
export function ensureDraftPicks(state: GameState): GameState {
  const teams = Object.values(state.world.teams);
  const draftPicks = mergeDraftPicksForSeason(
    state.world.draftPicks,
    teams,
    state.competition.season.year,
  );
  if (draftPicks === state.world.draftPicks) {
    return state;
  }
  const existingKeys = Object.keys(state.world.draftPicks);
  const nextKeys = Object.keys(draftPicks);
  if (
    existingKeys.length === nextKeys.length &&
    existingKeys.every((key) => draftPicks[key] === state.world.draftPicks[key])
  ) {
    return state;
  }
  return {
    ...state,
    world: {
      ...state.world,
      draftPicks,
    },
  };
}

/**
 * World pipeline for Owner Mode — thin wrapper over {@link advanceSimulation}.
 *
 * Callers must persist `rng.getState()` into `meta.rngState` after this runs.
 */
export function runWorldPipeline(
  state: GameState,
  rng: Rng,
  command: WorldPipelineCommand,
): SystemResult {
  if (command.type !== "advanceDay") {
    return systemResult(state);
  }

  const result = advanceSimulation(state, rng, { days: 1 });
  return systemResult(result.state, result.events);
}
