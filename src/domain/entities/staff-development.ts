export type StaffDevelopmentTrend =
  | "improving"
  | "stable"
  | "declining";

export const STAFF_DEVELOPMENT_TRENDS: readonly StaffDevelopmentTrend[] = [
  "improving",
  "stable",
  "declining",
] as const;

export type StaffDevelopmentState = {
  trend: StaffDevelopmentTrend;
  lastOverallDelta: number;
  seasonsAtOverall: number;
  /** Seasons employed in the current role on the current team (or FA). */
  timeInRole: number;
};

export type StaffCareerEventKind =
  | "joined"
  | "promoted"
  | "moved"
  | "fired"
  | "retired";

export const STAFF_CAREER_EVENT_KINDS: readonly StaffCareerEventKind[] = [
  "joined",
  "promoted",
  "moved",
  "fired",
  "retired",
] as const;

/** Major career events only — not routine renewals. */
export type StaffCareerEntry = {
  seasonYear: number;
  teamId: string | null;
  role: string;
  overall: number;
  kind: StaffCareerEventKind;
  note?: string;
};

export const STAFF_CAREER_HISTORY_MAX = 40;

export function createDefaultStaffDevelopment(): StaffDevelopmentState {
  return {
    trend: "stable",
    lastOverallDelta: 0,
    seasonsAtOverall: 0,
    timeInRole: 0,
  };
}

export function assertStaffDevelopmentShape(
  state: StaffDevelopmentState,
): void {
  if (
    typeof state.trend !== "string" ||
    !(STAFF_DEVELOPMENT_TRENDS as readonly string[]).includes(state.trend)
  ) {
    throw new Error(
      `StaffDevelopment trend must be one of ${STAFF_DEVELOPMENT_TRENDS.join(", ")}.`,
    );
  }
  if (
    typeof state.lastOverallDelta !== "number" ||
    !Number.isInteger(state.lastOverallDelta)
  ) {
    throw new Error("StaffDevelopment lastOverallDelta must be an integer.");
  }
  if (
    typeof state.seasonsAtOverall !== "number" ||
    !Number.isInteger(state.seasonsAtOverall) ||
    state.seasonsAtOverall < 0
  ) {
    throw new Error(
      "StaffDevelopment seasonsAtOverall must be a non-negative integer.",
    );
  }
  if (
    typeof state.timeInRole !== "number" ||
    !Number.isInteger(state.timeInRole) ||
    state.timeInRole < 0
  ) {
    throw new Error(
      "StaffDevelopment timeInRole must be a non-negative integer.",
    );
  }
}

export function assertStaffCareerEntryShape(entry: StaffCareerEntry): void {
  if (
    typeof entry.seasonYear !== "number" ||
    !Number.isInteger(entry.seasonYear)
  ) {
    throw new Error("StaffCareerEntry seasonYear must be an integer.");
  }
  if (entry.teamId !== null && typeof entry.teamId !== "string") {
    throw new Error("StaffCareerEntry teamId must be a string or null.");
  }
  if (typeof entry.role !== "string" || entry.role.length === 0) {
    throw new Error("StaffCareerEntry role must be a non-empty string.");
  }
  if (
    typeof entry.overall !== "number" ||
    !Number.isInteger(entry.overall)
  ) {
    throw new Error("StaffCareerEntry overall must be an integer.");
  }
  if (
    typeof entry.kind !== "string" ||
    !(STAFF_CAREER_EVENT_KINDS as readonly string[]).includes(entry.kind)
  ) {
    throw new Error(
      `StaffCareerEntry kind must be one of ${STAFF_CAREER_EVENT_KINDS.join(", ")}.`,
    );
  }
}

export function appendCareerEntry(
  history: readonly StaffCareerEntry[],
  entry: StaffCareerEntry,
): StaffCareerEntry[] {
  assertStaffCareerEntryShape(entry);
  const next = [...history, entry];
  if (next.length <= STAFF_CAREER_HISTORY_MAX) {
    return next;
  }
  return next.slice(next.length - STAFF_CAREER_HISTORY_MAX);
}
