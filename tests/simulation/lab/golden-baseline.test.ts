import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildLabGoldenBaseline,
  compareLabGoldenBaseline,
  ENGINE_VERSION,
  formatLabReport,
  labExitCode,
  loadLabGoldenBaseline,
  readEngineIdentity,
  runLabGames,
} from "@/simulation/lab";
import { formatReproCommand } from "@/simulation/lab/repro";
import type { LabGoldenBaseline } from "@/simulation/lab/golden-baseline";
import type { LabReport } from "@/simulation/lab/types";
import type { GameSnapshot, TeamGameSnapshot } from "@/simulation/validation/types";

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "lab-golden-"));
  dirs.push(dir);
  return dir;
}

function stubTeam(side: "home" | "away", points: number): TeamGameSnapshot {
  return {
    side,
    teamId: side,
    points,
    fieldGoalsMade: 0,
    fieldGoalsAttempted: 0,
    threePointersMade: 0,
    threePointersAttempted: 0,
    freeThrowsMade: 0,
    freeThrowsAttempted: 0,
    offensiveRebounds: 0,
    defensiveRebounds: 0,
    rebounds: 0,
    assists: 0,
    turnovers: 0,
    fouls: 0,
    possessions: 90,
    fieldGoalPct: null,
    threePointPct: null,
    freeThrowPct: null,
    pointsPerPossession: null,
  };
}

function stubGame(homePoints: number, awayPoints: number, index: number): GameSnapshot {
  return {
    gameId: `g${index}`,
    homeScore: homePoints,
    awayScore: awayPoints,
    totalScore: homePoints + awayPoints,
    scoreDifferential: homePoints - awayPoints,
    absoluteDifferential: Math.abs(homePoints - awayPoints),
    winner: homePoints >= awayPoints ? "home" : "away",
    periodCount: 4,
    overtimePeriodCount: 0,
    homePossessions: 90,
    awayPossessions: 90,
    totalPossessions: 180,
    home: stubTeam("home", homePoints),
    away: stubTeam("away", awayPoints),
  };
}

function matchingSnapshots(count: number): GameSnapshot[] {
  return Array.from({ length: count }, (_, index) => stubGame(100, 90, index));
}

describe("compareLabGoldenBaseline", () => {
  it("passes when the current scores match the golden", () => {
    const snapshots = matchingSnapshots(20);
    const baseline = buildLabGoldenBaseline({
      seed: 7,
      games: 20,
      scenarioId: "normal",
      rotation: "off",
      checksum: "abc",
      snapshots,
    });
    expect(baseline.engineVersion).toBe(ENGINE_VERSION);
    const checks = compareLabGoldenBaseline({ baseline, snapshots });
    expect(checks.every((check) => check.verdict === "PASS")).toBe(true);
    expect(checks.map((check) => check.name)).toEqual([
      "ks_team_points",
      "ks_game_totals",
      "ks_abs_differential",
    ]);
  });

  it("fails KS when the golden scores are disjoint", () => {
    const snapshots = matchingSnapshots(20);
    const baseline = buildLabGoldenBaseline({
      seed: 7,
      games: 20,
      scenarioId: "normal",
      rotation: "off",
      checksum: "abc",
      snapshots: matchingSnapshots(20).map((game, index) =>
        stubGame(10, 5, index),
      ),
    });
    const checks = compareLabGoldenBaseline({ baseline, snapshots });
    expect(checks.every((check) => check.verdict === "FAIL")).toBe(true);
  });

  it("refuses a different engineVersion", () => {
    const snapshots = matchingSnapshots(4);
    const baseline = buildLabGoldenBaseline({
      seed: 1,
      games: 4,
      scenarioId: "normal",
      rotation: "off",
      checksum: "abc",
      snapshots,
    });
    baseline.engineVersion = ENGINE_VERSION + 1;
    expect(() => compareLabGoldenBaseline({ baseline, snapshots })).toThrow(
      /engineVersion/,
    );
  });
});

describe("runLabGames golden baseline", () => {
  it("writes a golden and PASSes an unchanged same-seed rerun", () => {
    const dir = tempDir();
    const goldenPath = join(dir, "golden.json");
    const first = runLabGames({
      seed: 42,
      games: 2,
      rotation: "off",
      persist: false,
      writeBaselinePath: goldenPath,
    });
    const second = runLabGames({
      seed: 42,
      games: 2,
      rotation: "off",
      persist: false,
      baselinePath: goldenPath,
    });
    expect(first.checksum).toBe(second.checksum);
    expect(second.ksChecks?.every((check) => check.verdict === "PASS")).toBe(
      true,
    );
    expect(labExitCode(second, "pr")).toBe(0);
    const loaded = loadLabGoldenBaseline(goldenPath);
    expect(loaded.engineVersion).toBe(ENGINE_VERSION);
    expect(loaded.teamPoints.length).toBe(4);
  });

  it("fails the run when a mutated golden trips KS", () => {
    const dir = tempDir();
    const goldenPath = join(dir, "golden.json");
    runLabGames({
      seed: 42,
      games: 2,
      rotation: "off",
      persist: false,
      writeBaselinePath: goldenPath,
    });
    const parsed = JSON.parse(readFileSync(goldenPath, "utf8")) as LabGoldenBaseline;
    parsed.teamPoints = Array.from({ length: 40 }, () => 0);
    writeFileSync(goldenPath, `${JSON.stringify(parsed)}\n`, "utf8");
    const compared = runLabGames({
      seed: 42,
      games: 2,
      rotation: "off",
      persist: false,
      baselinePath: goldenPath,
    });
    const teamPoints = compared.ksChecks?.find(
      (check) => check.name === "ks_team_points",
    );
    expect(teamPoints?.verdict).toBe("FAIL");
    expect(labExitCode(compared, "pr")).toBe(1);
    expect(formatLabReport(compared)).toContain("GOLDEN BASELINE");
  });

  it("does not fold calibration into the checksum", () => {
    const plain = runLabGames({
      seed: 11,
      games: 2,
      rotation: "off",
      persist: false,
    });
    const calibrated = runLabGames({
      seed: 11,
      games: 2,
      rotation: "off",
      persist: false,
      calibrate: true,
    });
    expect(calibrated.checksum).toBe(plain.checksum);
    expect(calibrated.calibrationChecks?.length).toBeGreaterThan(0);
  });
});

describe("labExitCode KS", () => {
  it("fails PR when a KS check FAILs", () => {
    const engineIdentity = readEngineIdentity();
    const report: LabReport = {
      seed: 1,
      scenarioId: "normal",
      gamesSimulated: 2,
      rotation: "off",
      engineIdentity,
      reproCommand: formatReproCommand({ seed: 1, scenarioId: "normal" }),
      hardFailures: [],
      warnings: [],
      statChecks: [],
      checksum: "cafe",
      aggregates: null,
      overtimeHighCount: 0,
      ksChecks: [
        {
          name: "ks_team_points",
          verdict: "FAIL",
          value: 1,
          message: "team_points KS D=1.000 p=0.0000 n=40/40 [FAIL; α=0.01]",
        },
      ],
    };
    expect(labExitCode(report, "pr")).toBe(1);
    expect(engineIdentity.engineVersion).toBe(ENGINE_VERSION);
  });
});
