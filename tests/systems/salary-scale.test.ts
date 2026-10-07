import { describe, expect, it } from "vitest";
import { DEFAULT_SALARY_CAP } from "@/systems/salary-cap-config";
import {
  isSalaryLowball,
  isVetMinExceptionSalary,
  salaryForPlayer,
  serviceYearsForSalary,
  vetMinSalary,
} from "@/systems/salary-scale";

describe("salaryForPlayer", () => {
  it("puts 90+ FA salary in the top cap tier", () => {
    const salary = salaryForPlayer({
      overall: 92,
      age: 27,
      years: 8,
      cap: DEFAULT_SALARY_CAP,
      kind: "fa",
    });
    expect(salary).toBeGreaterThanOrEqual(DEFAULT_SALARY_CAP * 0.25);
    expect(salary).toBeLessThanOrEqual(DEFAULT_SALARY_CAP * 0.35);
  });

  it("keeps rookies cheaper than equivalent veterans", () => {
    const input = { overall: 80, age: 21, years: 0, cap: DEFAULT_SALARY_CAP };
    const rookie = salaryForPlayer({ ...input, kind: "rookie" });
    const vet = salaryForPlayer({ ...input, age: 26, kind: "fa" });
    expect(rookie).toBeLessThan(vet);
  });

  it("scales with the salary cap", () => {
    const small = salaryForPlayer({
      overall: 90,
      age: 26,
      years: 4,
      cap: 50_000_000,
      kind: "fa",
    });
    const large = salaryForPlayer({
      overall: 90,
      age: 26,
      years: 4,
      cap: 200_000_000,
      kind: "fa",
    });
    expect(large).toBeGreaterThan(small * 2);
  });

  it("rejects a 90+ lowball relative to market", () => {
    const market = salaryForPlayer({
      overall: 91,
      age: 28,
      years: 6,
      cap: DEFAULT_SALARY_CAP,
      kind: "fa",
    });
    expect(isSalaryLowball(8_000_000, market)).toBe(true);
    expect(isSalaryLowball(market, market)).toBe(false);
  });

  it("treats vet-min deals as cap exceptions", () => {
    const minDeal = vetMinSalary(DEFAULT_SALARY_CAP);
    expect(isVetMinExceptionSalary(minDeal, DEFAULT_SALARY_CAP)).toBe(true);
    expect(
      isVetMinExceptionSalary(DEFAULT_SALARY_CAP * 0.25, DEFAULT_SALARY_CAP),
    ).toBe(false);
  });

  it("infers service years from history, then draft class, then age", () => {
    expect(
      serviceYearsForSalary({
        age: 28,
        seasonYear: 2026,
        seasonsPlayed: 6,
      }),
    ).toBe(6);
    expect(
      serviceYearsForSalary({
        age: 22,
        seasonYear: 2026,
        draftSeasonYear: 2024,
      }),
    ).toBe(2);
    expect(
      serviceYearsForSalary({
        age: 28,
        seasonYear: 2026,
      }),
    ).toBe(9);
  });
});
