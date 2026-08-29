import { describe, expect, it } from "vitest";
import {
  calculateBusinessHealth,
  calculateFinancialHealth,
  isCapitalSpendingRestricted,
} from "@/systems/financial-health";

describe("calculateBusinessHealth", () => {
  it("returns critical when business funds are very low (never insolvent)", () => {
    expect(
      calculateBusinessHealth({
        businessFunds: 0,
        weeklyOutflow: 1_000_000,
        netWeeklyBurn: 100_000,
        runwayWeeks: 0,
        projectedBusinessFunds: -1,
      }),
    ).toBe("critical");
    expect(
      calculateBusinessHealth({
        businessFunds: 1_500_000,
        weeklyOutflow: 1,
        netWeeklyBurn: 1,
        runwayWeeks: 0,
        projectedBusinessFunds: 10_000_000,
      }),
    ).toBe("critical");
  });

  it("returns tight when funds are below the soft warning threshold", () => {
    expect(
      calculateBusinessHealth({
        businessFunds: 4_000_000,
        weeklyOutflow: 1_000_000,
        netWeeklyBurn: 0,
        runwayWeeks: 12,
        projectedBusinessFunds: 5_000_000,
      }),
    ).toBe("tight");
  });

  it("returns strong when funds are ample", () => {
    expect(
      calculateBusinessHealth({
        businessFunds: 30_000_000,
        weeklyOutflow: 1_000_000,
        netWeeklyBurn: -200_000,
        runwayWeeks: null,
        projectedBusinessFunds: 40_000_000,
      }),
    ).toBe("strong");
  });

  it("returns stable in the mid range", () => {
    expect(
      calculateBusinessHealth({
        businessFunds: 12_000_000,
        weeklyOutflow: 1_000_000,
        netWeeklyBurn: 100_000,
        runwayWeeks: 20,
        projectedBusinessFunds: 10_000_000,
      }),
    ).toBe("stable");
  });
});

describe("calculateFinancialHealth (legacy mapping)", () => {
  it("maps low cash to critical instead of insolvent", () => {
    expect(
      calculateFinancialHealth({
        cash: 0,
        weeklyOutflow: 1_000_000,
        netWeeklyBurn: 100_000,
        runwayWeeks: 0,
        projectedCash: -1,
      }),
    ).toBe("critical");
  });

  it("never restricts capital spending via health gates", () => {
    expect(
      isCapitalSpendingRestricted({
        cash: 0,
        weeklyOutflow: 1_000_000,
        netWeeklyBurn: 1_000_000,
        runwayWeeks: 0,
        projectedCash: -1_000_000,
      }),
    ).toBe(false);
  });
});
