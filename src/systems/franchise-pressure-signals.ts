import {
  getOwnedFranchiseOrUndefined,
} from "@/state/owner-context";
/**
 * Shared franchise pressure signals — simulation-level, not narrative-owned.
 *
 * Simulation state → FranchisePressureSignals → Owner narrative
 *                                            → AI strategic response
 *
 * Narrative detectors and AI preference resolution must share these thresholds.
 */

import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { calculateCashRunway } from "@/state/franchise-selectors";
import type { FinancialHealthState } from "@/systems/financial-health";
import { clampPreference } from "@/systems/franchise-ai-preferences-config";
import type { NarrativeMonthSnapshot } from "@/domain/entities/narrative-situation";

export type FranchisePressureSignals = {
  /** Sustained attendance decline intensity 0–1. */
  attendanceDeclining: number;
  /** Financial stress intensity 0–1. */
  financialStress: number;
  /** High prices + soft demand friction 0–1. */
  fanPriceFriction: number;
  /** Sponsor visibility / commercial risk 0–1. */
  sponsorRisk: number;
  /** On-court / performance decline 0–1. */
  performanceDecline: number;
  /** Market growth opportunity 0–1. */
  marketOpportunity: number;
};

export type PressureSignalInputs = {
  consecutiveAttendanceDeclineMonths: number;
  consecutiveAttendanceRiseMonths: number;
  attendanceDownPctVsPriorMonth: number | null;
  sentimentChangeVsPriorMonth: number | null;
  ticketMerchChangeVsPriorMonth: number | null;
  vsLeagueFillPct: number | null;
  vsLeagueTicketPricePct: number | null;
  currentTicketPrice: number;
  healthBand: FinancialHealthState;
  runwayWeeks: number | null;
  winPct: number;
  streakKind: "W" | "L" | null;
  streakLength: number;
  marketingAwareness: number;
  fanSentiment: number;
  activeSponsorshipCount: number;
  mediaAttention: number;
};

function healthToStress(health: FinancialHealthState): number {
  switch (health) {
    case "healthy":
      return 0;
    case "stable":
      return 0.15;
    case "warning":
      return 0.55;
    case "critical":
      return 0.85;
    case "insolvent":
      return 1;
  }
}

/**
 * Pure pressure computation from structured inputs (shared by narrative + AI).
 */
export function computeFranchisePressureSignals(
  inputs: PressureSignalInputs,
): FranchisePressureSignals {
  const attendanceDeclining = clampPreference(
    inputs.consecutiveAttendanceDeclineMonths >= 2
      ? 0.35 +
          Math.min(0.45, (inputs.consecutiveAttendanceDeclineMonths - 2) * 0.2) +
          Math.max(0, (inputs.attendanceDownPctVsPriorMonth ?? 0) / 20) * 0.2 +
          (inputs.vsLeagueFillPct !== null && inputs.vsLeagueFillPct <= -3
            ? 0.15
            : 0)
      : inputs.consecutiveAttendanceDeclineMonths === 1
        ? 0.15
        : 0,
  );

  const revenueDown =
    (inputs.ticketMerchChangeVsPriorMonth ?? 0) <= -8 ? 0.25 : 0;
  const financialStress = clampPreference(
    healthToStress(inputs.healthBand) * 0.7 +
      revenueDown +
      (inputs.runwayWeeks !== null && inputs.runwayWeeks < 8 ? 0.2 : 0),
  );

  const priceElevated =
    inputs.vsLeagueTicketPricePct !== null &&
    inputs.vsLeagueTicketPricePct >= 8;
  const attendanceDown =
    (inputs.attendanceDownPctVsPriorMonth ?? 0) >= 3 ||
    inputs.consecutiveAttendanceDeclineMonths >= 1;
  const sentimentDown = (inputs.sentimentChangeVsPriorMonth ?? 0) <= -3;
  const fanPriceFriction =
    priceElevated && attendanceDown && sentimentDown
      ? clampPreference(
          0.55 +
            Math.min(0.3, (inputs.vsLeagueTicketPricePct ?? 0) / 40) +
            Math.min(0.15, Math.abs(inputs.sentimentChangeVsPriorMonth ?? 0) / 20),
        )
      : priceElevated && attendanceDown
        ? 0.35
        : 0;

  const performanceDecline = clampPreference(
    Math.max(0, (0.45 - inputs.winPct) * 2) * 0.5 +
      (inputs.streakKind === "L" && inputs.streakLength >= 5
        ? Math.min(0.45, inputs.streakLength / 16)
        : 0) +
      (attendanceDeclining > 0.3 ? 0.1 : 0),
  );

  const sponsorRisk = clampPreference(
    attendanceDeclining * 0.4 +
      fanPriceFriction * 0.25 +
      (inputs.mediaAttention < 30 ? 0.15 : 0) +
      (inputs.activeSponsorshipCount === 0 ? 0.2 : 0) +
      (inputs.fanSentiment < 40 ? 0.15 : 0),
  );

  const marketOpportunity = clampPreference(
    (inputs.consecutiveAttendanceRiseMonths >= 1 ? 0.35 : 0) +
      clampPreference(inputs.marketingAwareness / 100) * 0.3 +
      (inputs.fanSentiment >= 55 ? 0.2 : 0) +
      (inputs.vsLeagueFillPct !== null && inputs.vsLeagueFillPct >= 3
        ? 0.15
        : 0) +
      ((inputs.sentimentChangeVsPriorMonth ?? 0) >= 3 ? 0.15 : 0),
  );

  return {
    attendanceDeclining,
    financialStress,
    fanPriceFriction,
    sponsorRisk,
    performanceDecline,
    marketOpportunity,
  };
}

function snapshotsForTeam(
  state: GameState,
  teamId: TeamId,
): readonly NarrativeMonthSnapshot[] {
  // Narrative snapshots live on owned franchises; AI teams derive from
  // franchise history / live ops when snapshots don't apply.
  const franchise = getOwnedFranchiseOrUndefined(state, teamId);
  return franchise?.narrative.snapshots ?? [];
}

/**
 * Build pressure signals for any team from live GameState.
 */
export function buildFranchisePressureSignals(
  state: GameState,
  teamId: TeamId,
): FranchisePressureSignals | null {
  const team = state.world.teams[teamId];
  const ops = state.business.franchiseOps[teamId];
  if (!team || !ops) {
    return null;
  }

  const snapshots = snapshotsForTeam(state, teamId);
  let consecutiveDecline = 0;
  let consecutiveRise = 0;
  let attendanceDownPct: number | null = null;
  let sentimentChange: number | null = null;
  let ticketMerchChange: number | null = null;
  let vsLeagueFillPct: number | null = null;

  if (snapshots.length >= 2) {
    const recent = snapshots.slice(-6);
    for (let index = recent.length - 1; index >= 1; index -= 1) {
      const current = recent[index]!;
      const prior = recent[index - 1]!;
      if (current.fillRatePct < prior.fillRatePct) {
        if (index === recent.length - 1 || consecutiveDecline > 0) {
          consecutiveDecline += 1;
        }
      } else {
        break;
      }
    }
    for (let index = recent.length - 1; index >= 1; index -= 1) {
      const current = recent[index]!;
      const prior = recent[index - 1]!;
      if (current.fillRatePct > prior.fillRatePct) {
        if (index === recent.length - 1 || consecutiveRise > 0) {
          consecutiveRise += 1;
        }
      } else {
        break;
      }
    }
    const last = snapshots[snapshots.length - 1]!;
    const prev = snapshots[snapshots.length - 2]!;
    if (prev.fillRatePct > 0) {
      attendanceDownPct =
        ((prev.fillRatePct - last.fillRatePct) / prev.fillRatePct) * 100;
    }
    sentimentChange = last.fanSentiment - prev.fanSentiment;
    if (prev.ticketMerchRevenue > 0) {
      ticketMerchChange =
        ((last.ticketMerchRevenue - prev.ticketMerchRevenue) /
          prev.ticketMerchRevenue) *
        100;
    }
  } else {
    // AI teams without narrative snapshots: use franchise history self-relative.
    const seasons = state.business.franchiseHistory[teamId]?.seasons ?? [];
    if (seasons.length >= 2) {
      const last = seasons[seasons.length - 1]!;
      const prev = seasons[seasons.length - 2]!;
      if (
        last.attendance !== null &&
        prev.attendance !== null &&
        prev.attendance > 0
      ) {
        const drop =
          ((prev.attendance - last.attendance) / prev.attendance) * 100;
        attendanceDownPct = drop;
        if (drop >= 3) {
          consecutiveDecline = 2;
        } else if (drop < -3) {
          consecutiveRise = 1;
        }
      }
      sentimentChange = last.fanSentiment - prev.fanSentiment;
      if (prev.revenue > 0) {
        ticketMerchChange =
          ((last.revenue - prev.revenue) / prev.revenue) * 100;
      }
    }
  }

  const runway = calculateCashRunway(state, teamId);
  const standing = state.competition.standings.byTeamId[teamId];
  const wins = standing?.wins ?? 0;
  const losses = standing?.losses ?? 0;
  const games = wins + losses;
  const winPct = games === 0 ? 0.5 : wins / games;

  // League-relative ticket price
  const prices: number[] = [];
  for (const franchise of Object.values(state.business.franchiseOps)) {
    prices.push(franchise.ticketPrice);
  }
  const meanPrice =
    prices.length === 0
      ? ops.ticketPrice
      : prices.reduce((sum, price) => sum + price, 0) / prices.length;
  const vsLeagueTicketPricePct =
    meanPrice > 0
      ? ((ops.ticketPrice - meanPrice) / meanPrice) * 100
      : null;

  // Approximate fill vs league from history attendance when possible
  const attendances: number[] = [];
  for (const history of Object.values(state.business.franchiseHistory)) {
    const last = history.seasons[history.seasons.length - 1];
    if (last?.attendance !== null && last?.attendance !== undefined) {
      attendances.push(last.attendance);
    }
  }
  const ownAttendance =
    state.business.franchiseHistory[teamId]?.seasons[
      (state.business.franchiseHistory[teamId]?.seasons.length ?? 0) - 1
    ]?.attendance ?? null;
  if (
    ownAttendance !== null &&
    attendances.length >= 2
  ) {
    const meanAtt =
      attendances.reduce((sum, value) => sum + value, 0) / attendances.length;
    if (meanAtt > 0) {
      vsLeagueFillPct = ((ownAttendance - meanAtt) / meanAtt) * 100;
    }
  }

  let activeSponsorshipCount = 0;
  const year = state.competition.season.year;
  for (const sponsorship of Object.values(state.business.sponsorships)) {
    if (
      sponsorship.teamId === teamId &&
      sponsorship.status === "active" &&
      sponsorship.startYear <= year &&
      sponsorship.endYear >= year
    ) {
      activeSponsorshipCount += 1;
    }
  }

  // Streak from standings if available (narrative context has richer streak;
  // AI path uses winPct as primary performance signal).
  const streakKind: "W" | "L" | null =
    games >= 5 ? (winPct < 0.35 ? "L" : winPct > 0.65 ? "W" : null) : null;
  const streakLength =
    streakKind === "L" ? Math.round((0.5 - winPct) * 20) : 0;

  return computeFranchisePressureSignals({
    consecutiveAttendanceDeclineMonths: consecutiveDecline,
    consecutiveAttendanceRiseMonths: consecutiveRise,
    attendanceDownPctVsPriorMonth: attendanceDownPct,
    sentimentChangeVsPriorMonth: sentimentChange,
    ticketMerchChangeVsPriorMonth: ticketMerchChange,
    vsLeagueFillPct,
    vsLeagueTicketPricePct,
    currentTicketPrice: ops.ticketPrice,
    healthBand: runway.health,
    runwayWeeks: runway.runwayWeeks,
    winPct,
    streakKind,
    streakLength,
    marketingAwareness: ops.marketing.awareness,
    fanSentiment: ops.fanSentiment,
    activeSponsorshipCount,
    mediaAttention: ops.mediaAttention,
  });
}

/** Neutral signals for tests. */
export function emptyFranchisePressureSignals(): FranchisePressureSignals {
  return {
    attendanceDeclining: 0,
    financialStress: 0.15,
    fanPriceFriction: 0,
    sponsorRisk: 0,
    performanceDecline: 0.2,
    marketOpportunity: 0.35,
  };
}

/** Threshold helpers shared with narrative detectors. */
export const PRESSURE_THRESHOLDS = {
  attendanceDeclineMinMonths: 2,
  fanPriceVsLeaguePct: 8,
  fanPriceAttendanceDownPct: 3,
  fanPriceSentimentDrop: -3,
  financialRevenueDownPct: -8,
} as const;
