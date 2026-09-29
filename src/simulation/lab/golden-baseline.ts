import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { ENGINE_VERSION } from "@/simulation/lab/engine-version";
import { compareEngineVersions } from "@/simulation/lab/manifest";
import {
  ksTwoSample,
  ksVerdict,
  LAB_DEFAULT_KS_ALPHA,
} from "@/simulation/lab/ks";
import type { LabRotationMode } from "@/simulation/lab/types";
import type { CheckResult } from "@/simulation/validation/types";
import type { GameSnapshot } from "@/simulation/validation/types";

export type LabScoreDistributions = {
  teamPoints: number[];
  gameTotals: number[];
  absoluteDifferentials: number[];
};

export type LabGoldenBaseline = {
  engineVersion: number;
  seed: number | string;
  games: number;
  scenarioId: string;
  rotation: LabRotationMode;
  checksum: string;
  teamPoints: number[];
  gameTotals: number[];
  absoluteDifferentials: number[];
};

export function scoreDistributionsFromSnapshots(
  snapshots: readonly GameSnapshot[],
): LabScoreDistributions {
  const teamPoints: number[] = [];
  const gameTotals: number[] = [];
  const absoluteDifferentials: number[] = [];
  for (const game of snapshots) {
    teamPoints.push(game.home.points, game.away.points);
    gameTotals.push(game.totalScore);
    absoluteDifferentials.push(game.absoluteDifferential);
  }
  return { teamPoints, gameTotals, absoluteDifferentials };
}

export function buildLabGoldenBaseline(input: {
  seed: number | string;
  games: number;
  scenarioId: string;
  rotation: LabRotationMode;
  checksum: string;
  snapshots: readonly GameSnapshot[];
}): LabGoldenBaseline {
  const scores = scoreDistributionsFromSnapshots(input.snapshots);
  return {
    engineVersion: ENGINE_VERSION,
    seed: input.seed,
    games: input.games,
    scenarioId: input.scenarioId,
    rotation: input.rotation,
    checksum: input.checksum,
    ...scores,
  };
}

export function writeLabGoldenBaseline(
  filePath: string,
  baseline: LabGoldenBaseline,
): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");
}

export function loadLabGoldenBaseline(filePath: string): LabGoldenBaseline {
  const parsed: unknown = JSON.parse(readFileSync(filePath, "utf8"));
  if (parsed == null || typeof parsed !== "object") {
    throw new Error(`Invalid Lab golden baseline: ${filePath}`);
  }
  const baseline = parsed as LabGoldenBaseline;
  if (typeof baseline.engineVersion !== "number") {
    throw new Error(`Lab golden baseline missing engineVersion: ${filePath}`);
  }
  if (
    !Array.isArray(baseline.teamPoints) ||
    baseline.teamPoints.length < 1 ||
    !Array.isArray(baseline.gameTotals) ||
    baseline.gameTotals.length < 1 ||
    !Array.isArray(baseline.absoluteDifferentials) ||
    baseline.absoluteDifferentials.length < 1
  ) {
    throw new Error(`Lab golden baseline missing score arrays: ${filePath}`);
  }
  return baseline;
}

export function compareLabGoldenBaseline(input: {
  baseline: LabGoldenBaseline;
  snapshots: readonly GameSnapshot[];
  alpha?: number;
}): CheckResult[] {
  compareEngineVersions(input.baseline.engineVersion, ENGINE_VERSION);
  const current = scoreDistributionsFromSnapshots(input.snapshots);
  const alpha = input.alpha ?? LAB_DEFAULT_KS_ALPHA;
  return [
    ksCheck("team_points", input.baseline.teamPoints, current.teamPoints, alpha),
    ksCheck("game_totals", input.baseline.gameTotals, current.gameTotals, alpha),
    ksCheck(
      "abs_differential",
      input.baseline.absoluteDifferentials,
      current.absoluteDifferentials,
      alpha,
    ),
  ];
}

function ksCheck(
  name: string,
  baseline: readonly number[],
  current: readonly number[],
  alpha: number,
): CheckResult {
  const result = ksTwoSample(baseline, current);
  const verdict = ksVerdict(result, alpha);
  return {
    name: `ks_${name}`,
    verdict,
    value: result.d,
    message: `${name} KS D=${result.d.toFixed(3)} p=${result.pValue.toFixed(4)} n=${result.n1}/${result.n2} [${verdict}; α=${alpha}]`,
  };
}
