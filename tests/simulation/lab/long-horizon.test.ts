import { describe, expect, it } from "vitest";
import { labExitCode, runLabSeason } from "@/simulation/lab";

describe("Lab long-horizon wrapper", () => {
  it("runs one in-memory owner-career season", () => {
    const { report, series } = runLabSeason({ seed: 11, seasons: 1 });
    expect(report.seasonsSimulated).toBe(1);
    expect(report.scenarioId).toBe("owner-career");
    expect(series.length).toBeGreaterThan(0);
    expect(labExitCode(report, "pr")).toBe(0);
  }, 60_000);
});
