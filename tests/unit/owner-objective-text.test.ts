import { describe, expect, it } from "vitest";
import {
  describeOwnerObjective,
  formatMoney,
  formatObjectiveValue,
} from "@/domain/owner-objective-text";

describe("owner objective text", () => {
  it("formats money short", () => {
    expect(formatMoney(98_750_000)).toBe("$98.8M");
    expect(formatMoney(726_000)).toBe("$726K");
    expect(formatMoney(950)).toBe("$950");
  });

  it("writes money objectives from the target, fixing raw stored text", () => {
    expect(
      describeOwnerObjective({
        type: "payroll_limit",
        description: "Keep payroll at or below 98750000",
        target: 98_750_000,
      }),
    ).toBe("Keep payroll at or below $98.8M");
    expect(
      describeOwnerObjective({
        type: "revenue_target",
        description: "Reach 120000000 in season revenue",
        target: 120_000_000,
      }),
    ).toBe("Reach $120.0M in season revenue");
  });

  it("keeps other descriptions and missing targets as stored", () => {
    expect(
      describeOwnerObjective({
        type: "minimum_win_total",
        description: "Win at least 40 games",
        target: 40,
      }),
    ).toBe("Win at least 40 games");
    expect(
      describeOwnerObjective({
        type: "payroll_limit",
        description: "Keep payroll in line",
        target: null,
      }),
    ).toBe("Keep payroll in line");
  });

  it("formats values in the objective's unit", () => {
    expect(formatObjectiveValue("franchise_value", 477_723_206)).toBe(
      "$477.7M",
    );
    expect(formatObjectiveValue("attendance", 85)).toBe("85%");
    expect(formatObjectiveValue("minimum_win_total", 40)).toBe("40");
  });
});
