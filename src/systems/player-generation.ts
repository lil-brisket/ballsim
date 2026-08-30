import { asPlayerId, type ContractId, type PlayerId, type TeamId } from "@/domain/ids";
import {
  createPlayer,
  PLAYER_POSITIONS,
  RATING_MAX,
  RATING_MIN,
  type Player,
  type PlayerPosition,
} from "@/domain/entities/player";
import {
  isArchetypeCompatible,
  type PlayerArchetype,
} from "@/domain/entities/player-archetype";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import { createSeededRng, type Rng } from "@/domain/rng";
import {
  generatePlayerAttributes,
  pickCompatibleArchetype,
} from "@/systems/player-attribute-generation";
import { generatePlayerName } from "@/systems/player-name-generation";
import {
  MAX_PLAYER_AGE,
  MAX_PLAYER_QUALITY,
  MAX_PERSONALITY,
  MIN_PLAYER_AGE,
  MIN_PLAYER_QUALITY,
  MIN_PERSONALITY,
  POSITION_BODY_RANGES,
  developmentStageForAge,
  potentialGapBandForAge,
} from "@/systems/player-generation-config";

/**
 * Identity and slot constraints only.
 * Must not expose generation internals (quality, attributes, potential, etc.).
 */
export type GeneratePlayerOptions = {
  id?: PlayerId;
  teamId?: TeamId | null;
  contractId?: ContractId | null;
  position?: PlayerPosition;
  archetype?: PlayerArchetype;
  /** When set, skips the age RNG roll. */
  age?: number;
};

/**
 * Deterministic player from a seed.
 * Equivalent to `generatePlayerWithRng(createSeededRng(seed), options)`.
 */
export function generatePlayer(
  seed: number | string,
  options: GeneratePlayerOptions = {},
): Player {
  return generatePlayerWithRng(createSeededRng(seed), options);
}

/**
 * Deterministic player from an injected RNG stream.
 * Same seed + options as {@link generatePlayer} yields a deep-equal Player.
 *
 * When an option overrides a stage, no RNG value is consumed for that stage.
 * Height/weight are descriptive only and do not affect attributes or potential.
 */
export function generatePlayerWithRng(
  rng: Rng,
  options: GeneratePlayerOptions = {},
): Player {
  const playerId =
    options.id ?? asPlayerId(`player_gen_${rng.getState()}`);

  const quality = rng.nextInt(MIN_PLAYER_QUALITY, MAX_PLAYER_QUALITY);

  const position = options.position ?? rng.pick(PLAYER_POSITIONS);

  let archetype: PlayerArchetype;
  if (options.archetype !== undefined) {
    if (!isArchetypeCompatible(options.archetype, position)) {
      throw new Error(
        `Archetype "${options.archetype}" is incompatible with position "${position}".`,
      );
    }
    archetype = options.archetype;
  } else {
    archetype = pickCompatibleArchetype(position, rng);
  }

  let age: number;
  if (options.age !== undefined) {
    if (
      !Number.isInteger(options.age) ||
      options.age < MIN_PLAYER_AGE ||
      options.age > MAX_PLAYER_AGE
    ) {
      throw new Error(
        `Player age must be an integer between ${MIN_PLAYER_AGE} and ${MAX_PLAYER_AGE}.`,
      );
    }
    age = options.age;
  } else {
    age = rng.nextInt(MIN_PLAYER_AGE, MAX_PLAYER_AGE);
  }
  const { firstName, lastName, nationality } = generatePlayerName(rng);

  const body = POSITION_BODY_RANGES[position];
  const heightInches = rng.nextInt(body.minHeightInches, body.maxHeightInches);
  const weightPounds = rng.nextInt(body.minWeightPounds, body.maxWeightPounds);

  const attributes = generatePlayerAttributes(
    position,
    archetype,
    rng,
    quality,
  );

  const currentOverall = calculatePlayerOverall(position, attributes);
  const gapBand = potentialGapBandForAge(age);
  const gap = rng.nextInt(gapBand.min, gapBand.max);
  const potentialOverall = clampRating(currentOverall + gap);

  const personality = {
    workEthic: rng.nextInt(MIN_PERSONALITY, MAX_PERSONALITY),
    loyalty: rng.nextInt(MIN_PERSONALITY, MAX_PERSONALITY),
    competitiveness: rng.nextInt(MIN_PERSONALITY, MAX_PERSONALITY),
    leadership: rng.nextInt(MIN_PERSONALITY, MAX_PERSONALITY),
    composure: rng.nextInt(MIN_PERSONALITY, MAX_PERSONALITY),
  };

  return createPlayer({
    id: playerId,
    teamId: options.teamId ?? null,
    firstName,
    lastName,
    nationality,
    position,
    archetype,
    age,
    heightInches,
    weightPounds,
    attributes,
    potential: { overall: potentialOverall },
    personality,
    contractId: options.contractId ?? null,
    availability: "available",
    activeInjuries: [],
    injury: null,
    suspension: null,
    physical: {
      durability: rng.nextInt(45, 88),
    },
    conditioning: 100,
    injuryHistory: [],
    development: { stage: developmentStageForAge(age) },
  });
}

function clampRating(value: number): number {
  return Math.min(RATING_MAX, Math.max(RATING_MIN, value));
}
