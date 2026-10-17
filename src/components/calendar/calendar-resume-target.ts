import { isOwnerInterruptStopReason } from "@/systems/simulation/types";

const STORAGE_PREFIX = "bball.calendarResumeTo.";

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function storageKey(saveId: string): string {
  return `${STORAGE_PREFIX}${saveId}`;
}

export function readCalendarResumeTarget(saveId: string): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const value = window.sessionStorage.getItem(storageKey(saveId));
    return value && isIsoDate(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeCalendarResumeTarget(
  saveId: string,
  date: string | null,
): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (!date || !isIsoDate(date)) {
      window.sessionStorage.removeItem(storageKey(saveId));
      return;
    }
    window.sessionStorage.setItem(storageKey(saveId), date);
  } catch {
    // Ignore quota / private-mode failures.
  }
}

const WATCH_STORAGE_PREFIX = "bball.calendarWatchTarget.";

export type CalendarWatchTarget = { gameId: string; gameDate: string };

function watchStorageKey(saveId: string): string {
  return `${WATCH_STORAGE_PREFIX}${saveId}`;
}

export function readCalendarWatchTarget(
  saveId: string,
): CalendarWatchTarget | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(watchStorageKey(saveId));
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }
    const { gameId, gameDate } = parsed as Record<string, unknown>;
    if (
      typeof gameId !== "string" ||
      gameId.length === 0 ||
      typeof gameDate !== "string" ||
      !isIsoDate(gameDate)
    ) {
      return null;
    }
    return { gameId, gameDate };
  } catch {
    return null;
  }
}

export function writeCalendarWatchTarget(
  saveId: string,
  target: CalendarWatchTarget | null,
): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (!target || !target.gameId || !isIsoDate(target.gameDate)) {
      window.sessionStorage.removeItem(watchStorageKey(saveId));
      return;
    }
    window.sessionStorage.setItem(
      watchStorageKey(saveId),
      JSON.stringify({ gameId: target.gameId, gameDate: target.gameDate }),
    );
  } catch {
    // Ignore quota / private-mode failures.
  }
}

export function remainingSimulateTarget(input: {
  requestedTargetDate?: string | null;
  currentDate: string;
  stopReason?: string | null;
}): string | null {
  const requested = input.requestedTargetDate;
  if (!requested || !isIsoDate(requested)) {
    return null;
  }
  if (requested <= input.currentDate) {
    return null;
  }
  if (!isOwnerInterruptStopReason(input.stopReason)) {
    return null;
  }
  return requested;
}
