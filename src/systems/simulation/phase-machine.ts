import type { SeasonPhase } from "@/domain/entities/season";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";

/**
 * Structurally valid season-phase transitions.
 * Competition-specific "should we transition?" logic belongs in season-lifecycle.
 */
export const VALID_PHASE_TRANSITIONS: Readonly<
  Record<SeasonPhase, readonly SeasonPhase[]>
> = {
  preseason: ["regular"],
  regular: ["playoffs", "postseason"],
  playoffs: ["postseason"],
  postseason: ["offseason"],
  offseason: ["preseason"],
};

export function isValidPhaseTransition(
  from: SeasonPhase,
  to: SeasonPhase,
): boolean {
  return VALID_PHASE_TRANSITIONS[from].includes(to);
}

/**
 * Sole writer of competition.season.phase.
 * Throws on structurally invalid transitions.
 */
export function transitionPhase(
  state: GameState,
  nextPhase: SeasonPhase,
): SystemResult {
  const currentPhase = state.competition.season.phase;
  if (currentPhase === nextPhase) {
    return systemResult(state);
  }
  if (!isValidPhaseTransition(currentPhase, nextPhase)) {
    throw new Error(
      `Invalid season phase transition: "${currentPhase}" → "${nextPhase}".`,
    );
  }
  return systemResult({
    ...state,
    competition: {
      ...state.competition,
      season: {
        ...state.competition.season,
        phase: nextPhase,
      },
    },
  });
}
