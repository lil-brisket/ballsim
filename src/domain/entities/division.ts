import type { ConferenceId, DivisionId, TeamId } from "@/domain/ids";

export type Division = {
  id: DivisionId;
  conferenceId: ConferenceId;
  name: string;
  teamIds: TeamId[];
};

/** Unvalidated construction payload for {@link createDivision}. */
export type DivisionInput = {
  id: DivisionId;
  conferenceId: ConferenceId;
  name: string;
  teamIds: TeamId[];
};

/**
 * Validates input and returns a new plain Division.
 * Does not mutate input. Rejects invalid values (no clamping or normalization).
 */
export function createDivision(input: DivisionInput): Division {
  assertNonEmptyId(input.id, "id");
  assertNonEmptyId(input.conferenceId, "conferenceId");
  assertNonEmptyName(input.name, "name");
  assertIdList(input.teamIds, "teamIds");

  return {
    id: input.id,
    conferenceId: input.conferenceId,
    name: input.name,
    teamIds: [...input.teamIds],
  };
}

function assertNonEmptyId(value: string, field: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Division ${field} must be a non-empty string.`);
  }
}

function assertNonEmptyName(value: string, field: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Division ${field} must be a non-empty string.`);
  }
  if (value.trim().length === 0) {
    throw new Error(`Division ${field} cannot be whitespace-only.`);
  }
}

function assertIdList(value: unknown, field: string): void {
  if (!Array.isArray(value)) {
    throw new Error(`Division ${field} must be an array.`);
  }
  const seen = new Set<string>();
  for (const id of value) {
    if (typeof id !== "string" || id.length === 0) {
      throw new Error(`Division ${field} must not contain empty ids.`);
    }
    if (seen.has(id)) {
      throw new Error(`Division ${field} contains duplicate ids.`);
    }
    seen.add(id);
  }
}
