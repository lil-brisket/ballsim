import type { PlayerId } from "@/domain/ids";

export type FoulType = "shooting" | "non-shooting";

export const FOUL_TYPES: readonly FoulType[] = ["shooting", "non-shooting"];

export type Foul = {
  foulingPlayerId: PlayerId;
  fouledPlayerId: PlayerId;
  foulType: FoulType;
};

/** Unvalidated construction payload for {@link createFoul}. */
export type FoulInput = {
  foulingPlayerId: PlayerId;
  fouledPlayerId: PlayerId;
  foulType: FoulType;
};

/**
 * Validates input and returns a new plain Foul.
 * Does not mutate input. Rejects invalid values (no clamping or normalization).
 */
export function createFoul(input: FoulInput): Foul {
  assertNonEmptyId(input.foulingPlayerId, "foulingPlayerId");
  assertNonEmptyId(input.fouledPlayerId, "fouledPlayerId");
  assertDistinctPlayers(input.foulingPlayerId, input.fouledPlayerId);
  assertFoulType(input.foulType);

  return {
    foulingPlayerId: input.foulingPlayerId,
    fouledPlayerId: input.fouledPlayerId,
    foulType: input.foulType,
  };
}

function assertNonEmptyId(value: string, field: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Foul ${field} must be a non-empty string.`);
  }
  if (value.trim().length === 0) {
    throw new Error(`Foul ${field} cannot be whitespace-only.`);
  }
}

function assertDistinctPlayers(
  foulingPlayerId: PlayerId,
  fouledPlayerId: PlayerId,
): void {
  if (foulingPlayerId === fouledPlayerId) {
    throw new Error(
      "Foul foulingPlayerId and fouledPlayerId must be different.",
    );
  }
}

function assertFoulType(value: string): void {
  if (!FOUL_TYPES.includes(value as FoulType)) {
    throw new Error(`Foul foulType must be one of ${FOUL_TYPES.join(", ")}.`);
  }
}
