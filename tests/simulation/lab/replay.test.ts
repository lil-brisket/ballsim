import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runLabGames } from "@/simulation/lab/run-lab-games";
import { replayLabGame } from "@/simulation/lab/replay-lab-game";
import type { ManifestHost } from "@/simulation/lab/manifest";

const host: ManifestHost = {
  now: () => new Date("2026-09-29T16:00:00.000Z"),
  readGit: () => ({ sha: "phase2sha", dirty: false }),
  nodeVersion: "v20.11.0",
};

describe("Lab failure artifacts and replay", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function tempResults(): string {
    const dir = mkdtempSync(join(tmpdir(), "lab-fail-"));
    dirs.push(dir);
    return dir;
  }

  it("writes failure NDJSON/JSON on an injected bug and replay matches then detects tampering", () => {
    const resultsRoot = tempResults();
    const report = runLabGames({
      seed: 17,
      games: 1,
      scenarioId: "normal",
      rotation: "off",
      persist: true,
      resultsRoot,
      runId: "phase2-fail",
      host,
      afterSimulateGame: (result) => ({
        ...result,
        score: { home: -8, away: result.score.away },
      }),
    });
    expect(
      report.hardFailures.some((item) => item.rule === "SCORE_NONNEG"),
    ).toBe(true);
    expect(report.failureArtifacts).toHaveLength(1);
    const ndjsonPath = join(resultsRoot, "phase2-fail", "failures", "0.ndjson");
    const jsonPath = join(resultsRoot, "phase2-fail", "failures", "0.json");
    expect(existsSync(ndjsonPath)).toBe(true);
    expect(existsSync(jsonPath)).toBe(true);
    const record = JSON.parse(readFileSync(jsonPath, "utf8")) as {
      gameIndex: number;
      seed: number;
      failures: { rule: string }[];
      config: { scenarioId: string };
    };
    expect(record.gameIndex).toBe(0);
    expect(typeof record.seed).toBe("number");
    expect(record.config.scenarioId).toBe("normal");
    expect(record.failures.some((item) => item.rule === "SCORE_NONNEG")).toBe(
      true,
    );

    const matched = replayLabGame({
      runId: "phase2-fail",
      gameIndex: 0,
      resultsRoot,
    });
    expect(matched.matches).toBe(true);
    expect(
      matched.storedFailures.some((item) => item.rule === "SCORE_NONNEG"),
    ).toBe(true);
    expect(
      matched.replayFailures.some((item) => item.rule === "SCORE_NONNEG"),
    ).toBe(false);

    writeFileSync(
      ndjsonPath,
      `${readFileSync(ndjsonPath, "utf8")}{"sequence":999,"type":"steal","playerId":null,"teamId":null}\n`,
    );
    const diverged = replayLabGame({
      runId: "phase2-fail",
      gameIndex: 0,
      resultsRoot,
    });
    expect(diverged.matches).toBe(false);
    expect(diverged.diffs.length).toBeGreaterThan(0);
  });
});
