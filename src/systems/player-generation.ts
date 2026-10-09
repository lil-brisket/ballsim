import {
  asPlayerId,
  type ContractId,
  type PlayerId,
  type TeamId,
} from "@/domain/ids";
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
  ageWeightForValue,
  developmentStageForAge,
  potentialGapBandForAge,
  qualityAdjustedForAge,
  qualityWeightForValue,
  type QualityBand,
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
  /** When set, skips the quality RNG roll. */
  quality?: number;
  /**
   * When `quality` is omitted, roll the pyramid inside this inclusive band.
   * Ignored when `quality` is set (no extra RNG).
   */
  qualityBand?: QualityBand;
  /** Occupied "First Last" names among active players. Extra draws on retry. */
  occupiedNames?: ReadonlySet<string>;
  potentialGap?: { min: number; max: number };
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
  const playerId = options.id ?? asPlayerId(`player_gen_${rng.getState()}`);

  const rolledQuality =
    options.quality !== undefined
      ? options.quality
      : rollPlayerQuality(rng, options.qualityBand);

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
    age = rollPlayerAge(rng);
  }
  const quality =
    options.quality !== undefined
      ? rolledQuality
      : qualityAdjustedForAge(rolledQuality, age);
  const { firstName, lastName, nationality } = generatePlayerName(
    rng,
    undefined,
    { occupiedNames: options.occupiedNames },
  );

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
  const gapBand = options.potentialGap ?? potentialGapBandForAge(age);
  const gap = rollPotentialGap(rng, gapBand);
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

/**
 * One `rng.next()` — prime-heavy opening-day ages.
 */
export function rollPlayerAge(rng: Rng): number {
  const values: number[] = [];
  const weights: number[] = [];
  for (let age = MIN_PLAYER_AGE; age <= MAX_PLAYER_AGE; age += 1) {
    const weight = ageWeightForValue(age);
    if (weight <= 0) {
      continue;
    }
    values.push(age);
    weights.push(weight);
  }
  if (values.length === 0) {
    throw new Error("No age weights configured.");
  }
  return pickWeightedInteger(rng, values, weights);
}

/**
 * One `rng.next()` — pyramid quality, optionally clipped to a band.
 */
export function rollPlayerQuality(rng: Rng, band?: QualityBand): number {
  const min = band?.min ?? MIN_PLAYER_QUALITY;
  const max = band?.max ?? MAX_PLAYER_QUALITY;
  assertQualityBand(min, max);
  const values: number[] = [];
  const weights: number[] = [];
  for (let quality = min; quality <= max; quality += 1) {
    const weight = qualityWeightForValue(quality);
    if (weight <= 0) {
      continue;
    }
    values.push(quality);
    weights.push(weight);
  }
  if (values.length === 0) {
    throw new Error(`No quality weight in band ${min}-${max}.`);
  }
  return pickWeightedInteger(rng, values, weights);
}

/**
 * One `rng.next()` — mass toward `band.min`.
 */
export function rollPotentialGap(
  rng: Rng,
  band: { min: number; max: number },
): number {
  if (
    !Number.isInteger(band.min) ||
    !Number.isInteger(band.max) ||
    band.max < band.min
  ) {
    throw new Error("Potential gap band must be integers with max >= min.");
  }
  const values: number[] = [];
  const weights: number[] = [];
  const span = band.max - band.min;
  for (let gap = band.min; gap <= band.max; gap += 1) {
    values.push(gap);
    const t = span === 0 ? 0 : (gap - band.min) / span;
    weights.push(3 - 2 * t);
  }
  return pickWeightedInteger(rng, values, weights);
}

function assertQualityBand(min: number, max: number): void {
  if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
    throw new Error("Quality band must be integers with max >= min.");
  }
}

function pickWeightedInteger(
  rng: Rng,
  values: readonly number[],
  weights: readonly number[],
): number {
  if (values.length === 0 || values.length !== weights.length) {
    throw new Error(
      "pickWeightedInteger requires matching non-empty values and weights.",
    );
  }
  let total = 0;
  for (const weight of weights) {
    if (Number.isFinite(weight) && weight > 0) {
      total += weight;
    }
  }
  if (total <= 0) {
    throw new Error("pickWeightedInteger requires a positive weight sum.");
  }
  let cursor = rng.next() * total;
  for (let index = 0; index < values.length; index += 1) {
    const weight = weights[index]!;
    if (!Number.isFinite(weight) || weight <= 0) {
      continue;
    }
    cursor -= weight;
    if (cursor < 0) {
      return values[index]!;
    }
  }
  return values[values.length - 1]!;
}
