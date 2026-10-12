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

  it("fails the drifted box-score decade report (FG .572, 3P .479, FT .508)", () => {
    const checks = evaluateCalibration({
      ...inBand,
      fieldGoalPctMean: 0.572,
      threePointPctMean: 0.479,
      freeThrowPctMean: 0.508,
    });
    const failed = checks
      .filter((check) => check.verdict === "FAIL")
      .map((check) => check.name);
    expect(failed).toEqual([
      "field_goal_pct",
      "three_point_pct",
      "free_throw_pct",
    ]);
  });

  it("passes the measured canonical Lab means for both fidelities", () => {
    for (const measured of [
      // possession, seed 42 normal rotation on (300 games)
      {
        teamPointsMean: 97.1,
        gameTotalsMean: 194.2,
        fieldGoalPctMean: 0.441,
        threePointPctMean: 0.411,
        freeThrowPctMean: 0.768,
      },
      // box_score, same seed/scenario
      {
        teamPointsMean: 96.0,
        gameTotalsMean: 191.9,
        fieldGoalPctMean: 0.447,
        threePointPctMean: 0.416,
        freeThrowPctMean: 0.773,
      },
    ]) {
      expect(
        evaluateCalibration(measured).every(
          (check) => check.verdict === "PASS",
        ),
      ).toBe(true);
    }
  });

  it("fails each metric just outside its band", () => {
    const cases: [keyof typeof inBand, number][] = [
      ["teamPointsMean", CALIBRATION_BANDS.team_points.min - 1],
      ["teamPointsMean", CALIBRATION_BANDS.team_points.max + 1],
      ["gameTotalsMean", CALIBRATION_BANDS.game_totals.max + 1],
      ["fieldGoalPctMean", CALIBRATION_BANDS.field_goal_pct.min - 0.01],
      ["threePointPctMean", CALIBRATION_BANDS.three_point_pct.max + 0.01],
      ["freeThrowPctMean", CALIBRATION_BANDS.free_throw_pct.min - 0.01],
    ];
    for (const [key, value] of cases) {
      const checks = evaluateCalibration({ ...inBand, [key]: value });
      expect(checks.filter((check) => check.verdict === "FAIL")).toHaveLength(
        1,
      );
    }
  });

  it("keeps calibration independent of PLAUSIBILITY_BANDS, which stay untouched", () => {
    // Calibration is the tighter, NBA-inspired gate; plausibility is hashed
    // into engine identity and must not move with it.
    expect(CALIBRATION_BANDS.team_points.min).toBeGreaterThan(
      PLAUSIBILITY_BANDS.team_points.passMin,
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
          message: "team_points=300.000 outside calibration [88, 120]",
        },
      ],
    };
    expect(labExitCode(report, "pr")).toBe(1);
    expect(labExitCode(report, "nightly")).toBe(1);
    expect(formatLabReport(report)).toContain("CALIBRATION");
  });
});
