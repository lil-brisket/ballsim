import type { ContractId, PlayerId, TeamId } from "@/domain/ids";
import {
  isPlayerArchetype,
  type PlayerArchetype,
} from "@/domain/entities/player-archetype";

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
  age: number;
  heightInches: number;
  weightPounds: number;
  position: PlayerPosition;
  archetype: PlayerArchetype;
  attributes: PlayerAttributes;
  potential: PlayerPotential;
  personality: PlayerPersonality;
  contractId: ContractId | null;
  injury: InjuryStatus;
  development: DevelopmentState;
};

/** Unvalidated construction payload for {@link createPlayer}. */
export type PlayerInput = {
  id: PlayerId;
  teamId: TeamId | null;
  firstName: string;
  lastName: string;
  age: number;
  heightInches: number;
  weightPounds: number;
  position: PlayerPosition;
  archetype: PlayerArchetype;
  attributes: PlayerAttributes;
  potential: PlayerPotential;
  personality: PlayerPersonality;
  contractId: ContractId | null;
  injury: InjuryStatus;
  development: DevelopmentState;
};

const ATTRIBUTE_KEYS: readonly (keyof PlayerAttributes)[] = [
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
  assertNonNegativeInteger(input.age, "age");
  assertPositiveFinite(input.heightInches, "heightInches");
  assertPositiveFinite(input.weightPounds, "weightPounds");
  assertPlayerPosition(input.position);
  assertPlayerArchetype(input.archetype);
  assertAttributes(input.attributes);
  assertPotential(input.potential);
  assertPersonality(input.personality);
  assertOptionalId(input.contractId, "contractId");
  assertInjury(input.injury);
  assertDevelopment(input.development);

  return {
    id: input.id,
    teamId: input.teamId,
    firstName: input.firstName,
    lastName: input.lastName,
    age: input.age,
    heightInches: input.heightInches,
    weightPounds: input.weightPounds,
    position: input.position,
    archetype: input.archetype,
    attributes: { ...input.attributes },
    potential: { ...input.potential },
    personality: { ...input.personality },
    contractId: input.contractId,
    injury: { ...input.injury },
    development: { ...input.development },
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
  const knownKeys = new Set<string>(ATTRIBUTE_KEYS);
  for (const key of Object.keys(attributes)) {
    if (!knownKeys.has(key)) {
      throw new Error(`Player attributes contains unknown key "${key}".`);
    }
  }
  for (const key of ATTRIBUTE_KEYS) {
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

function assertInjury(injury: InjuryStatus): void {
  if (injury === null || typeof injury !== "object") {
    throw new Error("Player injury must be an object.");
  }
  if (injury.kind !== "healthy" && injury.kind !== "injured") {
    throw new Error('Player injury.kind must be "healthy" or "injured".');
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
