import { beforeAll, describe, expect, it } from "vitest";
import { labExitCode, runLabGames } from "@/simulation/lab";
import type { LabReport } from "@/simulation/lab/types";

/**
 * GAME_DESIGN.md: box-score is a projection of the possession sim, not a
 * second sport. Both fidelities run the same seeded Lab scenario and must
 * agree on the headline shooting rates; scoring must agree on average across
 * many roster pairs.
 */
const SEED = 42;
const GAMES = 300;

/** Max |box_score - possession| on the canonical scenario. */
const TOLERANCE = {
  fieldGoalPct: 0.02,
  threePointPct: 0.025,
  freeThrowPct: 0.025,
} as const;

/**
 * Scoring is checked across many roster pairs rather than on the canonical
 * pair alone. A single pair carries 2-4 points of roster-specific model error,
 * and the old single-pair PPG gate let box-score run ~9 points high on typical
 * rosters while matching seed 42.
 */
const PAIR_SEEDS = 40;
const PAIR_GAMES = 30;
const PAIR_PPG_TOLERANCE = 1.5;

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

  it("keeps FG%, 3P% and FT% within tolerance of each other", () => {
    const a = headline(possession);
    const b = headline(boxScore);
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

  it(
    "keeps mean PPG within tolerance across many roster pairs",
    { timeout: 240_000 },
    () => {
      let possessionPoints = 0;
      let boxScorePoints = 0;
      for (let seed = 1; seed <= PAIR_SEEDS; seed += 1) {
        possessionPoints += headline(
          runLabGames({ seed, games: PAIR_GAMES, fidelity: "possession" }),
        ).teamPoints;
        boxScorePoints += headline(
          runLabGames({ seed, games: PAIR_GAMES, fidelity: "box_score" }),
        ).teamPoints;
      }
      const a = possessionPoints / PAIR_SEEDS;
      const b = boxScorePoints / PAIR_SEEDS;
      expect(
        Math.abs(b - a),
        `mean PPG possession=${a} box_score=${b}`,
      ).toBeLessThanOrEqual(PAIR_PPG_TOLERANCE);
    },
  );
});
