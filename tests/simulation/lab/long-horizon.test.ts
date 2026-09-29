import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { labExitCode, runLabSeason } from "@/simulation/lab";
import { ENGINE_VERSION } from "@/simulation/lab/engine-version";
import { loadLabManifest } from "@/simulation/lab/manifest";
import { OWNER_CAREER_SCENARIO_ID } from "@/simulation/lab/scenario-version";

describe("Lab long-horizon wrapper", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("runs one in-memory owner-career season", () => {
    const resultsRoot = mkdtempSync(join(tmpdir(), "lab-career-"));
    dirs.push(resultsRoot);
    const { report, series } = runLabSeason({
      seed: 11,
      seasons: 1,
      persist: true,
      resultsRoot,
      runId: "phase1-career",
      host: {
        now: () => new Date("2026-09-29T16:00:00.000Z"),
        readGit: () => ({ sha: "careersha", dirty: false }),
        nodeVersion: "v20.11.0",
      },
    });
    expect(report.seasonsSimulated).toBe(1);
    expect(report.scenarioId).toBe(OWNER_CAREER_SCENARIO_ID);
    expect(series.length).toBeGreaterThan(0);
    expect(labExitCode(report, "pr")).toBe(0);
    expect(report.engineIdentity.engineVersion).toBe(ENGINE_VERSION);
    const manifest = loadLabManifest(report.manifestPath!);
    expect(manifest.config.mode).toBe("owner-career");
    expect(manifest.engineVersion).toBe(ENGINE_VERSION);
    expect(manifest.seedList).toHaveLength(1);
  }, 60_000);
});
