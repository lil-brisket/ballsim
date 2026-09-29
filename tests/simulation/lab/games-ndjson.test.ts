import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { formatLabReport } from "@/simulation/lab/report";
import { runLabGames } from "@/simulation/lab/run-lab-games";
import { parseGamesNdjson } from "@/simulation/lab/games-ndjson";
import { summarizeMetric } from "@/simulation/validation/aggregate";
import { gamesNeededForEffectSize } from "@/simulation/lab/confidence";

describe("Lab games.ndjson", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function tempResults(): string {
    const dir = mkdtempSync(join(tmpdir(), "lab-ndjson-"));
    dirs.push(dir);
    return dir;
  }

  it("streams per-game snapshots that recompute the same aggregates", () => {
    const resultsRoot = tempResults();
    const persisted = runLabGames({
      seed: 42,
      games: 2,
      rotation: "off",
      persist: true,
      resultsRoot,
      runId: "phase3-ndjson",
    });
    const ephemeral = runLabGames({
      seed: 42,
      games: 2,
      rotation: "off",
      persist: false,
    });
    expect(persisted.checksum).toBe(ephemeral.checksum);
    expect(persisted.gamesNdjsonPath).toBe(
      join(resultsRoot, "phase3-ndjson", "games.ndjson"),
    );
    const text = readFileSync(persisted.gamesNdjsonPath!, "utf8");
    const rows = parseGamesNdjson(text);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.gameIndex).toBe(0);
    expect(rows[1]!.gameIndex).toBe(1);
    expect(typeof rows[0]!.gameSeed).toBe("number");
    const recomputed = summarizeMetric(rows.map((row) => row.totalScore));
    expect(recomputed.mean).toBe(persisted.aggregates!.gameTotals.mean);
    expect(recomputed.n).toBe(persisted.aggregates!.gameTotals.n);
    expect(recomputed.ci95Low).toBe(persisted.aggregates!.gameTotals.ci95Low);
    expect(recomputed.ci95High).toBe(persisted.aggregates!.gameTotals.ci95High);
  });

  it("prints mean, 95% CI, n, and games-needed for key metrics", () => {
    const report = runLabGames({
      seed: 11,
      games: 2,
      rotation: "off",
      persist: false,
    });
    expect(report.aggregates).not.toBeNull();
    expect(report.aggregates!.teamPoints.n).toBe(4);
    expect(report.aggregates!.teamPoints.ci95Low).not.toBeNull();
    expect(report.powerEstimates?.length).toBe(10);
    const text = formatLabReport(report);
    expect(text).toContain("95%CI=[");
    expect(text).toContain("n=4");
    expect(text).toContain("SAMPLE SIZE (two-sample, 80% power, α=0.05)");
    expect(text).toContain(
      `team_points d=0.2 needs ${gamesNeededForEffectSize(0.2)} two-sample obs/group`,
    );
    expect(text).toContain(
      `abs_differential d=0.5 needs ${gamesNeededForEffectSize(0.5)} two-sample obs/group`,
    );
  });
});
