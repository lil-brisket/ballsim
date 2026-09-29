import { describe, expect, it } from "vitest";
import { labExitCode, runLabGames } from "@/simulation/lab";

describe("hard game invariants", () => {
  it("runs 100 deterministic rotation-on games from seed 42", () => {
    const a = runLabGames({ seed: 42, games: 100, rotation: "on" });
    const b = runLabGames({ seed: 42, games: 100, rotation: "on" });
    expect(a.checksum).toBe(b.checksum);
    expect(a.gamesSimulated).toBe(100);
    expect(a.rotation).toBe("on");
    for (const failure of a.hardFailures) {
      expect(failure.reproCommand).toContain("--seed=42");
    }
    const mismatch = a.hardFailures.filter(
      (failure) => failure.rule === "TEAM_SECONDS_MISMATCH",
    );
    if (mismatch.length > 0) {
      expect(mismatch[0]?.reproCommand).toContain("npm run sim --");
    }
    expect(labExitCode(a, "pr")).toBe(0);
    expect(a.hardFailures).toEqual([]);
  }, 60_000);
});
