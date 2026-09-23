/**
 * Optional in-process fail-fast for overlapping time-advance requests.
 *
 * NOT a substitute for SaveGameStore ifUpdatedAt CAS — that is the
 * save-level commit guard. This map only avoids burning CPU on a second
 * simulation in the same Node process when one is already running.
 */

const inFlightBySaveId = new Map<string, Promise<unknown>>();

export class SimulationInFlightError extends Error {
  readonly saveId: string;

  constructor(saveId: string) {
    super("Simulation already in progress for this save.");
    this.name = "SimulationInFlightError";
    this.saveId = saveId;
  }
}

export function isSimulationInFlight(error: unknown): boolean {
  return error instanceof SimulationInFlightError;
}

/**
 * Run fn exclusively for saveId within this process.
 * Concurrent callers receive SimulationInFlightError immediately.
 */
export async function runWithSimulationDedupe<T>(
  saveId: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (inFlightBySaveId.has(saveId)) {
    throw new SimulationInFlightError(saveId);
  }
  const pending = fn().finally(() => {
    if (inFlightBySaveId.get(saveId) === pending) {
      inFlightBySaveId.delete(saveId);
    }
  });
  inFlightBySaveId.set(saveId, pending);
  return pending;
}

/** Test-only: clear in-flight map between tests. */
export function resetSimulationDedupeForTests(): void {
  inFlightBySaveId.clear();
}
