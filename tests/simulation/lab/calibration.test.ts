import { describe, expect, it } from "vitest";
import {
  CALIBRATION_BANDS,
  evaluateCalibration,
  formatLabReport,
  labExitCode,
  readEngineIdentity,
} from "@/simulation/lab";
import { formatReproCommand } from "@/simulation/lab/repro";
import type { LabReport } from "@/simulation/lab/types";
import { PLAUSIBILITY_BANDS } from "@/simulation/validation/plausibility";

const inBand = {
  teamPointsMean: 108,
  gameTotalsMean: 216,
  fieldGoalPctMean: 0.46,
  threePointPctMean: 0.36,
  freeThrowPctMean: 0.78,
};

describe("evaluateCalibration", () => {
  it("passes NBA-inspired in-band means", () => {
    const checks = evaluateCalibration(inBand);
    expect(checks.every((check) => check.verdict === "PASS")).toBe(true);
    expect(checks.map((check) => check.name)).toEqual([
      "team_points",
      "game_totals",
      "field_goal_pct",
      "three_point_pct",
      "free_throw_pct",
    ]);
  });

  it("fails 300 PPG", () => {
    const checks = evaluateCalibration({
      ...inBand,
      teamPointsMean: 300,
    });
    const points = checks.find((check) => check.name === "team_points");
    expect(points?.verdict).toBe("FAIL");
    expect(points?.value).toBe(300);
  });

  it("keeps calibration bands distinct from PLAUSIBILITY_BANDS", () => {
    expect(CALIBRATION_BANDS.team_points.min).toBeLessThan(
      PLAUSIBILITY_BANDS.team_points.passMin,
    );
    expect(CALIBRATION_BANDS.team_points.max).toBeGreaterThan(
      PLAUSIBILITY_BANDS.team_points.passMax,
    );
    expect(PLAUSIBILITY_BANDS.team_points.passMin).toBe(75);
    expect(PLAUSIBILITY_BANDS.team_points.passMax).toBe(125);
  });
});

describe("labExitCode calibration", () => {
  it("fails PR when a calibration check FAILs", () => {
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
      calibrationChecks: [
        {
          name: "team_points",
          verdict: "FAIL",
          value: 300,
          message: "team_points=300.000 outside calibration [70, 140]",
        },
      ],
    };
    expect(labExitCode(report, "pr")).toBe(1);
    expect(labExitCode(report, "nightly")).toBe(1);
    expect(formatLabReport(report)).toContain("CALIBRATION");
  });
});
