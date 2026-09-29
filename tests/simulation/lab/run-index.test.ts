import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadLabRunIndex, pruneLabRuns, runLabGames } from "@/simulation/lab";
import type { ManifestHost } from "@/simulation/lab/manifest";

const baseHost: ManifestHost = {
  readGit: () => ({ sha: "abc", dirty: false }),
  nodeVersion: "v20.11.0",
};

describe("Lab run index and retention", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function tempResults(): string {
    const dir = mkdtempSync(join(tmpdir(), "lab-index-"));
    dirs.push(dir);
    return dir;
  }

  it("appends a persisted game run to results/index.json", () => {
    const resultsRoot = tempResults();
    runLabGames({
      seed: 7,
      games: 1,
      rotation: "off",
      persist: true,
      resultsRoot,
      runId: "idx-game",
      host: {
        ...baseHost,
        now: () => new Date("2026-09-29T16:00:00.000Z"),
      },
    });
    const index = loadLabRunIndex(resultsRoot);
    expect(index.runs).toHaveLength(1);
    expect(index.runs[0]?.runId).toBe("idx-game");
    expect(index.runs[0]?.scenarioName).toBe("normal");
    expect(index.runs[0]?.scenarioVersion).toBe(1);
    expect(index.runs[0]?.games).toBe(1);
  });

  it("prunes oldest runs when --keep is set", () => {
    const resultsRoot = tempResults();
    const stamps = [
      "2026-09-29T10:00:00.000Z",
      "2026-09-29T11:00:00.000Z",
      "2026-09-29T12:00:00.000Z",
    ];
    const ids = ["keep-a", "keep-b", "keep-c"];
    for (let index = 0; index < ids.length; index += 1) {
      runLabGames({
        seed: 8,
        games: 1,
        rotation: "off",
        persist: true,
        resultsRoot,
        runId: ids[index],
        keep: 2,
        host: {
          ...baseHost,
          now: () => new Date(stamps[index]!),
        },
      });
    }
    expect(existsSync(join(resultsRoot, "keep-a"))).toBe(false);
    expect(existsSync(join(resultsRoot, "keep-b"))).toBe(true);
    expect(existsSync(join(resultsRoot, "keep-c"))).toBe(true);
    const index = loadLabRunIndex(resultsRoot);
    expect(index.runs.map((row) => row.runId).sort()).toEqual(["keep-b", "keep-c"]);
  });

  it("does not prune when keep is omitted", () => {
    const resultsRoot = tempResults();
    runLabGames({
      seed: 1,
      games: 1,
      rotation: "off",
      persist: true,
      resultsRoot,
      runId: "keep-one",
      host: baseHost,
    });
    runLabGames({
      seed: 1,
      games: 1,
      rotation: "off",
      persist: true,
      resultsRoot,
      runId: "keep-two",
      host: baseHost,
    });
    expect(existsSync(join(resultsRoot, "keep-one"))).toBe(true);
    expect(existsSync(join(resultsRoot, "keep-two"))).toBe(true);
    expect(pruneLabRuns({ resultsRoot, keep: 1 }).removed).toEqual(["keep-one"]);
  });
});
