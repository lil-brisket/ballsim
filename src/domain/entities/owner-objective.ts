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

export type OwnerObjectiveCategory =
  | "financial"
  | "competitive"
  | "franchise"
  | "strategic"
  | "long_term";

export const OWNER_OBJECTIVE_CATEGORIES: readonly OwnerObjectiveCategory[] = [
  "financial",
  "competitive",
  "franchise",
  "strategic",
  "long_term",
] as const;

export function isOwnerObjectiveCategory(
  value: string,
): value is OwnerObjectiveCategory {
  return OWNER_OBJECTIVE_CATEGORIES.includes(value as OwnerObjectiveCategory);
}

export type OwnerObjectiveLifecycle =
  | "seasonal"
  | "multi_season"
  | "career"
  | "milestone";

export const OWNER_OBJECTIVE_LIFECYCLES: readonly OwnerObjectiveLifecycle[] = [
  "seasonal",
  "multi_season",
  "career",
  "milestone",
] as const;

export function isOwnerObjectiveLifecycle(
  value: string,
): value is OwnerObjectiveLifecycle {
  return OWNER_OBJECTIVE_LIFECYCLES.includes(value as OwnerObjectiveLifecycle);
}

export type OwnerObjectiveRole = "primary" | "secondary" | "long_term";

export const OWNER_OBJECTIVE_ROLES: readonly OwnerObjectiveRole[] = [
  "primary",
  "secondary",
  "long_term",
] as const;

export function isOwnerObjectiveRole(
  value: string,
): value is OwnerObjectiveRole {
  return OWNER_OBJECTIVE_ROLES.includes(value as OwnerObjectiveRole);
}

export type OwnerObjectiveType =
  | "make_playoffs"
  | "win_championship"
  | "minimum_win_total"
  | "improve_finances"
  | "develop_young_players"
  | "roster_direction"
  | "playoff_round"
  | "payroll_limit"
  | "franchise_value"
  | "revenue_target"
  | "positive_cash"
  | "playoff_seed"
  | "attendance"
  | "fan_sentiment"
  | "awareness"
  | "reputation"
  | "arena_level"
  | "championship_count"
  | "playoff_count";

export const OWNER_OBJECTIVE_TYPES: readonly OwnerObjectiveType[] = [
  "make_playoffs",
  "win_championship",
  "minimum_win_total",
  "improve_finances",
  "develop_young_players",
  "roster_direction",
  "playoff_round",
  "payroll_limit",
  "franchise_value",
  "revenue_target",
  "positive_cash",
  "playoff_seed",
  "attendance",
  "fan_sentiment",
  "awareness",
  "reputation",
  "arena_level",
  "championship_count",
  "playoff_count",
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
  category: OwnerObjectiveCategory;
  lifecycle: OwnerObjectiveLifecycle;
  role: OwnerObjectiveRole;
  target?: number;
  progress?: number;
  /** Seasons spanned for multi_season objectives (inclusive of start). */
  horizonYears?: number;
  /** Starting metric for delta-based objectives (value growth, youth core, etc.). */
  baseline?: number;
  consequenceApplied: boolean;
};

/** Unvalidated construction payload for {@link createOwnerObjective}. */
export type OwnerObjectiveInput = {
  id: OwnerObjectiveId;
  type: OwnerObjectiveType;
  description: string;
  status: OwnerObjectiveStatus;
  seasonYear: number;
  category: OwnerObjectiveCategory;
  lifecycle: OwnerObjectiveLifecycle;
  role: OwnerObjectiveRole;
  target?: number;
  progress?: number;
  horizonYears?: number;
  baseline?: number;
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
  assertCategory(input.category);
  assertLifecycle(input.lifecycle);
  assertRole(input.role);
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
  if (input.horizonYears !== undefined) {
    assertFiniteNumber(input.horizonYears, "horizonYears");
    if (!Number.isInteger(input.horizonYears) || input.horizonYears < 1) {
      throw new Error("OwnerObjective horizonYears must be an integer >= 1.");
    }
  }
  if (input.baseline !== undefined) {
    assertFiniteNumber(input.baseline, "baseline");
  }

  const objective: OwnerObjective = {
    id: input.id,
    type: input.type,
    description: input.description,
    status: input.status,
    seasonYear: input.seasonYear,
    category: input.category,
    lifecycle: input.lifecycle,
    role: input.role,
    consequenceApplied: input.consequenceApplied,
  };
  if (input.target !== undefined) {
    objective.target = input.target;
  }
  if (input.progress !== undefined) {
    objective.progress = input.progress;
  }
  if (input.horizonYears !== undefined) {
    objective.horizonYears = input.horizonYears;
  }
  if (input.baseline !== undefined) {
    objective.baseline = input.baseline;
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

function assertCategory(value: string): void {
  if (!isOwnerObjectiveCategory(value)) {
    throw new Error(
      `OwnerObjective category must be one of ${OWNER_OBJECTIVE_CATEGORIES.join(", ")}.`,
    );
  }
}

function assertLifecycle(value: string): void {
  if (!isOwnerObjectiveLifecycle(value)) {
    throw new Error(
      `OwnerObjective lifecycle must be one of ${OWNER_OBJECTIVE_LIFECYCLES.join(", ")}.`,
    );
  }
}

function assertRole(value: string): void {
  if (!isOwnerObjectiveRole(value)) {
    throw new Error(
      `OwnerObjective role must be one of ${OWNER_OBJECTIVE_ROLES.join(", ")}.`,
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
