import type { GameState } from "@/state/game-state";
import { getPhaseDefinition } from "@/systems/phase-engine/phase-definitions";
import { getActivePhaseId } from "@/systems/phase-engine/resolve-current-phase";
import type { AiPhaseRoutine } from "@/systems/phase-engine/phase-types";

/**
 * Which AI routines should run for the active league phase.
 */
export function aiRoutinesForActivePhase(
  state: GameState,
): readonly AiPhaseRoutine[] {
  return getPhaseDefinition(getActivePhaseId(state)).aiRoutines;
}

export function shouldRunAiRoutine(
  state: GameState,
  routine: AiPhaseRoutine,
): boolean {
  return aiRoutinesForActivePhase(state).includes(routine);
}

/** Free agency AI runs only during free_agency phase. */
export function isFreeAgencyAiPhase(state: GameState): boolean {
  return shouldRunAiRoutine(state, "free_agency");
}

/** Draft selection AI runs only during draft phase. */
export function isDraftAiPhase(state: GameState): boolean {
  return shouldRunAiRoutine(state, "draft");
}

/** Trade AI may run in multiple offseason management phases. */
export function isTradeAiPhase(state: GameState): boolean {
  return shouldRunAiRoutine(state, "trades");
}

export function isStaffAiPhase(state: GameState): boolean {
  return shouldRunAiRoutine(state, "staff");
}

export function isScoutAiPhase(state: GameState): boolean {
  return shouldRunAiRoutine(state, "scout");
}

export function isContractAiPhase(state: GameState): boolean {
  return shouldRunAiRoutine(state, "contracts");
}
