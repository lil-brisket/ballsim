import { describe, expect, it } from "vitest";
import {
  computeFranchisePressureSignals,
  emptyFranchisePressureSignals,
  PRESSURE_THRESHOLDS,
} from "@/systems/franchise-pressure-signals";

describe("franchise pressure signals", () => {
  it("raises attendanceDeclining with consecutive decline months", () => {
    const calm = computeFranchisePressureSignals({
      consecutiveAttendanceDeclineMonths: 0,
      consecutiveAttendanceRiseMonths: 1,
      attendanceDownPctVsPriorMonth: 0,
      sentimentChangeVsPriorMonth: 0,
      ticketMerchChangeVsPriorMonth: 0,
      vsLeagueFillPct: 0,
      vsLeagueTicketPricePct: 0,
      currentTicketPrice: 45,
      healthBand: "stable",
      runwayWeeks: 20,
      winPct: 0.5,
      streakKind: null,
      streakLength: 0,
      marketingAwareness: 50,
      fanSentiment: 50,
      activeSponsorshipCount: 1,
      mediaAttention: 40,
    });
    const declining = computeFranchisePressureSignals({
      consecutiveAttendanceDeclineMonths: 3,
      consecutiveAttendanceRiseMonths: 0,
      attendanceDownPctVsPriorMonth: 8,
      sentimentChangeVsPriorMonth: -5,
      ticketMerchChangeVsPriorMonth: -4,
      vsLeagueFillPct: -6,
      vsLeagueTicketPricePct: 2,
      currentTicketPrice: 45,
      healthBand: "stable",
      runwayWeeks: 20,
      winPct: 0.4,
      streakKind: "L",
      streakLength: 6,
      marketingAwareness: 40,
      fanSentiment: 38,
      activeSponsorshipCount: 1,
      mediaAttention: 35,
    });
    expect(declining.attendanceDeclining).toBeGreaterThan(
      calm.attendanceDeclining,
    );
    expect(declining.performanceDecline).toBeGreaterThan(
      calm.performanceDecline,
    );
  });

  it("detects fan price friction with shared thresholds", () => {
    const friction = computeFranchisePressureSignals({
      consecutiveAttendanceDeclineMonths: 1,
      consecutiveAttendanceRiseMonths: 0,
      attendanceDownPctVsPriorMonth: PRESSURE_THRESHOLDS.fanPriceAttendanceDownPct,
      sentimentChangeVsPriorMonth: PRESSURE_THRESHOLDS.fanPriceSentimentDrop,
      ticketMerchChangeVsPriorMonth: -2,
      vsLeagueFillPct: -4,
      vsLeagueTicketPricePct: PRESSURE_THRESHOLDS.fanPriceVsLeaguePct,
      currentTicketPrice: 70,
      healthBand: "stable",
      runwayWeeks: 16,
      winPct: 0.42,
      streakKind: null,
      streakLength: 0,
      marketingAwareness: 45,
      fanSentiment: 40,
      activeSponsorshipCount: 1,
      mediaAttention: 30,
    });
    expect(friction.fanPriceFriction).toBeGreaterThan(0.5);
  });

  it("raises financialStress for critical health", () => {
    const healthy = computeFranchisePressureSignals({
      consecutiveAttendanceDeclineMonths: 0,
      consecutiveAttendanceRiseMonths: 0,
      attendanceDownPctVsPriorMonth: null,
      sentimentChangeVsPriorMonth: null,
      ticketMerchChangeVsPriorMonth: null,
      vsLeagueFillPct: null,
      vsLeagueTicketPricePct: null,
      currentTicketPrice: 45,
      healthBand: "healthy",
      runwayWeeks: 40,
      winPct: 0.55,
      streakKind: null,
      streakLength: 0,
      marketingAwareness: 50,
      fanSentiment: 55,
      activeSponsorshipCount: 1,
      mediaAttention: 45,
    });
    const critical = computeFranchisePressureSignals({
      consecutiveAttendanceDeclineMonths: 0,
      consecutiveAttendanceRiseMonths: 0,
      attendanceDownPctVsPriorMonth: null,
      sentimentChangeVsPriorMonth: null,
      ticketMerchChangeVsPriorMonth: -10,
      vsLeagueFillPct: null,
      vsLeagueTicketPricePct: null,
      currentTicketPrice: 45,
      healthBand: "critical",
      runwayWeeks: 4,
      winPct: 0.4,
      streakKind: null,
      streakLength: 0,
      marketingAwareness: 40,
      fanSentiment: 40,
      activeSponsorshipCount: 0,
      mediaAttention: 25,
    });
    expect(critical.financialStress).toBeGreaterThan(healthy.financialStress);
    expect(critical.sponsorRisk).toBeGreaterThan(healthy.sponsorRisk);
  });

  it("empty signals are neutral-ish defaults", () => {
    const empty = emptyFranchisePressureSignals();
    expect(empty.attendanceDeclining).toBe(0);
    expect(empty.financialStress).toBeGreaterThan(0);
  });
});
