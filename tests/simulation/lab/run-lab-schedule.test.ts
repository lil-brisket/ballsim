import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadLabManifest } from "@/simulation/lab/manifest";
import { runLabSchedule } from "@/simulation/lab/run-lab-schedule";
import { ENGINE_VERSION } from "@/simulation/lab/engine-version";
import { SCHEDULE_SCENARIO_ID } from "@/simulation/lab/scenario-version";

describe("runLabSchedule", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("advances a CBL world for a few days without throwing", () => {
    const resultsRoot = mkdtempSync(join(tmpdir(), "lab-sched-"));
    dirs.push(resultsRoot);
    const result = runLabSchedule({
      seed: 42,
      preset: "cbl",
      until: "regular",
      maxDays: 3,
      persist: true,
      resultsRoot,
      runId: "phase1-schedule",
      host: {
        now: () => new Date("2026-09-29T16:00:00.000Z"),
        readGit: () => ({ sha: "schedsha", dirty: false }),
        nodeVersion: "v20.11.0",
      },
    });
    expect(result.daysAdvanced).toBeGreaterThanOrEqual(1);
    expect(result.daysAdvanced).toBeLessThanOrEqual(3);
    expect(result.preset).toBe("cbl");
    expect(result.engineIdentity.schemaVersion).toBeGreaterThan(0);
    expect(result.engineIdentity.engineVersion).toBe(ENGINE_VERSION);
    expect(result.checksum.length).toBeGreaterThan(0);
    expect(result.standings.teamCount).toBeGreaterThan(0);
    const manifest = loadLabManifest(result.manifestPath!);
    expect(manifest.scenarioName).toBe(SCHEDULE_SCENARIO_ID);
    expect(manifest.config.mode).toBe("schedule");
    expect(manifest.engineVersion).toBe(ENGINE_VERSION);
    expect(manifest.seedList).toHaveLength(1);
  }, 30_000);

  it("rejects a non-positive maxDays", () => {
    expect(() =>
      runLabSchedule({
        seed: 1,
        preset: "cbl",
        until: "regular",
        maxDays: 0,
      }),
    ).toThrow(/maxDays/);
  });
});
