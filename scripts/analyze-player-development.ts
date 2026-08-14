import { writeFileSync } from "node:fs";
import { createPlayer, PLAYER_ATTRIBUTE_KEYS } from "@/domain/entities/player";
import type { Player } from "@/domain/entities/player";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import { createSeededRng } from "@/domain/rng";
import { developPlayer } from "@/systems/player-development";
import { generatePlayer } from "@/systems/player-generation";
import { developmentStageForAge } from "@/systems/player-generation-config";

const N = 1000;
const YEARS = 6;
const PHYSICAL_KEYS = [
  "speed",
  "strength",
  "athleticism",
  "stamina",
] as const;
const SKILL_KEYS = [
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
] as const;
const MENTAL_KEYS = [
  "basketballIq",
  "offensiveIq",
  "defensiveIq",
  "consistency",
] as const;

function overallOf(player: Player): number {
  return calculatePlayerOverall(player.position, player.attributes);
}

function mean(xs: number[]): number {
  if (xs.length === 0) {
    return 0;
  }
  return xs.reduce((sum, value) => sum + value, 0) / xs.length;
}

function round2(value: number): number {
  return +value.toFixed(2);
}

function agePlayer(player: Player): Player {
  const nextAge = player.age + 1;
  return createPlayer({
    ...player,
    age: nextAge,
    development: { stage: developmentStageForAge(nextAge) },
  });
}

function meanAttrChange(
  before: Player,
  after: Player,
  keys: readonly (keyof Player["attributes"])[],
): number {
  return mean(keys.map((key) => after.attributes[key] - before.attributes[key]));
}

const players: Player[] = [];
for (let index = 0; index < N; index += 1) {
  players.push(generatePlayer(index + 1));
}

const oneStepRng = createSeededRng(99_001);
const oneStepChanges: {
  age: number;
  overallBefore: number;
  overallAfter: number;
  change: number;
  gapBefore: number;
  workEthic: number;
  declined: boolean;
  reachedPotential: boolean;
  physicalChange: number;
  skillChange: number;
  mentalChange: number;
}[] = [];

for (const player of players) {
  const before = overallOf(player);
  const gapBefore = player.potential.overall - before;
  const developed = developPlayer(player, oneStepRng);
  const after = overallOf(developed);
  oneStepChanges.push({
    age: player.age,
    overallBefore: before,
    overallAfter: after,
    change: after - before,
    gapBefore,
    workEthic: player.personality.workEthic,
    declined: after < before,
    reachedPotential: after >= developed.potential.overall,
    physicalChange: meanAttrChange(player, developed, PHYSICAL_KEYS),
    skillChange: meanAttrChange(player, developed, SKILL_KEYS),
    mentalChange: meanAttrChange(player, developed, MENTAL_KEYS),
  });
}

function band(minAge: number, maxAge: number) {
  const rows = oneStepChanges.filter(
    (row) => row.age >= minAge && row.age <= maxAge,
  );
  return {
    n: rows.length,
    meanOverallBefore: round2(mean(rows.map((row) => row.overallBefore))),
    meanChange: round2(mean(rows.map((row) => row.change))),
    meanGapBefore: round2(mean(rows.map((row) => row.gapBefore))),
    declined: rows.filter((row) => row.declined).length,
    reachedPotential: rows.filter((row) => row.reachedPotential).length,
    meanPhysicalChange: round2(mean(rows.map((row) => row.physicalChange))),
    meanSkillChange: round2(mean(rows.map((row) => row.skillChange))),
    meanMentalChange: round2(mean(rows.map((row) => row.mentalChange))),
  };
}

const byAge: Record<
  string,
  { n: number; meanOverall: number; meanChange: number; meanGap: number }
> = {};
for (let age = 20; age <= 34; age += 1) {
  const rows = oneStepChanges.filter((row) => row.age === age);
  byAge[String(age)] = {
    n: rows.length,
    meanOverall: round2(mean(rows.map((row) => row.overallBefore))),
    meanChange: round2(mean(rows.map((row) => row.change))),
    meanGap: round2(mean(rows.map((row) => row.gapBefore))),
  };
}

const workEthicLow = oneStepChanges.filter((row) => row.workEthic <= 50);
const workEthicHigh = oneStepChanges.filter((row) => row.workEthic >= 70);

const changeDistribution = {
  leNeg3: oneStepChanges.filter((row) => row.change <= -3).length,
  neg2: oneStepChanges.filter((row) => row.change === -2).length,
  neg1: oneStepChanges.filter((row) => row.change === -1).length,
  zero: oneStepChanges.filter((row) => row.change === 0).length,
  pos1: oneStepChanges.filter((row) => row.change === 1).length,
  pos2: oneStepChanges.filter((row) => row.change === 2).length,
  gePos3: oneStepChanges.filter((row) => row.change >= 3).length,
};

const trajectoryRng = createSeededRng(99_002);
let trajectory = players.map((player) => player);
const trajectoryByYear: {
  year: number;
  meanAge: number;
  meanOverall: number;
  meanGap: number;
  meanChange: number;
  reachedPotential: number;
  declined: number;
}[] = [];

for (let year = 0; year < YEARS; year += 1) {
  const next: Player[] = [];
  const afterOveralls: number[] = [];
  const changes: number[] = [];
  let reachedPotential = 0;
  let declined = 0;
  for (const player of trajectory) {
    const before = overallOf(player);
    const developed = developPlayer(player, trajectoryRng);
    const after = overallOf(developed);
    afterOveralls.push(after);
    changes.push(after - before);
    if (after >= developed.potential.overall) {
      reachedPotential += 1;
    }
    if (after < before) {
      declined += 1;
    }
    next.push(agePlayer(developed));
  }
  trajectoryByYear.push({
    year: year + 1,
    meanAge: round2(mean(trajectory.map((player) => player.age))),
    meanOverall: round2(mean(afterOveralls)),
    meanGap: round2(
      mean(
        next.map((player) => player.potential.overall - overallOf(player)),
      ),
    ),
    meanChange: round2(mean(changes)),
    reachedPotential,
    declined,
  });
  trajectory = next;
}

const out = {
  n: N,
  years: YEARS,
  oneStep: {
    meanAnnualChange: round2(mean(oneStepChanges.map((row) => row.change))),
    declined: oneStepChanges.filter((row) => row.declined).length,
    reachedPotential: oneStepChanges.filter((row) => row.reachedPotential)
      .length,
    meanPhysicalChange: round2(
      mean(oneStepChanges.map((row) => row.physicalChange)),
    ),
    meanSkillChange: round2(mean(oneStepChanges.map((row) => row.skillChange))),
    meanMentalChange: round2(
      mean(oneStepChanges.map((row) => row.mentalChange)),
    ),
    changeDistribution,
    byAge,
    ageBands: {
      young: band(20, 24),
      prime: band(25, 30),
      veteran: band(31, 34),
    },
    workEthic: {
      lowLe50: {
        n: workEthicLow.length,
        meanChange: round2(mean(workEthicLow.map((row) => row.change))),
      },
      highGe70: {
        n: workEthicHigh.length,
        meanChange: round2(mean(workEthicHigh.map((row) => row.change))),
      },
    },
  },
  trajectory: trajectoryByYear,
  attributeKeyCount: PLAYER_ATTRIBUTE_KEYS.length,
};

writeFileSync("tmp-development-stats.json", JSON.stringify(out, null, 2));
console.error(
  "OK mean annual change",
  out.oneStep.meanAnnualChange,
  "young",
  out.oneStep.ageBands.young.meanChange,
  "prime",
  out.oneStep.ageBands.prime.meanChange,
  "veteran",
  out.oneStep.ageBands.veteran.meanChange,
  "WE low",
  out.oneStep.workEthic.lowLe50.meanChange,
  "WE high",
  out.oneStep.workEthic.highGe70.meanChange,
);
