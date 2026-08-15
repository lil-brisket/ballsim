import { describe, expect, it } from "vitest";
import {
  calculateTicketDemand,
  explainTicketDemand,
  merchandiseFromAttendance,
  resolveAttendance,
} from "@/systems/demand";

describe("demand", () => {
  const baseInputs = {
    marketSize: 60,
    fanSentiment: 55,
    reputation: 50,
    awareness: 45,
    mediaAttention: 40,
    leaguePopularity: 55,
    winPct: 0.55,
  };

  it("calculateTicketDemand returns score and weighted contributions", () => {
    const result = calculateTicketDemand(baseInputs);
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.contributions.marketSize.weighted).toBeCloseTo(12, 0);
    expect(
      Object.keys(result.contributions).length,
    ).toBeGreaterThan(0);
  });

  it("explainTicketDemand includes inputs", () => {
    const explanation = explainTicketDemand(baseInputs);
    expect(explanation.inputs).toEqual(baseInputs);
    expect(explanation.score).toBe(calculateTicketDemand(baseInputs).score);
  });

  it("resolveAttendance caps at capacity and responds to price", () => {
    const cheap = resolveAttendance(80, 30, 10_000);
    const expensive = resolveAttendance(80, 90, 10_000);
    expect(cheap).toBeGreaterThan(expensive);
    expect(cheap).toBeLessThanOrEqual(10_000);
  });

  it("merchandiseFromAttendance scales with sentiment", () => {
    const low = merchandiseFromAttendance(10_000, 20);
    const high = merchandiseFromAttendance(10_000, 90);
    expect(high).toBeGreaterThan(low);
  });
});
