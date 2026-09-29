import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ENGINE_VERSION } from "@/simulation/lab/engine-version";
import { loadLabManifest, type ManifestHost } from "@/simulation/lab/manifest";
import { runLabGames } from "@/simulation/lab/run-lab-games";
import { runLabGamesFromManifest } from "@/simulation/lab/run-from-manifest";
import { buildNormalRosters } from "@/simulation/lab/scenarios/normal";

const host: ManifestHost = {
  now: () => new Date("2026-09-29T16:00:00.000Z"),
  readGit: () => ({
    sha: "0123456789abcdef0123456789abcdef01234567",
    dirty: true,
  }),
  nodeVersion: "v20.11.0",
};

describe("Lab run manifest", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function tempResults(): string {
    const dir = mkdtempSync(join(tmpdir(), "lab-manifest-"));
    dirs.push(dir);
    return dir;
  }

  it("writes results/<runId>/manifest.json before the first game", () => {
    const resultsRoot = tempResults();
    let rosterBuilt = false;
    const report = runLabGames({
      seed: 7,
      games: 2,
      scenarioId: "normal",
      rotation: "off",
      persist: true,
      resultsRoot,
      runId: "phase1-game",
      host: {
        ...host,
        writeFile: (filePath, contents) => {
          if (filePath.endsWith("manifest.json")) {
            expect(rosterBuilt).toBe(false);
          }
          writeFileSync(filePath, contents, "utf8");
        },
      },
      buildRosters: (rng) => {
        rosterBuilt = true;
        return buildNormalRosters(rng);
      },
    });
    expect(report.runId).toBe("phase1-game");
    expect(report.manifestPath).toBe(
      join(resultsRoot, "phase1-game", "manifest.json"),
    );
    const manifest = loadLabManifest(report.manifestPath!);
    expect(manifest.runId).toBe("phase1-game");
    expect(manifest.startedAt).toBe("2026-09-29T16:00:00.000Z");
    expect(manifest.gitSha).toBe("0123456789abcdef0123456789abcdef01234567");
    expect(manifest.dirty).toBe(true);
    expect(manifest.nodeVersion).toBe("v20.11.0");
    expect(manifest.engineVersion).toBe(ENGINE_VERSION);
    expect(manifest.scenarioName).toBe("normal");
    expect(manifest.scenarioVersion).toBe(1);
    expect(manifest.config).toEqual({
      mode: "game",
      seed: 7,
      games: 2,
      scenarioId: "normal",
      rotation: "off",
    });
    expect(manifest.seedList.length).toBe(3);
    expect(manifest.engineIdentity.engineVersion).toBe(ENGINE_VERSION);
    expect(JSON.parse(readFileSync(report.manifestPath!, "utf8")).runId).toBe(
      "phase1-game",
    );
  });

  it("reproduces a run from the manifest seed list alone", () => {
    const resultsRoot = tempResults();
    const first = runLabGames({
      seed: 99,
      games: 2,
      scenarioId: "normal",
      rotation: "off",
      persist: true,
      resultsRoot,
      runId: "phase1-repro",
      host,
    });
    const manifest = loadLabManifest(first.manifestPath!);
    const second = runLabGamesFromManifest(manifest);
    expect(second.checksum).toBe(first.checksum);
    expect(second.gamesSimulated).toBe(2);
  });

  it("refuses to replay a manifest from another engineVersion", () => {
    const resultsRoot = tempResults();
    const first = runLabGames({
      seed: 3,
      games: 1,
      rotation: "off",
      persist: true,
      resultsRoot,
      runId: "phase1-mismatch",
      host,
    });
    const manifest = loadLabManifest(first.manifestPath!);
    expect(() =>
      runLabGamesFromManifest({
        ...manifest,
        engineVersion: ENGINE_VERSION + 1,
      }),
    ).toThrow(/engineVersion/);
  });
});
