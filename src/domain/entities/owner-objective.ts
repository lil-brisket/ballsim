import type { OwnerObjectiveId } from "@/domain/ids";

export type OwnerObjectiveType =
  | "make_playoffs"
  | "win_championship"
  | "minimum_win_total"
  | "improve_finances"
  | "develop_young_players"
  | "roster_direction";

export const OWNER_OBJECTIVE_TYPES: readonly OwnerObjectiveType[] = [
  "make_playoffs",
  "win_championship",
  "minimum_win_total",
  "improve_finances",
  "develop_young_players",
  "roster_direction",
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
  target?: number;
  progress?: number;
  completed: boolean;
};

/** Unvalidated construction payload for {@link createOwnerObjective}. */
export type OwnerObjectiveInput = {
  id: OwnerObjectiveId;
  type: OwnerObjectiveType;
  description: string;
  target?: number;
  progress?: number;
  completed: boolean;
};

/**
 * Validates input and returns a new plain OwnerObjective.
 * Structural construction only — does not calculate or infer progress,
 * completed, or target from game state. Does not enforce objective-type-
 * specific business rules (e.g. required target for minimum_win_total).
 */
export function createOwnerObjective(input: OwnerObjectiveInput): OwnerObjective {
  assertNonEmptyId(input.id, "id");
  assertObjectiveType(input.type);
  assertNonEmptyDescription(input.description);
  if (input.target !== undefined) {
    assertFiniteNumber(input.target, "target");
  }
  if (input.progress !== undefined) {
    assertFiniteNumber(input.progress, "progress");
    if (input.progress < 0) {
      throw new Error("OwnerObjective progress must be >= 0.");
    }
  }
  if (typeof input.completed !== "boolean") {
    throw new Error("OwnerObjective completed must be a boolean.");
  }

  const objective: OwnerObjective = {
    id: input.id,
    type: input.type,
    description: input.description,
    completed: input.completed,
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

function assertFiniteNumber(value: number, field: string): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`OwnerObjective ${field} must be a finite number.`);
  }
}
