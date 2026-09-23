/**
 * Shared helpers for time-advance mutations that must commit with
 * optimistic concurrency (LoadedSaveGame.updatedAt as token).
 */

import {
  SAVE_VERSION_CONFLICT_USER_MESSAGE,
  isSaveVersionConflict,
} from "@/persistence/save-version-conflict";
import {
  SimulationInFlightError,
  isSimulationInFlight,
  runWithSimulationDedupe,
} from "@/application/simulation-guard";

export { SAVE_VERSION_CONFLICT_USER_MESSAGE };

export function mapTimeAdvancePersistenceError(error: unknown): string {
  if (isSaveVersionConflict(error)) {
    return SAVE_VERSION_CONFLICT_USER_MESSAGE;
  }
  if (isSimulationInFlight(error) || error instanceof SimulationInFlightError) {
    return "Simulation already in progress for this save.";
  }
  return error instanceof Error ? error.message : String(error);
}

/**
 * Optional same-process dedupe around a time-advance body.
 * Correctness still depends on ifUpdatedAt CAS at persist.
 */
export async function withTimeAdvanceDedupe<T>(
  saveId: string,
  fn: () => Promise<T>,
): Promise<T> {
  return runWithSimulationDedupe(saveId, fn);
}
