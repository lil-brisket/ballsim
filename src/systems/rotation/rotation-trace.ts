/**
 * Deterministic internal rotation / substitution trace for debugging.
 */

import type { PlayerId } from "@/domain/ids";

export type RotationTraceReason =
  | "starting_lineup"
  | "rotation_window"
  | "period_start"
  | "halftime"
  | "fatigue"
  | "foul_trouble"
  | "foul_out"
  | "injury"
  | "stagger"
  | "minute_balance"
  | "blowout_relief"
  | "closing_lineup"
  | "overtime"
  | "forced";

export type RotationTraceEntry = {
  sequence: number;
  periodNumber: number;
  /** Clock display helper: seconds remaining in period. */
  secondsRemaining: number;
  teamId: string;
  playerOutId: PlayerId | null;
  playerInId: PlayerId | null;
  reason: RotationTraceReason;
  detail?: string;
  forced: boolean;
};

export function formatTraceClock(
  periodNumber: number,
  secondsRemaining: number,
): string {
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = Math.floor(secondsRemaining % 60);
  const label =
    periodNumber <= 4 ? `Q${periodNumber}` : `OT${periodNumber - 4}`;
  return `${minutes}:${seconds.toString().padStart(2, "0")} ${label}`;
}

export function formatTraceEntry(entry: RotationTraceEntry): string {
  const clock = formatTraceClock(entry.periodNumber, entry.secondsRemaining);
  if (entry.playerOutId == null && entry.playerInId == null) {
    return `${clock} — ${entry.detail ?? entry.reason}`;
  }
  if (entry.playerOutId == null) {
    return `${clock} — IN ${entry.playerInId} — Reason: ${entry.reason}`;
  }
  if (entry.playerInId == null) {
    return `${clock} — OUT ${entry.playerOutId} — Reason: ${entry.reason}`;
  }
  return `${clock} — OUT ${entry.playerOutId}, IN ${entry.playerInId} — Reason: ${entry.reason}`;
}

export function createEmptyRotationTrace(): RotationTraceEntry[] {
  return [];
}

export function appendTraceEntry(
  trace: RotationTraceEntry[],
  entry: Omit<RotationTraceEntry, "sequence">,
): void {
  trace.push({
    ...entry,
    sequence: trace.length + 1,
  });
}
