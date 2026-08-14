import { writeFileSync } from "node:fs";
import { generatePlayer } from "@/systems/player-generation";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { Player } from "@/domain/entities/player";

const N = 1000;
const players: Player[] = [];
for (let i = 0; i < N; i += 1) {
  players.push(generatePlayer(i + 1));
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function std(xs: number[]): number {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function percentile(xs: number[], p: number): number {
  const s = [...xs].sort((a, b) => a - b);
  const i = (s.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  if (lo === hi) return s[lo]!;
  return s[lo]! + (s[hi]! - s[lo]!) * (i - lo);
}

function hist(
  xs: number[],
  binSize: number,
  min: number,
  max: number,
): { label: string; count: number }[] {
  const bins: { label: string; count: number }[] = [];
  for (let start = min; start <= max; start += binSize) {
    const end = Math.min(start + binSize - 1, max);
    bins.push({
      label: start === end ? String(start) : `${start}-${end}`,
      count: xs.filter((x) => x >= start && x <= end).length,
    });
  }
  return bins;
}

function countMap(xs: string[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const x of xs) m[x] = (m[x] ?? 0) + 1;
  return m;
}

const overalls = players.map((p) =>
  calculatePlayerOverall(p.position, p.attributes),
);
const potentials = players.map((p) => p.potential.overall);
const gaps = players.map((p, i) => potentials[i]! - overalls[i]!);
const ages = players.map((p) => p.age);

function bandStats(list: Player[]) {
  const o = list.map((p) => calculatePlayerOverall(p.position, p.attributes));
  const g = list.map((p, i) => p.potential.overall - o[i]!);
  return {
    n: list.length,
    meanOverall: +mean(o).toFixed(2),
    meanGap: +mean(g).toFixed(2),
    medianGap: median(g),
    maxGap: Math.max(...g),
    minGap: Math.min(...g),
  };
}

const ATTRS = [
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
] as const;

const attrByPos: Record<string, Record<string, number>> = {};
for (const pos of ["PG", "SG", "SF", "PF", "C"] as const) {
  const subset = players.filter((p) => p.position === pos);
  attrByPos[pos] = {};
  for (const k of ATTRS) {
    attrByPos[pos][k] = +mean(subset.map((p) => p.attributes[k])).toFixed(1);
  }
}

const heightByPos: Record<string, { mean: number; min: number; max: number }> =
  {};
const weightByPos: Record<string, { mean: number; min: number; max: number }> =
  {};
for (const pos of ["PG", "SG", "SF", "PF", "C"] as const) {
  const subset = players.filter((p) => p.position === pos);
  const hs = subset.map((p) => p.heightInches);
  const ws = subset.map((p) => p.weightPounds);
  heightByPos[pos] = {
    mean: +mean(hs).toFixed(1),
    min: Math.min(...hs),
    max: Math.max(...hs),
  };
  weightByPos[pos] = {
    mean: +mean(ws).toFixed(1),
    min: Math.min(...ws),
    max: Math.max(...ws),
  };
}

const PERSON = [
  "workEthic",
  "loyalty",
  "competitiveness",
  "leadership",
  "composure",
] as const;
const personMeans: Record<string, number> = {};
for (const k of PERSON) {
  personMeans[k] = +mean(players.map((p) => p.personality[k])).toFixed(2);
}

const floor = players.filter((p) => p.archetype === "floor_general");
const rim = players.filter((p) => p.archetype === "rim_protector");
const stretch = players.filter((p) => p.archetype === "stretch_big");
const rebound = players.filter((p) => p.archetype === "rebounding_big");

const out = {
  n: N,
  overall: {
    mean: +mean(overalls).toFixed(2),
    std: +std(overalls).toFixed(2),
    median: median(overalls),
    p10: +percentile(overalls, 0.1).toFixed(1),
    p25: +percentile(overalls, 0.25).toFixed(1),
    p75: +percentile(overalls, 0.75).toFixed(1),
    p90: +percentile(overalls, 0.9).toFixed(1),
    min: Math.min(...overalls),
    max: Math.max(...overalls),
    hist: hist(overalls, 5, 45, 99),
  },
  potential: {
    mean: +mean(potentials).toFixed(2),
    median: median(potentials),
    min: Math.min(...potentials),
    max: Math.max(...potentials),
    atLeast90: potentials.filter((p) => p >= 90).length,
    atLeast95: potentials.filter((p) => p >= 95).length,
    equal99: potentials.filter((p) => p === 99).length,
    hist: hist(potentials, 5, 45, 99),
  },
  overallBands: {
    atLeast90: overalls.filter((o) => o >= 90).length,
    band50to59: overalls.filter((o) => o >= 50 && o <= 59).length,
    band60to69: overalls.filter((o) => o >= 60 && o <= 69).length,
    band70to79: overalls.filter((o) => o >= 70 && o <= 79).length,
    band80to89: overalls.filter((o) => o >= 80 && o <= 89).length,
  },
  gap: {
    mean: +mean(gaps).toFixed(2),
    median: median(gaps),
    min: Math.min(...gaps),
    max: Math.max(...gaps),
    hist: hist(gaps, 5, 0, 35),
  },
  ageHist: hist(ages, 1, 20, 34),
  position: countMap(players.map((p) => p.position)),
  archetype: countMap(players.map((p) => p.archetype)),
  ageBands: {
    young: bandStats(players.filter((p) => p.age <= 24)),
    prime: bandStats(players.filter((p) => p.age >= 25 && p.age <= 30)),
    veteran: bandStats(players.filter((p) => p.age >= 31)),
  },
  attrByPos,
  heightByPos,
  weightByPos,
  personMeans,
  coherence: {
    floorPassing: +mean(floor.map((p) => p.attributes.passing)).toFixed(1),
    rimPassing: +mean(rim.map((p) => p.attributes.passing)).toFixed(1),
    rimBlock: +mean(rim.map((p) => p.attributes.block)).toFixed(1),
    floorBlock: +mean(floor.map((p) => p.attributes.block)).toFixed(1),
    stretch3: +mean(stretch.map((p) => p.attributes.threePoint)).toFixed(1),
    rebound3: +mean(rebound.map((p) => p.attributes.threePoint)).toFixed(1),
    reboundReb: +mean(rebound.map((p) => p.attributes.rebounding)).toFixed(1),
    stretchReb: +mean(stretch.map((p) => p.attributes.rebounding)).toFixed(1),
    nFloor: floor.length,
    nRim: rim.length,
    nStretch: stretch.length,
    nRebound: rebound.length,
  },
};

writeFileSync("tmp-population-stats.json", JSON.stringify(out, null, 2));
console.error(
  "OK mean overall",
  out.overall.mean,
  "mean potential",
  out.potential.mean,
  "mean gap",
  out.gap.mean,
  "pot>=90",
  out.potential.atLeast90,
  "pot>=95",
  out.potential.atLeast95,
  "pot==99",
  out.potential.equal99,
);
