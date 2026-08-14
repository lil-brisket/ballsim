import type { ConferenceId, DivisionId, LeagueId } from "@/domain/ids";

export type Conference = {
  id: ConferenceId;
  leagueId: LeagueId;
  name: string;
  divisionIds: DivisionId[];
};

/** Unvalidated construction payload for {@link createConference}. */
export type ConferenceInput = {
  id: ConferenceId;
  leagueId: LeagueId;
  name: string;
  divisionIds: DivisionId[];
};

/**
 * Validates input and returns a new plain Conference.
 * Does not mutate input. Rejects invalid values (no clamping or normalization).
 */
export function createConference(input: ConferenceInput): Conference {
  assertNonEmptyId(input.id, "id");
  assertNonEmptyId(input.leagueId, "leagueId");
  assertNonEmptyName(input.name, "name");
  assertIdList(input.divisionIds, "divisionIds");

  return {
    id: input.id,
    leagueId: input.leagueId,
    name: input.name,
    divisionIds: [...input.divisionIds],
  };
}

function assertNonEmptyId(value: string, field: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Conference ${field} must be a non-empty string.`);
  }
}

function assertNonEmptyName(value: string, field: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Conference ${field} must be a non-empty string.`);
  }
  if (value.trim().length === 0) {
    throw new Error(`Conference ${field} cannot be whitespace-only.`);
  }
}

function assertIdList(value: unknown, field: string): void {
  if (!Array.isArray(value)) {
    throw new Error(`Conference ${field} must be an array.`);
  }
  const seen = new Set<string>();
  for (const id of value) {
    if (typeof id !== "string" || id.length === 0) {
      throw new Error(`Conference ${field} must not contain empty ids.`);
    }
    if (seen.has(id)) {
      throw new Error(`Conference ${field} contains duplicate ids.`);
    }
    seen.add(id);
  }
}
