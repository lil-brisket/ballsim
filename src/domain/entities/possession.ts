import type { PlayerId, PossessionId } from "@/domain/ids";

export type PossessionAction = "shot" | "pass" | "turnover" | "foul";

export const POSSESSION_ACTIONS: readonly PossessionAction[] = [
  "shot",
  "pass",
  "turnover",
  "foul",
];

export type PossessionOutcome =
  | "shot_made"
  | "shot_missed"
  | "pass_completed"
  | "turnover"
  | "offensive_foul"
  | "defensive_foul";

export const POSSESSION_OUTCOMES: readonly PossessionOutcome[] = [
  "shot_made",
  "shot_missed",
  "pass_completed",
  "turnover",
  "offensive_foul",
  "defensive_foul",
];

const COMPATIBLE_OUTCOMES: Record<
  PossessionAction,
  readonly PossessionOutcome[]
> = {
  shot: ["shot_made", "shot_missed"],
  pass: ["pass_completed"],
  turnover: ["turnover"],
  foul: ["offensive_foul", "defensive_foul"],
};

export type Possession = {
  id: PossessionId;
  offensivePlayerId: PlayerId;
  defensivePlayerId: PlayerId | null;
  action: PossessionAction;
  outcome: PossessionOutcome;
};

/** Unvalidated construction payload for {@link createPossession}. */
export type PossessionInput = {
  id: PossessionId;
  offensivePlayerId: PlayerId;
  defensivePlayerId: PlayerId | null;
  action: PossessionAction;
  outcome: PossessionOutcome;
};

/**
 * Validates input and returns a new plain Possession.
 * Does not mutate input. Rejects invalid values (no clamping or normalization).
 */
export function createPossession(input: PossessionInput): Possession {
  assertNonEmptyId(input.id, "id");
  assertNonEmptyId(input.offensivePlayerId, "offensivePlayerId");
  assertOptionalId(input.defensivePlayerId, "defensivePlayerId");
  assertDistinctPlayers(input.offensivePlayerId, input.defensivePlayerId);
  assertAction(input.action);
  assertOutcome(input.outcome);
  assertCompatibleOutcome(input.action, input.outcome);

  return {
    id: input.id,
    offensivePlayerId: input.offensivePlayerId,
    defensivePlayerId: input.defensivePlayerId,
    action: input.action,
    outcome: input.outcome,
  };
}

function assertNonEmptyId(value: string, field: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Possession ${field} must be a non-empty string.`);
  }
  if (value.trim().length === 0) {
    throw new Error(`Possession ${field} cannot be whitespace-only.`);
  }
}

function assertOptionalId(value: string | null, field: string): void {
  if (value === null) {
    return;
  }
  assertNonEmptyId(value, field);
}

function assertDistinctPlayers(
  offensivePlayerId: PlayerId,
  defensivePlayerId: PlayerId | null,
): void {
  if (defensivePlayerId !== null && offensivePlayerId === defensivePlayerId) {
    throw new Error(
      "Possession offensivePlayerId and defensivePlayerId must be different.",
    );
  }
}

function assertAction(value: string): void {
  if (!POSSESSION_ACTIONS.includes(value as PossessionAction)) {
    throw new Error(
      `Possession action must be one of ${POSSESSION_ACTIONS.join(", ")}.`,
    );
  }
}

function assertOutcome(value: string): void {
  if (!POSSESSION_OUTCOMES.includes(value as PossessionOutcome)) {
    throw new Error(
      `Possession outcome must be one of ${POSSESSION_OUTCOMES.join(", ")}.`,
    );
  }
}

function assertCompatibleOutcome(
  action: PossessionAction,
  outcome: PossessionOutcome,
): void {
  const compatible = COMPATIBLE_OUTCOMES[action];
  if (!compatible.includes(outcome)) {
    throw new Error(
      `Possession outcome "${outcome}" is not compatible with action "${action}".`,
    );
  }
}
