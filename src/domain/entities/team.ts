import { RATING_MAX, RATING_MIN } from "@/domain/entities/player";
import type {
  ArenaId,
  ConferenceId,
  DivisionId,
  PlayerId,
  StaffId,
  TeamId,
} from "@/domain/ids";

/** Placeholder for future team-owned financial state. */
export type TeamFinanceState = Record<never, never>;

export type Team = {
  id: TeamId;
  name: string;
  city: string;
  abbreviation: string;
  conferenceId: ConferenceId;
  divisionId: DivisionId;
  roster: PlayerId[];
  staff: StaffId[];
  finances: TeamFinanceState;
  arenaId: ArenaId;
  reputation: number;
};

/** Unvalidated construction payload for {@link createTeam}. */
export type TeamInput = {
  id: TeamId;
  name: string;
  city: string;
  abbreviation: string;
  conferenceId: ConferenceId;
  divisionId: DivisionId;
  roster: PlayerId[];
  staff: StaffId[];
  finances: TeamFinanceState;
  arenaId: ArenaId;
  reputation: number;
};

/**
 * Validates input and returns a new plain Team.
 * Does not mutate input. Rejects invalid values (no clamping or normalization).
 */
export function createTeam(input: TeamInput): Team {
  assertNonEmptyId(input.id, "id");
  assertNonEmptyName(input.name, "name");
  assertNonEmptyName(input.city, "city");
  assertNonEmptyName(input.abbreviation, "abbreviation");
  assertNonEmptyId(input.conferenceId, "conferenceId");
  assertNonEmptyId(input.divisionId, "divisionId");
  assertIdList(input.roster, "roster");
  assertIdList(input.staff, "staff");
  assertFinances(input.finances);
  assertNonEmptyId(input.arenaId, "arenaId");
  assertRating(input.reputation, "reputation");

  return {
    id: input.id,
    name: input.name,
    city: input.city,
    abbreviation: input.abbreviation,
    conferenceId: input.conferenceId,
    divisionId: input.divisionId,
    roster: [...input.roster],
    staff: [...input.staff],
    finances: { ...input.finances },
    arenaId: input.arenaId,
    reputation: input.reputation,
  };
}

function assertNonEmptyId(value: string, field: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Team ${field} must be a non-empty string.`);
  }
}

function assertNonEmptyName(value: string, field: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Team ${field} must be a non-empty string.`);
  }
  if (value.trim().length === 0) {
    throw new Error(`Team ${field} cannot be whitespace-only.`);
  }
}

function assertIdList(value: unknown, field: string): void {
  if (!Array.isArray(value)) {
    throw new Error(`Team ${field} must be an array.`);
  }
  const seen = new Set<string>();
  for (const id of value) {
    if (typeof id !== "string" || id.length === 0) {
      throw new Error(`Team ${field} must not contain empty ids.`);
    }
    if (seen.has(id)) {
      throw new Error(`Team ${field} contains duplicate ids.`);
    }
    seen.add(id);
  }
}

function assertFinances(value: unknown): void {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Team finances must be an object.");
  }
}

function assertRating(value: number, field: string): void {
  if (
    !Number.isInteger(value) ||
    value < RATING_MIN ||
    value > RATING_MAX
  ) {
    throw new Error(
      `Team ${field} must be an integer between ${RATING_MIN} and ${RATING_MAX}.`,
    );
  }
}
