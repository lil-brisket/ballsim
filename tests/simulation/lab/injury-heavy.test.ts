import { describe, expect, it } from "vitest";
import { runLabGames } from "@/simulation/lab";

describe("injury-heavy scenario", () => {
  it("runs a rotation-on game through post-game injury exposures", () => {
    const report = runLabGames({
      seed: 5,
      games: 1,
      scenarioId: "injury-heavy",
      rotation: "on",
    });
    expect(report.gamesSimulated).toBe(1);
    expect(report.scenarioId).toBe("injury-heavy");
  });
});
