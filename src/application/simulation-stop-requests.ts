/**
 * In-process "stop simulating" flags for streamed calendar advances.
 *
 * Lives in the same process as {@link runWithSimulationDedupe}, which already
 * guarantees at most one advance per save here. The advance polls the flag
 * between days, so stopping keeps every completed day.
 */

import { isSimulationRunning } from "@/application/simulation-guard";

const stopRequestedBySaveId = new Set<string>();

/** Returns false when nothing is running, so a late click cannot stop the next run. */
export function requestSimulationStop(saveId: string): boolean {
  if (!isSimulationRunning(saveId)) {
    return false;
  }
  stopRequestedBySaveId.add(saveId);
  return true;
}

export function isSimulationStopRequested(saveId: string): boolean {
  return stopRequestedBySaveId.has(saveId);
}

export function clearSimulationStopRequest(saveId: string): void {
  stopRequestedBySaveId.delete(saveId);
}
