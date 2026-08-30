import type { ContractId, PlayerId, TeamId } from "@/domain/ids";
import {
  isPlayerArchetype,
  type PlayerArchetype,
} from "@/domain/entities/player-archetype";
import {
  isPlayerNationality,
  type PlayerNationality,
} from "@/domain/entities/player-nationality";

export const RATING_MIN = 1;
export const RATING_MAX = 99;

export type PlayerPosition = "PG" | "SG" | "SF" | "PF" | "C";

export const PLAYER_POSITIONS: readonly PlayerPosition[] = [
  "PG",
  "SG",
  "SF",
  "PF",
  "C",
];

export type { PlayerArchetype };
export type { PlayerNationality };

export type PlayerAttributes = {
  speed: number;
  strength: number;
  athleticism: number;
  stamina: number;
  finishing: number;
  midRange: number;
  threePoint: number;
  freeThrow: number;
  ballHandling: number;
  passing: number;
  perimeterDefense: number;
  interiorDefense: number;
  steal: number;
  block: number;
  rebounding: number;
  basketballIq: number;
  offensiveIq: number;
  defensiveIq: number;
  consistency: number;
};

export type PlayerPotential = {
  /** Developmental ceiling 1–99. */
  overall: number;
};

export type PlayerPersonality = {
  workEthic: number;
  loyalty: number;
  competitiveness: number;
  leadership: number;
  composure: number;
};

/**
 * Whether a player may take the floor — independent of injury detail and suspension.
 * Suspension is represented here as "suspended"; injury detail lives on {@link PlayerInjury}.
 */
export type PlayerAvailability =
  | "available"
  | "questionable"
  | "limited"
  | "out"
  | "suspended";

export const PLAYER_AVAILABILITIES: readonly PlayerAvailability[] = [
  "available",
  "questionable",
  "limited",
  "out",
  "suspended",
] as const;

export type InjurySeverity = "minor" | "moderate" | "major" | "unknown";

export const INJURY_SEVERITIES: readonly InjurySeverity[] = [
  "minor",
  "moderate",
  "major",
  "unknown",
] as const;

/**
 * Medical injury detail. Null when the player has no active injury.
 * Suspension is never stored here — use {@link PlayerSuspension}.
 */
export type PlayerInjury = {
  type: string;
  severity: InjurySeverity;
  gamesRemaining: { min: number; max: number } | null;
  /** Soft medical guidance — AI targets this when set. */
  recommendedWorkloadMpg: number | null;
  /** Hard safety cap — engine must not exceed unless medical override. */
  maximumWorkloadMpg: number | null;
  /** 0–1 recovery progress toward full availability. */
  recoveryProgress: number;
};

export type PlayerSuspension = {
  gamesRemaining: number;
};

/**
 * @deprecated Use {@link PlayerAvailability} + {@link PlayerInjury}. Kept for
 * type aliases during migration of legacy save payloads.
 */
export type InjuryStatus =
  | { kind: "healthy" }
  | { kind: "injured" };

export type DevelopmentStage = "developing" | "prime" | "declining";

export type DevelopmentState = {
  stage: DevelopmentStage;
};

export type Player = {
  id: PlayerId;
  teamId: TeamId | null;
  firstName: string;
  lastName: string;
  nationality: PlayerNationality;
  age: number;
  heightInches: number;
  weightPounds: number;
  position: PlayerPosition;
  archetype: PlayerArchetype;
  attributes: PlayerAttributes;
  potential: PlayerPotential;
  personality: PlayerPersonality;
  contractId: ContractId | null;
  /** Floor eligibility — separate from injury detail and suspension object. */
  availability: PlayerAvailability;
  /** Active injury detail, or null when healthy / no injury recorded. */
  injury: PlayerInjury | null;
  /** Independent of injury — a healthy player may still be suspended. */
  suspension: PlayerSuspension | null;
  development: DevelopmentState;
  /**
   * Irreversible retirement flag. Retired players cannot return to FA,
   * be traded, or be re-signed. Historical stats remain intact.
   */
  retired?: boolean;
};

/** Unvalidated construction payload for {@link createPlayer}. */
export type PlayerInput = {
  id: PlayerId;
  teamId: TeamId | null;
  firstName: string;
  lastName: string;
  nationality: PlayerNationality;
  age: number;
  heightInches: number;
  weightPounds: number;
  position: PlayerPosition;
  archetype: PlayerArchetype;
  attributes: PlayerAttributes;
  potential: PlayerPotential;
  personality: PlayerPersonality;
  contractId: ContractId | null;
  availability: PlayerAvailability;
  injury: PlayerInjury | null;
  suspension: PlayerSuspension | null;
  development: DevelopmentState;
  retired?: boolean;
};

/** Conservative migration of legacy binary `{ kind: "healthy" | "injured" }`. */
export function migrateLegacyInjuryStatus(
  legacy: InjuryStatus | null | undefined,
): {
  availability: PlayerAvailability;
  injury: PlayerInjury | null;
  suspension: null;
} {
  if (legacy == null || legacy.kind === "healthy") {
    return { availability: "available", injury: null, suspension: null };
  }
  return {
    availability: "out",
    injury: {
      type: "Undisclosed",
      severity: "unknown",
      gamesRemaining: null,
      recommendedWorkloadMpg: null,
      maximumWorkloadMpg: null,
      recoveryProgress: 0,
    },
    suspension: null,
  };
}

export function isPlayerAvailability(
  value: string,
): value is PlayerAvailability {
  return (PLAYER_AVAILABILITIES as readonly string[]).includes(value);
}

export function isInjurySeverity(value: string): value is InjurySeverity {
  return (INJURY_SEVERITIES as readonly string[]).includes(value);
}

/** True when the player is eligible to take the floor (may still have workload caps). */
export function playerCanPlay(player: Player): boolean {
  if (player.availability === "out" || player.availability === "suspended") {
    return false;
  }
  if (player.suspension != null && player.suspension.gamesRemaining > 0) {
    return false;
  }
  return true;
}

/** Display label for availability status. */
export function availabilityDisplayLabel(
  availability: PlayerAvailability,
): string {
  switch (availability) {
    case "available":
      return "Available";
    case "questionable":
      return "Questionable";
    case "limited":
      return "Limited";
    case "out":
      return "Out";
    case "suspended":
      return "Suspended";
  }
}

export const PLAYER_ATTRIBUTE_KEYS: readonly (keyof PlayerAttributes)[] = [
  "speed",
  "strength",
  "athleticism",
  "stamina",
  "finishing",
  "midRange",
  "threePoint",
  "freeThrow",
  "ballHandling",
  "passing",
  "perimeterDefense",
  "interiorDefense",
  "steal",
  "block",
  "rebounding",
  "basketballIq",
  "offensiveIq",
  "defensiveIq",
  "consistency",
];

const PERSONALITY_KEYS: readonly (keyof PlayerPersonality)[] = [
  "workEthic",
  "loyalty",
  "competitiveness",
  "leadership",
  "composure",
];

const DEVELOPMENT_STAGES: readonly DevelopmentStage[] = [
  "developing",
  "prime",
  "declining",
];

/**
 * Validates input and returns a new plain Player.
 * Does not mutate input. Rejects invalid values (no clamping or normalization).
 */
export function createPlayer(input: PlayerInput): Player {
  assertNonEmptyId(input.id, "id");
  assertOptionalId(input.teamId, "teamId");
  assertNonEmptyName(input.firstName, "firstName");
  assertNonEmptyName(input.lastName, "lastName");
  assertPlayerNationality(input.nationality);
  assertNonNegativeInteger(input.age, "age");
  assertPositiveFinite(input.heightInches, "heightInches");
  assertPositiveFinite(input.weightPounds, "weightPounds");
  assertPlayerPosition(input.position);
  assertPlayerArchetype(input.archetype);
  assertAttributes(input.attributes);
  assertPotential(input.potential);
  assertPersonality(input.personality);
  assertOptionalId(input.contractId, "contractId");
  assertAvailability(input.availability);
  assertPlayerInjury(input.injury);
  assertSuspension(input.suspension);
  assertDevelopment(input.development);

  return {
    id: input.id,
    teamId: input.teamId,
    firstName: input.firstName,
    lastName: input.lastName,
    nationality: input.nationality,
    age: input.age,
    heightInches: input.heightInches,
    weightPounds: input.weightPounds,
    position: input.position,
    archetype: input.archetype,
    attributes: { ...input.attributes },
    potential: { ...input.potential },
    personality: { ...input.personality },
    contractId: input.contractId,
    availability: input.availability,
    injury: input.injury == null ? null : { ...input.injury, gamesRemaining: input.injury.gamesRemaining == null ? null : { ...input.injury.gamesRemaining } },
    suspension:
      input.suspension == null ? null : { ...input.suspension },
    development: { ...input.development },
    retired: input.retired === true ? true : undefined,
  };
}

function assertNonEmptyId(value: string, field: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Player ${field} must be a non-empty string.`);
  }
}

function assertOptionalId(value: string | null, field: string): void {
  if (value === null) {
    return;
  }
  assertNonEmptyId(value, field);
}

function assertNonEmptyName(value: string, field: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Player ${field} must be a non-empty string.`);
  }
  if (value.trim().length === 0) {
    throw new Error(`Player ${field} cannot be whitespace-only.`);
  }
}

function assertNonNegativeInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Player ${field} must be a non-negative integer.`);
  }
}

function assertPositiveFinite(value: number, field: string): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`Player ${field} must be a finite number greater than 0.`);
  }
}

function assertPlayerPosition(value: string): void {
  if (!PLAYER_POSITIONS.includes(value as PlayerPosition)) {
    throw new Error(`Player position must be one of ${PLAYER_POSITIONS.join(", ")}.`);
  }
}

function assertPlayerArchetype(value: string): void {
  if (!isPlayerArchetype(value)) {
    throw new Error(
      `Player archetype must be a valid PlayerArchetype identifier.`,
    );
  }
}

function assertPlayerNationality(value: string): void {
  if (!isPlayerNationality(value)) {
    throw new Error(
      `Player nationality must be a valid PlayerNationality identifier.`,
    );
  }
}

function assertRating(value: number, field: string): void {
  if (
    !Number.isInteger(value) ||
    value < RATING_MIN ||
    value > RATING_MAX
  ) {
    throw new Error(
      `Player ${field} must be an integer between ${RATING_MIN} and ${RATING_MAX}.`,
    );
  }
}

function assertAttributes(attributes: PlayerAttributes): void {
  if (attributes === null || typeof attributes !== "object") {
    throw new Error("Player attributes must be an object.");
  }
  const knownKeys = new Set<string>(PLAYER_ATTRIBUTE_KEYS);
  for (const key of Object.keys(attributes)) {
    if (!knownKeys.has(key)) {
      throw new Error(`Player attributes contains unknown key "${key}".`);
    }
  }
  for (const key of PLAYER_ATTRIBUTE_KEYS) {
    assertRating(attributes[key], `attributes.${key}`);
  }
}

function assertPotential(potential: PlayerPotential): void {
  if (potential === null || typeof potential !== "object") {
    throw new Error("Player potential must be an object.");
  }
  assertRating(potential.overall, "potential.overall");
}

function assertPersonality(personality: PlayerPersonality): void {
  if (personality === null || typeof personality !== "object") {
    throw new Error("Player personality must be an object.");
  }
  for (const key of PERSONALITY_KEYS) {
    assertRating(personality[key], `personality.${key}`);
  }
}

function assertAvailability(availability: PlayerAvailability): void {
  if (!isPlayerAvailability(availability)) {
    throw new Error(
      `Player availability must be one of ${PLAYER_AVAILABILITIES.join(", ")}.`,
    );
  }
}

function assertPlayerInjury(injury: PlayerInjury | null): void {
  if (injury === null) {
    return;
  }
  if (typeof injury !== "object") {
    throw new Error("Player injury must be an object or null.");
  }
  if (typeof injury.type !== "string" || injury.type.trim().length === 0) {
    throw new Error("Player injury.type must be a non-empty string.");
  }
  if (!isInjurySeverity(injury.severity)) {
    throw new Error(
      `Player injury.severity must be one of ${INJURY_SEVERITIES.join(", ")}.`,
    );
  }
  if (injury.gamesRemaining !== null) {
    if (
      typeof injury.gamesRemaining !== "object" ||
      !Number.isInteger(injury.gamesRemaining.min) ||
      !Number.isInteger(injury.gamesRemaining.max) ||
      injury.gamesRemaining.min < 0 ||
      injury.gamesRemaining.max < injury.gamesRemaining.min
    ) {
      throw new Error(
        "Player injury.gamesRemaining must be null or { min, max } with non-negative integers and max >= min.",
      );
    }
  }
  for (const field of [
    "recommendedWorkloadMpg",
    "maximumWorkloadMpg",
  ] as const) {
    const value = injury[field];
    if (
      value !== null &&
      (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    ) {
      throw new Error(`Player injury.${field} must be null or a non-negative finite number.`);
    }
  }
  if (
    typeof injury.recoveryProgress !== "number" ||
    !Number.isFinite(injury.recoveryProgress) ||
    injury.recoveryProgress < 0 ||
    injury.recoveryProgress > 1
  ) {
    throw new Error(
      "Player injury.recoveryProgress must be a finite number between 0 and 1.",
    );
  }
}

function assertSuspension(suspension: PlayerSuspension | null): void {
  if (suspension === null) {
    return;
  }
  if (typeof suspension !== "object") {
    throw new Error("Player suspension must be an object or null.");
  }
  if (
    !Number.isInteger(suspension.gamesRemaining) ||
    suspension.gamesRemaining < 0
  ) {
    throw new Error(
      "Player suspension.gamesRemaining must be a non-negative integer.",
    );
  }
}

function assertDevelopment(development: DevelopmentState): void {
  if (development === null || typeof development !== "object") {
    throw new Error("Player development must be an object.");
  }
  if (!DEVELOPMENT_STAGES.includes(development.stage)) {
    throw new Error(
      `Player development.stage must be one of ${DEVELOPMENT_STAGES.join(", ")}.`,
    );
  }
}
