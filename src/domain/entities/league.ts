import type { ConferenceId, LeagueId } from "@/domain/ids";

export type League = {
  id: LeagueId;
  name: string;
  abbreviation: string;
  conferenceIds: ConferenceId[];
};

/** Unvalidated construction payload for {@link createLeague}. */
export type LeagueInput = {
  id: LeagueId;
  name: string;
  abbreviation: string;
  conferenceIds: ConferenceId[];
};

/**
 * Validates input and returns a new plain League.
 * Does not mutate input. Rejects invalid values (no clamping or normalization).
 */
export function createLeague(input: LeagueInput): League {
  assertNonEmptyId(input.id, "id");
  assertNonEmptyName(input.name, "name");
  assertNonEmptyName(input.abbreviation, "abbreviation");
  assertIdList(input.conferenceIds, "conferenceIds");

  return {
    id: input.id,
    name: input.name,
    abbreviation: input.abbreviation,
    conferenceIds: [...input.conferenceIds],
  };
}

function assertNonEmptyId(value: string, field: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`League ${field} must be a non-empty string.`);
  }
}

function assertNonEmptyName(value: string, field: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`League ${field} must be a non-empty string.`);
  }
  if (value.trim().length === 0) {
    throw new Error(`League ${field} cannot be whitespace-only.`);
  }
}

function assertIdList(value: unknown, field: string): void {
  if (!Array.isArray(value)) {
    throw new Error(`League ${field} must be an array.`);
  }
  const seen = new Set<string>();
  for (const id of value) {
    if (typeof id !== "string" || id.length === 0) {
      throw new Error(`League ${field} must not contain empty ids.`);
    }
    if (seen.has(id)) {
      throw new Error(`League ${field} contains duplicate ids.`);
    }
    seen.add(id);
  }
}
