import { describe, expect, it } from "vitest";
import { evaluateGraduation } from "@/simulation/lab/graduation";

describe("statistical graduation", () => {
  it("stays monitor until five nightly values exist", () => {
    const result = evaluateGraduation({
      baselineMedian: 100,
      nightlyValues: [99, 101, 100],
    });
    expect(result.status).toBe("monitor");
  });

  it("is warning-eligible when five values sit inside ±3×MAD", () => {
    const result = evaluateGraduation({
      baselineMedian: 100,
      nightlyValues: [99, 100, 101, 100, 99],
    });
    expect(result.status).toBe("warning-eligible");
  });
});
