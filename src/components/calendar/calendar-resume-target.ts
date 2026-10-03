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
  if (input.stopReason !== "pending_owner_decision") {
    return null;
  }
  return requested;
}
