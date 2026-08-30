import {
  asContractId,
  asPlayerId,
  asTeamId,
  type ContractId,
  type PlayerId,
  type TeamId,
} from "@/domain/ids";
import {
  createPlayer as createDomainPlayer,
  PLAYER_ATTRIBUTE_KEYS,
  type DevelopmentState,
  type Player,
  type PlayerArchetype,
  type PlayerAttributes,
  type PlayerAvailability,
  type PlayerInjury,
  type PlayerNationality,
  type PlayerPersonality,
  type PlayerPosition,
  type PlayerPotential,
  type PlayerSuspension,
} from "@/domain/entities/player";
import { migrateLegacySeverity } from "@/domain/entities/injury";

export type CreatePlayerOverrides = {
  id?: PlayerId | string;
  teamId?: TeamId | string | null;
  firstName?: string;
  lastName?: string;
  nationality?: PlayerNationality;
  position?: PlayerPosition;
  archetype?: PlayerArchetype;
  age?: number;
  heightInches?: number;
  weightPounds?: number;
  attributes?: Partial<PlayerAttributes>;
  potential?: Partial<PlayerPotential>;
  personality?: Partial<PlayerPersonality>;
  contractId?: ContractId | string | null;
  availability?: PlayerAvailability;
  injury?: PlayerInjury | LegacyInjuryOverride | null;
  activeInjuries?: PlayerInjury[];
  suspension?: PlayerSuspension | null;
  durability?: number;
  conditioning?: number;
  development?: Partial<DevelopmentState>;
};

/** Transitional test helper shape for pre-v55 injury fixtures. */
type LegacyInjuryOverride = {
  type: string;
  severity: string;
  gamesRemaining?: { min: number; max: number } | null;
  recommendedWorkloadMpg?: number | null;
  maximumWorkloadMpg?: number | null;
  recoveryProgress?: number;
  bodyPart?: PlayerInjury["bodyPart"];
  catalogKey?: string;
};

function normalizeInjuryOverride(
  injury: PlayerInjury | LegacyInjuryOverride | null | undefined,
): PlayerInjury | null {
  if (injury == null) return null;
  if ("injuryId" in injury && typeof injury.injuryId === "string") {
    return injury as PlayerInjury;
  }
  const legacy = injury as LegacyInjuryOverride;
  const severity = migrateLegacySeverity(legacy.severity);
  const maxMpg = legacy.maximumWorkloadMpg ?? null;
  const gameRestriction =
    maxMpg === 0
      ? "out"
      : maxMpg != null && maxMpg < 28
        ? "limited"
        : "monitor";
  return {
    injuryId: `test_${legacy.type.replace(/\s+/g, "_").toLowerCase()}`,
    catalogKey: legacy.catalogKey ?? "undisclosed",
    type: legacy.type,
    bodyPart: legacy.bodyPart ?? "unknown",
    severity,
    injuredOn: "2026-01-01",
    expectedReturnWindow:
      legacy.gamesRemaining != null
        ? {
            earliest: "2026-01-05",
            latest: "2026-01-15",
          }
        : null,
    recoveryProgress: legacy.recoveryProgress ?? 0,
    practiceRestriction: gameRestriction === "out" ? "none" : "rehab",
    gameRestriction,
    minutesRestriction: maxMpg,
    recommendedWorkloadMpg: legacy.recommendedWorkloadMpg ?? null,
    maximumWorkloadMpg: maxMpg,
    reinjuryRisk: 0.1,
    temporaryEffects: [],
    temporaryFrustration: 8,
    isReinjury: false,
    isAggravation: false,
    priorInjuryId: null,
    chronic: false,
    isLegacyData: legacy.severity === "unknown" || legacy.type === "Undisclosed",
    exposureSource: "off_court",
  };
}

/**
 * Deterministic Player factory. Defaults are stable; pass overrides to customize.
 */
export function createPlayer(overrides: CreatePlayerOverrides = {}): Player {
  const defaultAttributes: PlayerAttributes = {
    speed: 73,
    strength: 66,
    athleticism: 73,
    stamina: 70,
    finishing: 70,
    midRange: 68,
    threePoint: 67,
    freeThrow: 72,
    ballHandling: 71,
    passing: 72,
    perimeterDefense: 69,
    interiorDefense: 65,
    steal: 64,
    block: 60,
    rebounding: 64,
    basketballIq: 70,
    offensiveIq: 69,
    defensiveIq: 67,
    consistency: 68,
  };

  const defaultPersonality: PlayerPersonality = {
    workEthic: 60,
    loyalty: 55,
    competitiveness: 65,
    leadership: 50,
    composure: 58,
  };

  const teamId =
    overrides.teamId === undefined
      ? asTeamId("team_test")
      : overrides.teamId === null
        ? null
        : asTeamId(String(overrides.teamId));

  const contractId =
    overrides.contractId === undefined
      ? asContractId("contract_test")
      : overrides.contractId === null
        ? null
        : asContractId(String(overrides.contractId));

  return createDomainPlayer({
    id: asPlayerId(overrides.id ?? "player_test"),
    teamId,
    firstName: overrides.firstName ?? "Alex",
    lastName: overrides.lastName ?? "Rivera",
    nationality: overrides.nationality ?? "USA",
    position: overrides.position ?? "PG",
    archetype: overrides.archetype ?? "floor_general",
    age: overrides.age ?? 24,
    heightInches: overrides.heightInches ?? 75,
    weightPounds: overrides.weightPounds ?? 195,
    attributes: {
      ...defaultAttributes,
      ...overrides.attributes,
    },
    potential: {
      overall: 80,
      ...overrides.potential,
    },
    personality: {
      ...defaultPersonality,
      ...overrides.personality,
    },
    contractId,
    availability: overrides.availability ?? "available",
    activeInjuries: overrides.activeInjuries?.map((injury) =>
      normalizeInjuryOverride(injury),
    ).filter((injury): injury is PlayerInjury => injury != null),
    injury: normalizeInjuryOverride(
      overrides.injury === undefined ? null : overrides.injury,
    ),
    suspension: overrides.suspension === undefined ? null : overrides.suspension,
    physical:
      overrides.durability != null
        ? { durability: overrides.durability }
        : undefined,
    conditioning: overrides.conditioning,
    development: {
      stage: "developing",
      ...overrides.development,
    },
  });
}

export function createTestInjury(
  overrides: Partial<PlayerInjury> & { type?: string; severity?: string } = {},
): PlayerInjury {
  return normalizeInjuryOverride({
    type: overrides.type ?? "Undisclosed",
    severity: overrides.severity ?? "moderate",
    gamesRemaining: null,
    recommendedWorkloadMpg: overrides.recommendedWorkloadMpg ?? null,
    maximumWorkloadMpg: overrides.maximumWorkloadMpg ?? 0,
    recoveryProgress: overrides.recoveryProgress ?? 0,
    ...overrides,
  })!;
}

export function uniformPlayerAttributes(rating: number): PlayerAttributes {
  const attributes = {} as PlayerAttributes;
  for (const key of PLAYER_ATTRIBUTE_KEYS) {
    attributes[key] = rating;
  }
  return attributes;
}

export function createYoungHighPotentialPlayer(
  overrides: CreatePlayerOverrides = {},
): Player {
  return createPlayer({
    ...overrides,
    age: overrides.age ?? 21,
    attributes: {
      ...uniformPlayerAttributes(60),
      ...overrides.attributes,
    },
    potential: {
      overall: 85,
      ...overrides.potential,
    },
    development: {
      stage: "developing",
      ...overrides.development,
    },
  });
}

export function createYoungNearPotentialPlayer(
  overrides: CreatePlayerOverrides = {},
): Player {
  return createPlayer({
    ...overrides,
    age: overrides.age ?? 22,
    attributes: {
      ...uniformPlayerAttributes(78),
      ...overrides.attributes,
    },
    potential: {
      overall: 80,
      ...overrides.potential,
    },
    development: {
      stage: "developing",
      ...overrides.development,
    },
  });
}

export function createPrimeDevelopmentPlayer(
  overrides: CreatePlayerOverrides = {},
): Player {
  return createPlayer({
    ...overrides,
    age: overrides.age ?? 27,
    attributes: {
      ...uniformPlayerAttributes(75),
      ...overrides.attributes,
    },
    potential: {
      overall: 78,
      ...overrides.potential,
    },
    development: {
      stage: "prime",
      ...overrides.development,
    },
  });
}

export function createVeteranPlayer(
  overrides: CreatePlayerOverrides = {},
): Player {
  return createPlayer({
    ...overrides,
    age: overrides.age ?? 33,
    attributes: {
      ...uniformPlayerAttributes(80),
      ...overrides.attributes,
    },
    potential: {
      overall: 80,
      ...overrides.potential,
    },
    development: {
      stage: "declining",
      ...overrides.development,
    },
  });
}
