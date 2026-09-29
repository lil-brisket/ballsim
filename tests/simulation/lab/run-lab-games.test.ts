import { describe, expect, it } from "vitest";
import {
  formatLabReport,
  formatReproCommand,
  labExitCode,
  readEngineIdentity,
  runLabGames,
  toLabFailure,
} from "@/simulation/lab";
import type { LabReport, RawInvariantFailure } from "@/simulation/lab/types";

describe("runLabGames", () => {
  it("is deterministic for the same seed", () => {
    const a = runLabGames({ seed: 42, games: 2, rotation: "off" });
    const b = runLabGames({ seed: 42, games: 2, rotation: "off" });
    expect(a.checksum).toBe(b.checksum);
    expect(a.reproCommand).toContain("--seed=42");
    expect(a.reproCommand).toContain("--scenario=normal");
  });

  it("includes engine identity definition checksums", () => {
    const identity = readEngineIdentity();
    expect(identity.packageVersion.length).toBeGreaterThan(0);
    expect(identity.schemaVersion).toBeGreaterThan(0);
    expect(identity.gameInvariantsChecksum).toMatch(/^[0-9a-f]{8}$/);
    expect(identity.plausibilityChecksum).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe("formatReproCommand", () => {
  it("prints npm run sim with seed and scenario", () => {
    expect(
      formatReproCommand({ seed: 837261, scenarioId: "normal", games: 100 }),
    ).toBe("npm run sim -- --seed=837261 --scenario=normal --games=100");
  });
});

function plantedReport(raw: RawInvariantFailure): LabReport {
  const engineIdentity = readEngineIdentity();
  const seed = 837261;
  const scenarioId = "normal";
  const reproCommand = formatReproCommand({
    seed,
    scenarioId,
    games: 1,
  });
  const failure = toLabFailure(raw, {
    seed,
    scenarioId,
    reproCommand,
    engineIdentity,
  });
  return {
    seed,
    scenarioId,
    gamesSimulated: 1,
    rotation: "off",
    engineIdentity,
    reproCommand,
    hardFailures: failure.severity === "HARD_FAILURE" ? [failure] : [],
    warnings: failure.severity === "WARNING" ? [failure] : [],
    statChecks: [],
    checksum: "deadbeef",
    aggregates: null,
    overtimeHighCount: 0,
  };
}

describe("harness negative path", () => {
  it("exits non-zero and prints the seed on a planted invariant failure", () => {
    const report = plantedReport({
      rule: "FGM_LE_FGA",
      detail: "FGM 10 > FGA 9",
    });
    expect(labExitCode(report, "pr")).toBe(1);
    const text = formatLabReport(report);
    expect(text).toContain("837261");
    expect(text).toContain(report.reproCommand);
    expect(text).toContain("FGM_LE_FGA");
  });

  it("does not fail PR channel on statistical FAIL without hard failures", () => {
    const engineIdentity = readEngineIdentity();
    const report: LabReport = {
      seed: 1,
      scenarioId: "normal",
      gamesSimulated: 1,
      rotation: "off",
      engineIdentity,
      reproCommand: formatReproCommand({ seed: 1, scenarioId: "normal" }),
      hardFailures: [],
      warnings: [],
      statChecks: [
        {
          name: "team_points",
          verdict: "FAIL",
          message: "team_points out of band",
          value: 200,
        },
      ],
      checksum: "cafe",
      aggregates: null,
      overtimeHighCount: 0,
    };
    expect(labExitCode(report, "pr")).toBe(0);
    expect(labExitCode(report, "nightly")).toBe(1);
  });
});
