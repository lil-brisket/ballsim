import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { EngineIdentity } from "@/simulation/lab/types";
import { runLabGames } from "@/simulation/lab/run-lab-games";

export type RegressionCaseStatus = "active" | "obsolete";

export type RegressionCase = {
  id: string;
  seed: number | string;
  scenario: string;
  engineIdentity: EngineIdentity;
  invariantId: string;
  reproCommand: string;
  status: RegressionCaseStatus;
  games?: number;
  rotation?: "on" | "off";
};

export function loadRegressionCases(dir: string): RegressionCase[] {
  let names: string[] = [];
  try {
    names = readdirSync(dir).filter((name) => name.endsWith(".json"));
  } catch {
    return [];
  }
  return names.map((name) => {
    const raw = readFileSync(join(dir, name), "utf8");
    return JSON.parse(raw) as RegressionCase;
  });
}

export function defaultRegressionDir(): string {
  return join(process.cwd(), "src/simulation/lab/regression/cases");
}

export type RegressionRunResult = {
  id: string;
  status: RegressionCaseStatus;
  reproduced: boolean;
  hardFailureRules: string[];
  reproCommand: string;
};

/**
 * Re-runs active cases. A case "reproduces" when the named invariantId appears
 * in hardFailures. Obsolete cases are skipped.
 *
 * Rebaseline ownership: a PR must (a) name the engine/config change, (b) show
 * the metric/identity shift, (c) update the JSON or mark status obsolete in the
 * same commit.
 */
export function runRegressionCases(
  cases: readonly RegressionCase[],
): RegressionRunResult[] {
  const results: RegressionRunResult[] = [];
  for (const item of cases) {
    if (item.status === "obsolete") {
      results.push({
        id: item.id,
        status: item.status,
        reproduced: false,
        hardFailureRules: [],
        reproCommand: item.reproCommand,
      });
      continue;
    }
    const report = runLabGames({
      seed: item.seed,
      scenarioId: item.scenario,
      games: item.games ?? 1,
      rotation: item.rotation ?? "on",
    });
    const hardFailureRules = report.hardFailures.map((failure) => failure.rule);
    results.push({
      id: item.id,
      status: item.status,
      reproduced: hardFailureRules.includes(item.invariantId),
      hardFailureRules,
      reproCommand: report.reproCommand,
    });
  }
  return results;
}
