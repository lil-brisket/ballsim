import { describe, expect, it } from "vitest";
import { formatLabReport, labExitCode, toLabFailure } from "@/simulation/lab";
import { formatReproCommand } from "@/simulation/lab/repro";
import { readEngineIdentity } from "@/simulation/lab/engine-identity";
import type { LabReport } from "@/simulation/lab/types";

describe("planted invariant failure", () => {
  it("CLI report path includes seed and non-zero pr exit", () => {
    const seed = 837261;
    const scenarioId = "normal";
    const reproCommand = formatReproCommand({ seed, scenarioId, games: 1 });
    const engineIdentity = readEngineIdentity();
    const failure = toLabFailure(
      { rule: "NO_TIE", detail: "final score tied 100-100" },
      { seed, scenarioId, reproCommand, engineIdentity },
    );
    const report: LabReport = {
      seed,
      scenarioId,
      gamesSimulated: 1,
      rotation: "off",
      engineIdentity,
      reproCommand,
      hardFailures: [failure],
      warnings: [],
      statChecks: [],
      checksum: "planted",
      aggregates: null,
      overtimeHighCount: 0,
    };
    expect(labExitCode(report, "pr")).toBe(1);
    const output = formatLabReport(report);
    expect(output).toContain(String(seed));
    expect(output).toContain(reproCommand);
  });
});
