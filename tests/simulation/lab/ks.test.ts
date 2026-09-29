import { describe, expect, it } from "vitest";
import {
  ksTwoSample,
  ksVerdict,
  LAB_DEFAULT_KS_ALPHA,
} from "@/simulation/lab/ks";

describe("ksTwoSample", () => {
  it("returns D=0 and p=1 for identical samples", () => {
    const result = ksTwoSample([1, 2, 3, 4], [1, 2, 3, 4]);
    expect(result.d).toBe(0);
    expect(result.pValue).toBe(1);
    expect(result.n1).toBe(4);
    expect(result.n2).toBe(4);
    expect(ksVerdict(result)).toBe("PASS");
  });

  it("returns D=1 for completely shifted samples", () => {
    const result = ksTwoSample([1, 1, 1, 1], [9, 9, 9, 9]);
    expect(result.d).toBe(1);
    expect(result.pValue).toBeGreaterThan(0);
    expect(result.pValue).toBeLessThan(1);
  });

  it("rejects empty samples", () => {
    expect(() => ksTwoSample([], [1])).toThrow(/non-empty/);
    expect(() => ksTwoSample([1], [])).toThrow(/non-empty/);
  });
});

describe("ksVerdict", () => {
  it("fails when p is below the default alpha", () => {
    const far = ksTwoSample(
      Array.from({ length: 40 }, () => 0),
      Array.from({ length: 40 }, () => 100),
    );
    expect(far.d).toBe(1);
    expect(far.pValue).toBeLessThan(LAB_DEFAULT_KS_ALPHA);
    expect(ksVerdict(far)).toBe("FAIL");
  });

  it("rejects alpha outside (0, 1)", () => {
    const result = ksTwoSample([1], [1]);
    expect(() => ksVerdict(result, 0)).toThrow(/alpha/);
    expect(() => ksVerdict(result, 1)).toThrow(/alpha/);
  });
});
