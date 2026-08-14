import type {
  PlayoffSeed,
  PlayoffSeries,
  PlayoffTournament,
} from "@/domain/entities/playoffs";
import { asPlayoffSeriesId, type TeamId } from "@/domain/ids";

/**
 * Classic single-elim seed order for a power-of-2 field.
 * n=8 → [1,8,4,5,2,7,3,6]; pairs become opening-round series.
 */
export function bracketSeedOrder(fieldSize: number): number[] {
  assertPowerOfTwoFieldSize(fieldSize);
  if (fieldSize === 1) {
    return [1];
  }
  const previous = bracketSeedOrder(fieldSize / 2);
  const ordered: number[] = [];
  for (const seed of previous) {
    ordered.push(seed);
    ordered.push(fieldSize + 1 - seed);
  }
  return ordered;
}

/**
 * Builds a fixed single-elimination bracket from qualified seeds.
 * Creates fieldSize - 1 series across log2(fieldSize) rounds. No reseeding.
 */
export function generateBracket(seeds: readonly PlayoffSeed[]): PlayoffTournament {
  const fieldSize = seeds.length;
  assertPowerOfTwoFieldSize(fieldSize);
  if (fieldSize < 8) {
    throw new Error(
      `generateBracket requires fieldSize >= 8; got ${fieldSize}.`,
    );
  }

  const bySeed = new Map<number, TeamId>();
  const seenSeeds = new Set<number>();
  const seenTeams = new Set<string>();

  for (const entry of seeds) {
    if (!Number.isInteger(entry.seed) || entry.seed < 1 || entry.seed > fieldSize) {
      throw new Error(
        `generateBracket seed must be an integer 1..${fieldSize}; got ${entry.seed}.`,
      );
    }
    if (seenSeeds.has(entry.seed)) {
      throw new Error(`generateBracket duplicate seed ${entry.seed}.`);
    }
    if (seenTeams.has(entry.teamId)) {
      throw new Error(`generateBracket duplicate teamId ${entry.teamId}.`);
    }
    seenSeeds.add(entry.seed);
    seenTeams.add(entry.teamId);
    bySeed.set(entry.seed, entry.teamId);
  }

  for (let seed = 1; seed <= fieldSize; seed += 1) {
    if (!bySeed.has(seed)) {
      throw new Error(`generateBracket missing seed ${seed}.`);
    }
  }

  const roundCount = Math.log2(fieldSize);
  const series: PlayoffSeries[] = [];
  const ordered = bracketSeedOrder(fieldSize);
  const openingSeriesCount = fieldSize / 2;

  for (let slot = 0; slot < openingSeriesCount; slot += 1) {
    const seedA = ordered[slot * 2]!;
    const seedB = ordered[slot * 2 + 1]!;
    const higherSeed = Math.min(seedA, seedB);
    const lowerSeed = Math.max(seedA, seedB);
    const higherSeedTeamId = bySeed.get(higherSeed)!;
    const lowerSeedTeamId = bySeed.get(lowerSeed)!;

    series.push({
      id: asPlayoffSeriesId(`playoff_r0_s${slot}`),
      round: 0,
      slot,
      higherSeed,
      lowerSeed,
      higherSeedTeamId,
      lowerSeedTeamId,
      wins: {
        [higherSeedTeamId]: 0,
        [lowerSeedTeamId]: 0,
      },
      gameIds: [],
      status: "active",
    });
  }

  let previousRoundSeriesIds = series
    .filter((entry) => entry.round === 0)
    .sort((left, right) => left.slot - right.slot)
    .map((entry) => entry.id);

  for (let round = 1; round < roundCount; round += 1) {
    const seriesInRound = fieldSize / 2 ** (round + 1);
    const roundSeriesIds: typeof previousRoundSeriesIds = [];

    for (let slot = 0; slot < seriesInRound; slot += 1) {
      const feederA = previousRoundSeriesIds[slot * 2]!;
      const feederB = previousRoundSeriesIds[slot * 2 + 1]!;
      const id = asPlayoffSeriesId(`playoff_r${round}_s${slot}`);
      series.push({
        id,
        round,
        slot,
        higherSeed: null,
        lowerSeed: null,
        higherSeedTeamId: null,
        lowerSeedTeamId: null,
        feederSeriesIds: [feederA, feederB],
        wins: {},
        gameIds: [],
        status: "pending",
      });
      roundSeriesIds.push(id);
    }

    previousRoundSeriesIds = roundSeriesIds;
  }

  const expectedSeriesCount = fieldSize - 1;
  if (series.length !== expectedSeriesCount) {
    throw new Error(
      `generateBracket expected ${expectedSeriesCount} series; built ${series.length}.`,
    );
  }

  return {
    status: "in_progress",
    fieldSize,
    qualifiedTeams: seeds.map((entry) => ({
      teamId: entry.teamId,
      seed: entry.seed,
    })),
    series,
  };
}

function assertPowerOfTwoFieldSize(fieldSize: number): void {
  if (
    !Number.isInteger(fieldSize) ||
    fieldSize < 1 ||
    (fieldSize & (fieldSize - 1)) !== 0
  ) {
    throw new Error(
      `Playoff fieldSize must be a power of 2 >= 1; got ${fieldSize}.`,
    );
  }
}
