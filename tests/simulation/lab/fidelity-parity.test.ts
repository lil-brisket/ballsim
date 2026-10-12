import { beforeAll, describe, expect, it } from "vitest";
import { labExitCode, runLabGames } from "@/simulation/lab";
import type { LabReport } from "@/simulation/lab/types";

/**
 * GAME_DESIGN.md: box-score is a projection of the possession sim, not a
 * second sport. Both fidelities run the same seeded Lab scenario and must
 * agree on the headline shooting and scoring rates.
 */
const SEED = 42;
const GAMES = 300;

/** Max |box_score - possession| on the canonical scenario. */
const TOLERANCE = {
  teamPoints: 3,
  fieldGoalPct: 0.02,
  threePointPct: 0.025,
  freeThrowPct: 0.025,
} as const;

function headline(report: LabReport) {
  const aggregates = report.aggregates;
  if (aggregates == null) {
    throw new Error("Lab report has no aggregates.");
  }
  return {
    teamPoints: aggregates.teamPoints.mean,
    fieldGoalPct: aggregates.fieldGoalPct.mean,
    threePointPct: aggregates.threePointPct.mean,
    freeThrowPct: aggregates.freeThrowPct.mean,
  };
}

describe("fidelity parity (possession vs box_score)", () => {
  let possession: LabReport;
  let boxScore: LabReport;

  beforeAll(() => {
    possession = runLabGames({
      seed: SEED,
      games: GAMES,
      fidelity: "possession",
      calibrate: true,
    });
    boxScore = runLabGames({
      seed: SEED,
      games: GAMES,
      fidelity: "box_score",
      calibrate: true,
    });
  }, 240_000);

  it("passes --calibrate on the box_score path (PR-gating)", () => {
    expect(boxScore.hardFailures).toEqual([]);
    expect(boxScore.calibrationChecks?.length).toBeGreaterThan(0);
    for (const check of boxScore.calibrationChecks ?? []) {
      expect(check.verdict, check.message).toBe("PASS");
    }
    expect(labExitCode(boxScore, "pr")).toBe(0);
  });

  it("passes --calibrate on the possession path", () => {
    for (const check of possession.calibrationChecks ?? []) {
      expect(check.verdict, check.message).toBe("PASS");
    }
    expect(labExitCode(possession, "pr")).toBe(0);
  });

  it("records the fidelity in the repro command", () => {
    expect(boxScore.reproCommand).toContain("--fidelity=box_score");
    expect(possession.reproCommand).not.toContain("--fidelity");
  });

  it("keeps FG%, 3P%, FT% and PPG within tolerance of each other", () => {
    const a = headline(possession);
    const b = headline(boxScore);
    expect(
      Math.abs(b.teamPoints - a.teamPoints),
      `PPG possession=${a.teamPoints} box_score=${b.teamPoints}`,
    ).toBeLessThanOrEqual(TOLERANCE.teamPoints);
    expect(
      Math.abs(b.fieldGoalPct - a.fieldGoalPct),
      `FG% possession=${a.fieldGoalPct} box_score=${b.fieldGoalPct}`,
    ).toBeLessThanOrEqual(TOLERANCE.fieldGoalPct);
    expect(
      Math.abs(b.threePointPct - a.threePointPct),
      `3P% possession=${a.threePointPct} box_score=${b.threePointPct}`,
    ).toBeLessThanOrEqual(TOLERANCE.threePointPct);
    expect(
      Math.abs(b.freeThrowPct - a.freeThrowPct),
      `FT% possession=${a.freeThrowPct} box_score=${b.freeThrowPct}`,
    ).toBeLessThanOrEqual(TOLERANCE.freeThrowPct);
  });
});
