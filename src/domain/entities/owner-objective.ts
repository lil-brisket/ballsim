import type { OwnerObjectiveId } from "@/domain/ids";

export type OwnerObjectiveStatus = "active" | "completed" | "failed";

export const OWNER_OBJECTIVE_STATUSES: readonly OwnerObjectiveStatus[] = [
  "active",
  "completed",
  "failed",
];

export function isOwnerObjectiveStatus(
  value: string,
): value is OwnerObjectiveStatus {
  return OWNER_OBJECTIVE_STATUSES.includes(value as OwnerObjectiveStatus);
}

export type OwnerObjectiveType =
  | "make_playoffs"
  | "win_championship"
  | "minimum_win_total"
  | "improve_finances"
  | "develop_young_players"
  | "roster_direction"
  | "playoff_round"
  | "payroll_limit";

export const OWNER_OBJECTIVE_TYPES: readonly OwnerObjectiveType[] = [
  "make_playoffs",
  "win_championship",
  "minimum_win_total",
  "improve_finances",
  "develop_young_players",
  "roster_direction",
  "playoff_round",
  "payroll_limit",
];

export function isOwnerObjectiveType(
  value: string,
): value is OwnerObjectiveType {
  return OWNER_OBJECTIVE_TYPES.includes(value as OwnerObjectiveType);
}

export type OwnerObjective = {
  id: OwnerObjectiveId;
  type: OwnerObjectiveType;
  description: string;
  status: OwnerObjectiveStatus;
  seasonYear: number;
  target?: number;
  progress?: number;
  consequenceApplied: boolean;
};

/** Unvalidated construction payload for {@link createOwnerObjective}. */
export type OwnerObjectiveInput = {
  id: OwnerObjectiveId;
  type: OwnerObjectiveType;
  description: string;
  status: OwnerObjectiveStatus;
  seasonYear: number;
  target?: number;
  progress?: number;
  consequenceApplied: boolean;
};

/**
 * Validates input and returns a new plain OwnerObjective.
 * Structural construction only — does not calculate or infer progress,
 * status, or target from game state. Does not enforce objective-type-
 * specific business rules (e.g. required target for minimum_win_total).
 */
export function createOwnerObjective(input: OwnerObjectiveInput): OwnerObjective {
  assertNonEmptyId(input.id, "id");
  assertObjectiveType(input.type);
  assertNonEmptyDescription(input.description);
  assertObjectiveStatus(input.status);
  assertSeasonYear(input.seasonYear);
  if (typeof input.consequenceApplied !== "boolean") {
    throw new Error("OwnerObjective consequenceApplied must be a boolean.");
  }
  if (input.target !== undefined) {
    assertFiniteNumber(input.target, "target");
  }
  if (input.progress !== undefined) {
    assertFiniteNumber(input.progress, "progress");
    if (input.progress < 0) {
      throw new Error("OwnerObjective progress must be >= 0.");
    }
  }

  const objective: OwnerObjective = {
    id: input.id,
    type: input.type,
    description: input.description,
    status: input.status,
    seasonYear: input.seasonYear,
    consequenceApplied: input.consequenceApplied,
  };
  if (input.target !== undefined) {
    objective.target = input.target;
  }
  if (input.progress !== undefined) {
    objective.progress = input.progress;
  }
  return objective;
}

function assertNonEmptyId(value: string, field: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`OwnerObjective ${field} must be a non-empty string.`);
  }
  if (value.trim().length === 0) {
    throw new Error(`OwnerObjective ${field} cannot be whitespace-only.`);
  }
}

function assertNonEmptyDescription(value: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("OwnerObjective description must be a non-empty string.");
  }
  if (value.trim().length === 0) {
    throw new Error("OwnerObjective description cannot be whitespace-only.");
  }
}

function assertObjectiveType(value: string): void {
  if (!isOwnerObjectiveType(value)) {
    throw new Error(
      `OwnerObjective type must be one of ${OWNER_OBJECTIVE_TYPES.join(", ")}.`,
    );
  }
}

function assertObjectiveStatus(value: string): void {
  if (!isOwnerObjectiveStatus(value)) {
    throw new Error(
      `OwnerObjective status must be one of ${OWNER_OBJECTIVE_STATUSES.join(", ")}.`,
    );
  }
}

function assertSeasonYear(year: number): void {
  if (typeof year !== "number" || !Number.isFinite(year)) {
    throw new Error("OwnerObjective seasonYear must be a finite number.");
  }
  if (!Number.isInteger(year)) {
    throw new Error("OwnerObjective seasonYear must be an integer.");
  }
}

function assertFiniteNumber(value: number, field: string): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`OwnerObjective ${field} must be a finite number.`);
  }
}
