import { describe, expect, it } from "vitest";
import {
  SOAK_DEFAULTS,
  buildBusyActions,
  formatFailure,
  normalizePhaseName,
  parseSoakArgs,
  replayCommand,
  runSoakCase,
  type SoakFailure,
} from "./soak";

describe("parseSoakArgs", () => {
  it("defaults to 8 seeds x 12 seasons on both profiles", () => {
    expect(parseSoakArgs([])).toEqual(SOAK_DEFAULTS);
    expect(SOAK_DEFAULTS).toMatchObject({
      seeds: 8,
      seasons: 12,
      seedStart: 1,
      profile: "both",
      maxSeasonMs: 120_000,
      maxPhaseDays: 400,
    });
  });

  it("reads flags with a space or an equals sign", () => {
    const options = parseSoakArgs([
      "--seeds",
      "3",
      "--seasons=2",
      "--seed-start",
      "10",
      "--profile",
      "busy",
      "--fail-fast",
      "--verify-determinism",
    ]);
    expect(options).toMatchObject({
      seeds: 3,
      seasons: 2,
      seedStart: 10,
      profile: "busy",
      failFast: true,
      verifyDeterminism: true,
    });
  });

  it("builds a replay from seed, season and phase", () => {
    const options = parseSoakArgs([
      "--seed",
      "17",
      "--profile",
      "busy",
      "--season",
      "6",
      "--phase",
      "free-agency",
    ]);
    expect(options.replay).toEqual({
      seed: 17,
      season: 6,
      phase: "offseason.free_agency",
    });
  });

  it("rejects bad input", () => {
    expect(() => parseSoakArgs(["--seeds", "0"])).toThrow(/positive integer/);
    expect(() => parseSoakArgs(["--profile", "x"])).toThrow(/--profile/);
    expect(() => parseSoakArgs(["--nope"])).toThrow(/Unknown flag/);
    expect(() => parseSoakArgs(["--seed", "3"])).toThrow(/Replay needs/);
  });
});

describe("normalizePhaseName", () => {
  it("accepts names with or without the prefix", () => {
    expect(normalizePhaseName("free-agency")).toBe("offseason.free_agency");
    expect(normalizePhaseName("free_agency")).toBe("offseason.free_agency");
    expect(normalizePhaseName("offseason.draft")).toBe("offseason.draft");
    expect(normalizePhaseName("regular")).toBe("regular");
    expect(normalizePhaseName("preseason.preparation")).toBe(
      "preseason.preparation",
    );
    expect(normalizePhaseName("season-review")).toBe(
      "postseason.season_review",
    );
    expect(() => normalizePhaseName("nonsense")).toThrow(/Unknown phase/);
  });
});

describe("failure report", () => {
  const failure: SoakFailure = {
    kind: "invariant",
    seed: 17,
    profile: "busy",
    seasonIndex: 6,
    seasonYear: 2031,
    phaseId: "offseason.free_agency",
    summary: "Invariants broken.",
    issues: [{ code: "ROSTER_SIZE", message: "Team has 20 players." }],
    diff: ["freeAgentPool: 31 -> 12"],
  };

  it("prints a copy-paste replay command", () => {
    expect(replayCommand(failure)).toBe(
      "npm run test:offseason-soak -- --seed 17 --profile busy --season 6 --phase free-agency",
    );
    expect(replayCommand({ ...failure, probeSalaryBounds: true })).toMatch(
      /--probe-salary-bounds$/,
    );
  });

  it("lists codes, the snapshot diff and the replay command", () => {
    const text = formatFailure(failure);
    expect(text).toContain("seed 17, profile busy, season 6 (2031)");
    expect(text).toContain("[ROSTER_SIZE] Team has 20 players.");
    expect(text).toContain("freeAgentPool: 31 -> 12");
    expect(text).toContain("replay: npm run test:offseason-soak");
  });
});

describe("buildBusyActions", () => {
  const describeActions = (seed: number, phaseIndex: number) =>
    buildBusyActions(seed, phaseIndex, "offseason.free_agency").map(
      (action) => `${action.label}@${action.onDay}`,
    );

  it("is a pure function of seed and phase", () => {
    for (let phaseIndex = 0; phaseIndex < 12; phaseIndex += 1) {
      expect(describeActions(5, phaseIndex)).toEqual(
        describeActions(5, phaseIndex),
      );
    }
  });

  it("differs across seeds and phases", () => {
    const all = (seed: number) =>
      Array.from({ length: 12 }, (_, i) => describeActions(seed, i).join(","));
    expect(all(5)).not.toEqual(all(6));
    expect(new Set(all(5)).size).toBeGreaterThan(3);
  });
});

describe("runSoakCase", () => {
  it("runs the first phase of a busy league and checks its boundary", () => {
    const result = runSoakCase({
      seed: 3,
      profile: "busy",
      seasons: 1,
      maxSeasonMs: 120_000,
      maxPhaseDays: 400,
      stopAfter: { season: 1, phase: "preseason.preparation" },
    });
    expect(result.failures).toEqual([]);
    expect(result.stopped).toBe(true);
  }, 60_000);
});
