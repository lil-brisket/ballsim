import { describe, expect, it } from "vitest";
import {
  runRegressionCases,
  type RegressionCase,
} from "@/simulation/lab/regression/run-regression-cases";
import { readEngineIdentity } from "@/simulation/lab/engine-identity";

describe("regression cases", () => {
  it("skips obsolete cases without running games", () => {
    const cases: RegressionCase[] = [
      {
        id: "reg-obsolete",
        seed: 1,
        scenario: "normal",
        engineIdentity: readEngineIdentity(),
        invariantId: "NO_TIE",
        reproCommand: "npm run sim -- --seed=1 --scenario=normal",
        status: "obsolete",
      },
    ];
    const results = runRegressionCases(cases);
    expect(results[0]?.reproduced).toBe(false);
    expect(results[0]?.status).toBe("obsolete");
  });
});
