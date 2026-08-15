import type { Rng } from "@/domain/rng";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { mergeDraftPicksForSeason } from "@/domain/draft-picks/generate-draft-picks";
import { generateRosters } from "@/systems/roster-generation";
import { advanceSimulation } from "@/systems/simulation/advance-simulation";

export type WorldPipelineCommand = {
  type: "advanceDay";
};

/**
 * Ensures roster and draft picks exist (world-gen bootstrap).
 * Does not generate the regular-season schedule — that is owned by season lifecycle.
 * Idempotent; safe before advance day or on new save creation.
 */
export function bootstrapWorld(state: GameState, rng: Rng): SystemResult {
  const afterRosters = generateRosters(state, rng);
  const afterPicks = ensureDraftPicks(afterRosters.state);
  return systemResult(afterPicks, afterRosters.events);
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
