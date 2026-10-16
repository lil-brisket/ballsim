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

/**
 * Counting stats the box score projects from rosters (#95). Both engines
 * should also land near NBA rates: ~5 blocks and ~10-11 offensive rebounds.
 */
const PAIR_COUNTING_TOLERANCE = {
  blocks: 1,
  offensiveRebounds: 1.5,
} as const;
const COUNTING_BANDS = {
  blocks: { min: 3, max: 6.5 },
  offensiveRebounds: { min: 9, max: 13 },
} as const;

function headline(report: LabReport) {
  const aggregates = report.aggregates;
  if (aggregates == null) {
    throw new Error("Lab report has no aggregates.");
  }
  return {
    teamPoints: aggregates.teamPoints.mean,
    blocks: aggregates.blocks.mean,
    offensiveRebounds: aggregates.offensiveRebounds.mean,
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

  describe("across many roster pairs", () => {
    type PairMeans = {
      teamPoints: number;
      blocks: number;
      offensiveRebounds: number;
    };
    const means: Record<"possession" | "box_score", PairMeans> = {
      possession: { teamPoints: 0, blocks: 0, offensiveRebounds: 0 },
      box_score: { teamPoints: 0, blocks: 0, offensiveRebounds: 0 },
    };

    beforeAll(() => {
      for (const fidelity of ["possession", "box_score"] as const) {
        for (let seed = 1; seed <= PAIR_SEEDS; seed += 1) {
          const line = headline(
            runLabGames({ seed, games: PAIR_GAMES, fidelity }),
          );
          means[fidelity].teamPoints += line.teamPoints / PAIR_SEEDS;
          means[fidelity].blocks += line.blocks / PAIR_SEEDS;
          means[fidelity].offensiveRebounds +=
            line.offensiveRebounds / PAIR_SEEDS;
        }
      }
    }, 240_000);

    it("keeps mean PPG within tolerance", () => {
      const a = means.possession.teamPoints;
      const b = means.box_score.teamPoints;
      expect(
        Math.abs(b - a),
        `mean PPG possession=${a} box_score=${b}`,
      ).toBeLessThanOrEqual(PAIR_PPG_TOLERANCE);
    });

    it.each(["blocks", "offensiveRebounds"] as const)(
      "keeps mean %s within tolerance and a realistic band",
      (stat) => {
        const a = means.possession[stat];
        const b = means.box_score[stat];
        expect(
          Math.abs(b - a),
          `${stat} possession=${a} box_score=${b}`,
        ).toBeLessThanOrEqual(PAIR_COUNTING_TOLERANCE[stat]);
        for (const value of [a, b]) {
          expect(value).toBeGreaterThanOrEqual(COUNTING_BANDS[stat].min);
          expect(value).toBeLessThanOrEqual(COUNTING_BANDS[stat].max);
        }
      },
    );
  });
});
