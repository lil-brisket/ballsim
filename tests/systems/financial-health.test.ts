import { describe, expect, it } from "vitest";
import { calculateFinancialHealth } from "@/systems/financial-health";

describe("calculateFinancialHealth", () => {
  it("returns insolvent when cash is at or below zero", () => {
    expect(
      calculateFinancialHealth({
        cash: 0,
        weeklyOutflow: 1_000_000,
        netWeeklyBurn: 100_000,
        runwayWeeks: 0,
        projectedCash: -1,
      }),
    ).toBe("insolvent");
    expect(
      calculateFinancialHealth({
        cash: -1,
        weeklyOutflow: 1,
        netWeeklyBurn: 1,
        runwayWeeks: 0,
        projectedCash: 10_000_000,
      }),
    ).toBe("insolvent");
  });

  it("uses projected cash as the primary critical signal", () => {
    expect(
      calculateFinancialHealth({
        cash: 10_000_000,
        weeklyOutflow: 1_000_000,
        netWeeklyBurn: 0,
        runwayWeeks: 12,
        projectedCash: -500_000,
      }),
    ).toBe("critical");
  });

  it("does not treat cash below 2x weekly outflow as automatically critical", () => {
    expect(
      calculateFinancialHealth({
        cash: 1_500_000,
        weeklyOutflow: 1_000_000,
        netWeeklyBurn: -200_000,
        runwayWeeks: null,
        projectedCash: 4_000_000,
      }),
    ).toBe("stable");
  });

  it("returns warning for short positive runway", () => {
    expect(
      calculateFinancialHealth({
        cash: 20_000_000,
        weeklyOutflow: 1_000_000,
        netWeeklyBurn: 500_000,
        runwayWeeks: 6,
        projectedCash: 5_000_000,
      }),
    ).toBe("warning");
  });

  it("returns stable when cash is positive with limited margin", () => {
    expect(
      calculateFinancialHealth({
        cash: 3_000_000,
        weeklyOutflow: 1_000_000,
        netWeeklyBurn: 100_000,
        runwayWeeks: 20,
        projectedCash: 1_000_000,
      }),
    ).toBe("stable");
  });
});
