import type { ContractId, PlayerId, TeamId } from "@/domain/ids";
import {
  isPlayerArchetype,
  type PlayerArchetype,
} from "@/domain/entities/player-archetype";
import {
  isPlayerNationality,
  type PlayerNationality,
} from "@/domain/entities/player-nationality";
import {
  CONDITIONING_MAX,
  CONDITIONING_MIN,
  DURABILITY_MAX,
  DURABILITY_MIN,
  INJURY_HISTORY_MAX,
  isBodyPart,
  isExposureSource,
  isGameRestriction,
  isInjurySeverity,
  isPracticeRestriction,
  type InjuryHistoryEntry,
  type PlayerInjury,
  type PlayerPhysicalProfile,
} from "@/domain/entities/injury";
import {
  cloneDevelopmentLeagueProfile,
  createDefaultDevelopmentLeagueProfile,
  isDevelopmentLeagueRole,
  isDevelopmentLeagueStatus,
  type DevelopmentLeagueProfile,
} from "@/domain/entities/development-league";

export type {
  BodyPart,
  ExposureSource,
  GameRestriction,
  InjuryAttributeEffect,
  InjuryHistoryEntry,
  InjurySeverity,
  PlayerConditioning,
  PlayerInjury,
  PlayerPhysicalProfile,
  PracticeRestriction,
} from "@/domain/entities/injury";
export {
  AVAILABILITY_RESTRICTIVENESS,
  BODY_PARTS,
  CONDITIONING_MAX,
  CONDITIONING_MIN,
  DURABILITY_MAX,
  DURABILITY_MIN,
  EXPOSURE_SOURCES,
  GAME_RESTRICTIONS,
  INJURY_HISTORY_MAX,
  INJURY_SEVERITIES,
  PRACTICE_RESTRICTIONS,
  isBodyPart,
  isExposureSource,
  isGameRestriction,
  isInjurySeverity,
  isPracticeRestriction,
  migrateLegacySeverity,
} from "@/domain/entities/injury";

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
 * Status is derived from active injuries (most restrictive wins), not a fixed progression.
 */
export type PlayerAvailability =
  | "available"
  | "minor"
  | "questionable"
  | "limited"
  | "recovery"
  | "out"
  | "suspended";

export const PLAYER_AVAILABILITIES: readonly PlayerAvailability[] = [
  "available",
  "minor",
  "questionable",
  "limited",
  "recovery",
  "out",
  "suspended",
] as const;

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
  /** Floor eligibility — derived from activeInjuries when not suspended. */
  availability: PlayerAvailability;
  /**
   * Active medical injuries (expect 0–1; multiple allowed).
   * Overall status = most restrictive across all entries.
   */
  activeInjuries: PlayerInjury[];
  /**
   * @deprecated Prefer {@link Player.activeInjuries}. Synced as primary
   * (most restrictive) injury or null for transitional consumers.
   */
  injury: PlayerInjury | null;
  /** Independent of injury — a healthy player may still be suspended. */
  suspension: PlayerSuspension | null;
  physical: PlayerPhysicalProfile;
  conditioning: number;
  injuryHistory: InjuryHistoryEntry[];
  development: DevelopmentState;
  /**
   * Development League assignment/eligibility state.
   * Player.teamId remains franchise ownership; Team.roster is top-league only.
   */
  developmentLeague: DevelopmentLeagueProfile;
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
  activeInjuries?: PlayerInjury[];
  /** @deprecated Prefer activeInjuries. Migrated into activeInjuries when set. */
  injury?: PlayerInjury | null;
  suspension: PlayerSuspension | null;
  physical?: PlayerPhysicalProfile;
  conditioning?: number;
  injuryHistory?: InjuryHistoryEntry[];
  development: DevelopmentState;
  developmentLeague?: DevelopmentLeagueProfile;
  retired?: boolean;
};

/** Conservative migration of legacy binary `{ kind: "healthy" | "injured" }`. */
export function migrateLegacyInjuryStatus(
  legacy: InjuryStatus | null | undefined,
): {
  availability: PlayerAvailability;
  activeInjuries: PlayerInjury[];
  injury: PlayerInjury | null;
  suspension: null;
} {
  if (legacy == null || legacy.kind === "healthy") {
    return {
      availability: "available",
      activeInjuries: [],
      injury: null,
      suspension: null,
    };
  }
  const injury = createLegacyUndisclosedInjury();
  return {
    availability: "out",
    activeInjuries: [injury],
    injury,
    suspension: null,
  };
}

/** Build a legacy undisclosed injury for migration. */
export function createLegacyUndisclosedInjury(
  injuredOn: string = "1970-01-01",
): PlayerInjury {
  return {
    injuryId: `legacy_undisclosed_${injuredOn}`,
    catalogKey: "undisclosed",
    type: "Undisclosed",
    bodyPart: "unknown",
    severity: "moderate",
    injuredOn,
    expectedReturnWindow: null,
    recoveryProgress: 0,
    practiceRestriction: "none",
    gameRestriction: "out",
    minutesRestriction: 0,
    recommendedWorkloadMpg: null,
    maximumWorkloadMpg: 0,
    reinjuryRisk: 0.15,
    temporaryEffects: [],
    temporaryFrustration: 10,
    isReinjury: false,
    isAggravation: false,
    priorInjuryId: null,
    chronic: false,
    isLegacyData: true,
    exposureSource: "off_court",
  };
}

/**
 * Sync deprecated `injury` field from activeInjuries (most restrictive first).
 */
export function primaryActiveInjury(
  activeInjuries: readonly PlayerInjury[],
): PlayerInjury | null {
  if (activeInjuries.length === 0) {
    return null;
  }
  const rank = (injury: PlayerInjury): number => {
    if (injury.gameRestriction === "out") return 5;
    if (injury.gameRestriction === "limited") return 3;
    if (injury.gameRestriction === "monitor") return 2;
    return 1;
  };
  let best = activeInjuries[0]!;
  for (let i = 1; i < activeInjuries.length; i++) {
    const candidate = activeInjuries[i]!;
    if (rank(candidate) > rank(best)) {
      best = candidate;
    }
  }
  return best;
}

export function isPlayerAvailability(
  value: string,
): value is PlayerAvailability {
  return (PLAYER_AVAILABILITIES as readonly string[]).includes(value);
}

/** True when the player is eligible to take the floor (may still have workload caps). */
export function playerCanPlay(player: Player): boolean {
  if (
    player.availability === "out" ||
    player.availability === "suspended"
  ) {
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
    case "minor":
      return "Minor";
    case "questionable":
      return "Questionable";
    case "limited":
      return "Limited";
    case "recovery":
      return "Recovery";
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

  const activeInjuries = resolveActiveInjuriesInput(input);
  for (const injury of activeInjuries) {
    assertPlayerInjury(injury);
  }
  assertSuspension(input.suspension);
  assertDevelopment(input.development);
  const developmentLeague = normalizeDevelopmentLeagueProfile(
    input.developmentLeague,
  );

  const physical: PlayerPhysicalProfile = {
    durability: clampInt(
      input.physical?.durability ?? defaultDurabilityForAge(input.age),
      DURABILITY_MIN,
      DURABILITY_MAX,
    ),
  };
  const conditioning = clampInt(
    input.conditioning ?? 100,
    CONDITIONING_MIN,
    CONDITIONING_MAX,
  );
  const injuryHistory = (input.injuryHistory ?? []).slice(
    0,
    INJURY_HISTORY_MAX,
  );

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
    activeInjuries: activeInjuries.map(cloneInjury),
    injury: primaryActiveInjury(activeInjuries),
    suspension:
      input.suspension == null ? null : { ...input.suspension },
    physical: { ...physical },
    conditioning,
    injuryHistory: injuryHistory.map((entry) => ({ ...entry })),
    development: { ...input.development },
    developmentLeague: cloneDevelopmentLeagueProfile(developmentLeague),
    retired: input.retired === true ? true : undefined,
  };
}

function normalizeDevelopmentLeagueProfile(
  input: DevelopmentLeagueProfile | undefined,
): DevelopmentLeagueProfile {
  if (input == null) {
    return createDefaultDevelopmentLeagueProfile();
  }
  if (!isDevelopmentLeagueStatus(input.status)) {
    throw new Error(
      `Player developmentLeague.status must be one of none, assigned.`,
    );
  }
  if (!isDevelopmentLeagueRole(input.role)) {
    throw new Error(
      `Player developmentLeague.role must be starter, rotation, or development.`,
    );
  }
  if (
    !Number.isInteger(input.seasonsUsed) ||
    input.seasonsUsed < 0 ||
    input.seasonsUsed > 3
  ) {
    throw new Error(
      "Player developmentLeague.seasonsUsed must be an integer 0–3.",
    );
  }
  return {
    status: input.status,
    parentTeamId: input.parentTeamId,
    role: input.role,
    seasonsUsed: input.seasonsUsed,
    assignedThisSeason: input.assignedThisSeason === true,
    dlAssignmentLockedThisSeason: input.dlAssignmentLockedThisSeason === true,
    firstAssignedSeasonYear: input.firstAssignedSeasonYear,
    draftSeasonYear: input.draftSeasonYear,
    currentSeasonStats:
      input.currentSeasonStats == null
        ? undefined
        : { ...input.currentSeasonStats },
  };
}

function resolveActiveInjuriesInput(input: PlayerInput): PlayerInjury[] {
  if (input.activeInjuries != null) {
    return [...input.activeInjuries];
  }
  if (input.injury != null) {
    return [input.injury];
  }
  return [];
}

function cloneInjury(injury: PlayerInjury): PlayerInjury {
  return {
    ...injury,
    expectedReturnWindow:
      injury.expectedReturnWindow == null
        ? null
        : { ...injury.expectedReturnWindow },
    temporaryEffects: injury.temporaryEffects.map((effect) => ({ ...effect })),
  };
}

export function defaultDurabilityForAge(age: number): number {
  // Slight age bias; generation should prefer explicit RNG. Floor/ceiling applied by caller.
  if (age <= 22) return 72;
  if (age <= 27) return 68;
  if (age <= 32) return 62;
  return 55;
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
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

function assertPlayerInjury(injury: PlayerInjury): void {
  if (typeof injury !== "object" || injury === null) {
    throw new Error("Player injury must be an object.");
  }
  if (typeof injury.injuryId !== "string" || injury.injuryId.length === 0) {
    throw new Error("Player injury.injuryId must be a non-empty string.");
  }
  if (typeof injury.catalogKey !== "string" || injury.catalogKey.length === 0) {
    throw new Error("Player injury.catalogKey must be a non-empty string.");
  }
  if (typeof injury.type !== "string" || injury.type.trim().length === 0) {
    throw new Error("Player injury.type must be a non-empty string.");
  }
  if (!isBodyPart(injury.bodyPart)) {
    throw new Error(`Player injury.bodyPart is invalid: ${injury.bodyPart}.`);
  }
  if (!isInjurySeverity(injury.severity)) {
    throw new Error(
      `Player injury.severity must be one of minor|moderate|major|severe.`,
    );
  }
  if (typeof injury.injuredOn !== "string" || injury.injuredOn.length === 0) {
    throw new Error("Player injury.injuredOn must be a non-empty date string.");
  }
  if (injury.expectedReturnWindow != null) {
    if (
      typeof injury.expectedReturnWindow.earliest !== "string" ||
      typeof injury.expectedReturnWindow.latest !== "string"
    ) {
      throw new Error(
        "Player injury.expectedReturnWindow must have earliest and latest dates.",
      );
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
  if (!isPracticeRestriction(injury.practiceRestriction)) {
    throw new Error("Player injury.practiceRestriction is invalid.");
  }
  if (!isGameRestriction(injury.gameRestriction)) {
    throw new Error("Player injury.gameRestriction is invalid.");
  }
  for (const field of [
    "recommendedWorkloadMpg",
    "maximumWorkloadMpg",
    "minutesRestriction",
  ] as const) {
    const value = injury[field];
    if (
      value !== null &&
      (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    ) {
      throw new Error(
        `Player injury.${field} must be null or a non-negative finite number.`,
      );
    }
  }
  if (
    typeof injury.reinjuryRisk !== "number" ||
    !Number.isFinite(injury.reinjuryRisk) ||
    injury.reinjuryRisk < 0 ||
    injury.reinjuryRisk > 1
  ) {
    throw new Error(
      "Player injury.reinjuryRisk must be a finite number between 0 and 1.",
    );
  }
  if (!Array.isArray(injury.temporaryEffects)) {
    throw new Error("Player injury.temporaryEffects must be an array.");
  }
  if (
    typeof injury.temporaryFrustration !== "number" ||
    !Number.isFinite(injury.temporaryFrustration)
  ) {
    throw new Error("Player injury.temporaryFrustration must be a finite number.");
  }
  if (typeof injury.isReinjury !== "boolean") {
    throw new Error("Player injury.isReinjury must be a boolean.");
  }
  if (typeof injury.isAggravation !== "boolean") {
    throw new Error("Player injury.isAggravation must be a boolean.");
  }
  if (!isExposureSource(injury.exposureSource)) {
    throw new Error("Player injury.exposureSource is invalid.");
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
