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
 * Supports 4 / 6 / 8 / 12 / 16 (+ larger powers of 2).
 * Byes advance without creating series, games, or fake opponents.
 */
export function generateBracket(seeds: readonly PlayoffSeed[]): PlayoffTournament {
  const fieldSize = seeds.length;
  if (
    fieldSize !== 4 &&
    fieldSize !== 6 &&
    fieldSize !== 8 &&
    fieldSize !== 12 &&
    fieldSize !== 16 &&
    !(isPowerOfTwo(fieldSize) && fieldSize >= 8)
  ) {
    throw new Error(
      `generateBracket unsupported fieldSize ${fieldSize}; expected 4, 6, 8, 12, 16, or larger power of 2.`,
    );
  }

  const bySeed = mapSeeds(seeds, fieldSize);

  if (fieldSize === 6) {
    return buildSixTeamBracket(bySeed, seeds);
  }
  if (fieldSize === 12) {
    return buildTwelveTeamBracket(bySeed, seeds);
  }
  if (fieldSize === 4) {
    return buildPowerOfTwoBracket(bySeed, seeds, 4);
  }
  return buildPowerOfTwoBracket(bySeed, seeds, fieldSize);
}

function mapSeeds(
  seeds: readonly PlayoffSeed[],
  fieldSize: number,
): Map<number, TeamId> {
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

  return bySeed;
}

function buildPowerOfTwoBracket(
  bySeed: Map<number, TeamId>,
  seeds: readonly PlayoffSeed[],
  fieldSize: number,
): PlayoffTournament {
  assertPowerOfTwoFieldSize(fieldSize);
  if (fieldSize < 4) {
    throw new Error(
      `generateBracket requires fieldSize >= 4; got ${fieldSize}.`,
    );
  }

  const series: PlayoffSeries[] = [];
  const ordered = bracketSeedOrder(fieldSize);
  const openingSeriesCount = fieldSize / 2;

  for (let slot = 0; slot < openingSeriesCount; slot += 1) {
    const seedA = ordered[slot * 2]!;
    const seedB = ordered[slot * 2 + 1]!;
    series.push(makeOpeningSeries(slot, seedA, seedB, bySeed));
  }

  let previousRoundSeriesIds = series
    .filter((entry) => entry.round === 0)
    .sort((left, right) => left.slot - right.slot)
    .map((entry) => entry.id);

  const roundCount = Math.log2(fieldSize);
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

  return finalizeTournament(fieldSize, seeds, series, fieldSize - 1);
}

/**
 * 6-team: byes #1,#2; play #3v#6 and #4v#5;
 * semis #1 vs winner(4v5), #2 vs winner(3v6); then final.
 */
function buildSixTeamBracket(
  bySeed: Map<number, TeamId>,
  seeds: readonly PlayoffSeed[],
): PlayoffTournament {
  const series: PlayoffSeries[] = [];

  const r0s0 = makeOpeningSeries(0, 3, 6, bySeed);
  const r0s1 = makeOpeningSeries(1, 4, 5, bySeed);
  series.push(r0s0, r0s1);

  const r1s0 = asPlayoffSeriesId("playoff_r1_s0");
  const r1s1 = asPlayoffSeriesId("playoff_r1_s1");
  series.push({
    id: r1s0,
    round: 1,
    slot: 0,
    higherSeed: null,
    lowerSeed: null,
    higherSeedTeamId: null,
    lowerSeedTeamId: null,
    feederSeriesIds: [r0s1.id],
    byeParticipant: { seed: 1, teamId: bySeed.get(1)! },
    wins: {},
    gameIds: [],
    status: "pending",
  });
  series.push({
    id: r1s1,
    round: 1,
    slot: 1,
    higherSeed: null,
    lowerSeed: null,
    higherSeedTeamId: null,
    lowerSeedTeamId: null,
    feederSeriesIds: [r0s0.id],
    byeParticipant: { seed: 2, teamId: bySeed.get(2)! },
    wins: {},
    gameIds: [],
    status: "pending",
  });

  series.push({
    id: asPlayoffSeriesId("playoff_r2_s0"),
    round: 2,
    slot: 0,
    higherSeed: null,
    lowerSeed: null,
    higherSeedTeamId: null,
    lowerSeedTeamId: null,
    feederSeriesIds: [r1s0, r1s1],
    wins: {},
    gameIds: [],
    status: "pending",
  });

  // 2 opening + 2 semis + 1 final = 5 series (no bye series)
  return finalizeTournament(6, seeds, series, 5);
}

/**
 * 12-team: byes #1–#4; play #5v#12, #6v#11, #7v#10, #8v#9;
 * QF: #1 vs w(8v9), #4 vs w(5v12), #2 vs w(7v10), #3 vs w(6v11).
 */
function buildTwelveTeamBracket(
  bySeed: Map<number, TeamId>,
  seeds: readonly PlayoffSeed[],
): PlayoffTournament {
  const series: PlayoffSeries[] = [];

  const openingPairs: Array<[number, number]> = [
    [5, 12],
    [6, 11],
    [7, 10],
    [8, 9],
  ];
  for (let slot = 0; slot < openingPairs.length; slot += 1) {
    const [a, b] = openingPairs[slot]!;
    series.push(makeOpeningSeries(slot, a, b, bySeed));
  }

  const r0 = series.filter((s) => s.round === 0).sort((a, b) => a.slot - b.slot);
  // slot0 = 5v12, slot1 = 6v11, slot2 = 7v10, slot3 = 8v9
  const qfSpecs: Array<{
    slot: number;
    byeSeed: number;
    feederSlot: number;
  }> = [
    { slot: 0, byeSeed: 1, feederSlot: 3 },
    { slot: 1, byeSeed: 4, feederSlot: 0 },
    { slot: 2, byeSeed: 2, feederSlot: 2 },
    { slot: 3, byeSeed: 3, feederSlot: 1 },
  ];

  const qfIds: string[] = [];
  for (const spec of qfSpecs) {
    const id = asPlayoffSeriesId(`playoff_r1_s${spec.slot}`);
    qfIds.push(id);
    series.push({
      id,
      round: 1,
      slot: spec.slot,
      higherSeed: null,
      lowerSeed: null,
      higherSeedTeamId: null,
      lowerSeedTeamId: null,
      feederSeriesIds: [r0[spec.feederSlot]!.id],
      byeParticipant: {
        seed: spec.byeSeed,
        teamId: bySeed.get(spec.byeSeed)!,
      },
      wins: {},
      gameIds: [],
      status: "pending",
    });
  }

  // Semis: qf0 vs qf1, qf2 vs qf3
  const sf0 = asPlayoffSeriesId("playoff_r2_s0");
  const sf1 = asPlayoffSeriesId("playoff_r2_s1");
  series.push({
    id: sf0,
    round: 2,
    slot: 0,
    higherSeed: null,
    lowerSeed: null,
    higherSeedTeamId: null,
    lowerSeedTeamId: null,
    feederSeriesIds: [qfIds[0]!, qfIds[1]!],
    wins: {},
    gameIds: [],
    status: "pending",
  });
  series.push({
    id: sf1,
    round: 2,
    slot: 1,
    higherSeed: null,
    lowerSeed: null,
    higherSeedTeamId: null,
    lowerSeedTeamId: null,
    feederSeriesIds: [qfIds[2]!, qfIds[3]!],
    wins: {},
    gameIds: [],
    status: "pending",
  });

  series.push({
    id: asPlayoffSeriesId("playoff_r3_s0"),
    round: 3,
    slot: 0,
    higherSeed: null,
    lowerSeed: null,
    higherSeedTeamId: null,
    lowerSeedTeamId: null,
    feederSeriesIds: [sf0, sf1],
    wins: {},
    gameIds: [],
    status: "pending",
  });

  // 4 opening + 4 QF + 2 SF + 1 final = 11
  return finalizeTournament(12, seeds, series, 11);
}

function makeOpeningSeries(
  slot: number,
  seedA: number,
  seedB: number,
  bySeed: Map<number, TeamId>,
): PlayoffSeries {
  const higherSeed = Math.min(seedA, seedB);
  const lowerSeed = Math.max(seedA, seedB);
  const higherSeedTeamId = bySeed.get(higherSeed)!;
  const lowerSeedTeamId = bySeed.get(lowerSeed)!;
  return {
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
  };
}

function finalizeTournament(
  fieldSize: number,
  seeds: readonly PlayoffSeed[],
  series: PlayoffSeries[],
  expectedSeriesCount: number,
): PlayoffTournament {
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

function isPowerOfTwo(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && (value & (value - 1)) === 0;
}

function assertPowerOfTwoFieldSize(fieldSize: number): void {
  if (!isPowerOfTwo(fieldSize)) {
    throw new Error(
      `Playoff fieldSize must be a power of 2 >= 1; got ${fieldSize}.`,
    );
  }
}
