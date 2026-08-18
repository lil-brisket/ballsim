import { describe, expect, it } from "vitest";
import {
  calculateTicketDemand,
  concessionsFromAttendance,
  explainTicketDemand,
  merchandiseFromAttendance,
  resolveAttendance,
  revenuePerAttendee,
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
    expect(result.contributions.marketSize.weighted).toBeCloseTo(11.4, 0);
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
    expect(cheap).toBeGreaterThanOrEqual(0);
  });

  it("higher attendance produces higher merch and concessions", () => {
    const lowAtt = merchandiseFromAttendance(5_000, 50);
    const highAtt = merchandiseFromAttendance(10_000, 50);
    expect(highAtt).toBeGreaterThan(lowAtt);
    expect(concessionsFromAttendance(10_000, 50)).toBeGreaterThan(
      concessionsFromAttendance(5_000, 50),
    );
  });

  it("merchandiseFromAttendance scales with sentiment", () => {
    const low = merchandiseFromAttendance(10_000, 20);
    const high = merchandiseFromAttendance(10_000, 90);
    expect(high).toBeGreaterThan(low);
  });

  it("concessionsFromAttendance scales with sentiment and is non-negative", () => {
    const low = concessionsFromAttendance(10_000, 20);
    const high = concessionsFromAttendance(10_000, 90);
    expect(high).toBeGreaterThan(low);
    expect(low).toBeGreaterThanOrEqual(0);
  });

  it("awareness influences demand score", () => {
    const low = calculateTicketDemand({ ...baseInputs, awareness: 10 });
    const high = calculateTicketDemand({ ...baseInputs, awareness: 90 });
    expect(high.score).toBeGreaterThan(low.score);
  });

  it("revenuePerAttendee is null when attendance is 0", () => {
    expect(revenuePerAttendee(0, 100, 50, 25)).toBeNull();
    expect(revenuePerAttendee(100, 4500, 800, 1200)).toBe(
      Math.round((4500 + 800 + 1200) / 100),
    );
  });
});
