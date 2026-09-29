import { describe, expect, it } from "vitest";
import { runLabSchedule } from "@/simulation/lab/run-lab-schedule";

describe("runLabSchedule", () => {
  it("advances a CBL world for a few days without throwing", () => {
    const result = runLabSchedule({
      seed: 42,
      preset: "cbl",
      until: "regular",
      maxDays: 3,
    });
    expect(result.daysAdvanced).toBeGreaterThanOrEqual(1);
    expect(result.daysAdvanced).toBeLessThanOrEqual(3);
    expect(result.preset).toBe("cbl");
    expect(result.engineIdentity.schemaVersion).toBeGreaterThan(0);
    expect(result.checksum.length).toBeGreaterThan(0);
    expect(result.standings.teamCount).toBeGreaterThan(0);
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
