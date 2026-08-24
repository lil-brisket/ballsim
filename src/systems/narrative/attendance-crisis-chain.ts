/**
 * Attendance crisis chain (first narrative chain — procedural, not a generic framework).
 *
 * Attendance decline → Sponsor visibility concern → Media ownership pressure
 *
 * Escalation is driven by inaction + persistent simulation evidence:
 * Player takes a real action → sim changes → detectors may resolve
 * Player does nothing → condition persists → chain escalates
 */

import { calendarDaysBetween } from "@/domain/calendar-date";
import type { NarrativeSituation } from "@/domain/entities/narrative-situation";
import {
  computeFranchisePressureSignals,
  PRESSURE_THRESHOLDS,
  type FranchisePressureSignals,
} from "@/systems/franchise-pressure-signals";
import { priorityForDetectorKey } from "@/systems/narrative/priority";
import type {
  DetectorCandidate,
  NarrativeContext,
} from "@/systems/narrative/types";

/** Days an open attendance situation must persist before sponsor escalation. */
export const ATTENDANCE_TO_SPONSOR_DAYS = 21;
/** Days an open sponsor concern must persist before media escalation. */
export const SPONSOR_TO_MEDIA_DAYS = 21;
/** Default expiry for chain stages if unresolved. */
export const ATTENDANCE_CHAIN_EXPIRE_DAYS = 60;

export const ATTENDANCE_CHAIN_DETECTORS = [
  "attendance_decline",
  "sponsor_visibility_concern",
  "media_ownership_pressure",
] as const;

export type AttendanceChainDetector =
  (typeof ATTENDANCE_CHAIN_DETECTORS)[number];

export function isAttendanceChainDetector(
  key: string,
): key is AttendanceChainDetector {
  return (ATTENDANCE_CHAIN_DETECTORS as readonly string[]).includes(key);
}

function findOpen(
  situations: readonly NarrativeSituation[],
  detectorKey: string,
): NarrativeSituation | undefined {
  return situations.find(
    (situation) =>
      situation.detectorKey === detectorKey &&
      (situation.status === "active" ||
        situation.status === "acknowledged" ||
        situation.status === "escalated"),
  );
}

function daysOpen(
  situation: NarrativeSituation | undefined,
  date: string,
): number {
  if (!situation) {
    return 0;
  }
  return Math.max(0, calendarDaysBetween(situation.createdOn, date));
}

/**
 * Build pressure signals from narrative context (shared thresholds with AI).
 */
export function pressureFromNarrativeContext(
  context: NarrativeContext,
): FranchisePressureSignals {
  let activeSponsorshipCount = 0;
  // Context does not expose sponsorship count directly; infer soft risk from media/sentiment.
  if (context.currentMediaAttention < 30) {
    activeSponsorshipCount = 0;
  } else {
    activeSponsorshipCount = 1;
  }

  return computeFranchisePressureSignals({
    consecutiveAttendanceDeclineMonths:
      context.consecutiveAttendanceDeclineMonths,
    consecutiveAttendanceRiseMonths: context.consecutiveAttendanceRiseMonths,
    attendanceDownPctVsPriorMonth: context.attendanceDownPctVsPriorMonth,
    sentimentChangeVsPriorMonth: context.sentimentChangeVsPriorMonth,
    ticketMerchChangeVsPriorMonth: context.ticketMerchChangeVsPriorMonth,
    vsLeagueFillPct: context.leagueRelative.vsLeagueFillPct,
    vsLeagueTicketPricePct: context.leagueRelative.vsLeagueTicketPricePct,
    currentTicketPrice: context.currentTicketPrice,
    healthBand: context.healthBand,
    runwayWeeks: context.runwayWeeks,
    winPct: context.winPct,
    streakKind:
      context.streakKind === "W" || context.streakKind === "L"
        ? context.streakKind
        : null,
    streakLength: context.streakLength,
    marketingAwareness: Math.min(100, context.currentMediaAttention + 20),
    fanSentiment: context.currentFanSentiment,
    activeSponsorshipCount,
    mediaAttention: context.currentMediaAttention,
  });
}

/**
 * Enrich attendance_decline candidate with tradeoff summaries + expiry.
 */
export function enrichAttendanceDeclineActions(
  candidate: DetectorCandidate,
): DetectorCandidate {
  if (
    candidate.detectorKey !== "attendance_decline" &&
    candidate.detectorKey !== "fan_demand"
  ) {
    return candidate;
  }
  if (candidate.resolve) {
    return candidate;
  }
  return {
    ...candidate,
    expiresAfterDays: ATTENDANCE_CHAIN_EXPIRE_DAYS,
    actions: [
      {
        id: "reduce_ticket_price",
        label: "Lower ticket prices",
        effectSummary:
          "Cuts gate revenue per fan; may improve demand, sentiment, and attendance.",
      },
      {
        id: "increase_marketing",
        label: "Increase marketing",
        effectSummary:
          "Raises marketing expense and awareness; slower financial recovery if demand stays soft.",
      },
      {
        id: "reduce_premium_ticket_price",
        label: "Lower premium prices",
        effectSummary:
          "Reduces premium ticket revenue; may ease high-end demand friction.",
      },
    ],
  };
}

/**
 * Sponsor visibility concern — escalates from ignored attendance decline.
 */
export function detectSponsorVisibilityConcern(
  context: NarrativeContext,
  situations: readonly NarrativeSituation[],
): DetectorCandidate | null {
  if (context.cadence !== "monthly" && context.cadence !== "weekly") {
    return null;
  }

  const pressure = pressureFromNarrativeContext(context);
  const attendanceOpen =
    findOpen(situations, "attendance_decline") ??
    findOpen(situations, "fan_demand");
  const sponsorOpen = findOpen(situations, "sponsor_visibility_concern");

  // Resolve when attendance pressure eases.
  if (
    sponsorOpen &&
    (pressure.attendanceDeclining < 0.2 ||
      context.consecutiveAttendanceRiseMonths >= 1)
  ) {
    return {
      detectorKey: "sponsor_visibility_concern",
      kind: "situation",
      category: "sponsors",
      stage: sponsorOpen.stage,
      severity: "informational",
      priorityHint: priorityForDetectorKey("sponsor_visibility_concern"),
      evidence: {
        resolved: true,
        attendanceDeclining: pressure.attendanceDeclining,
      },
      templateContext: {
        attendanceDeclining: pressure.attendanceDeclining,
      },
      resolve: true,
    };
  }

  if (sponsorOpen) {
    return null;
  }

  // Do not open if attendance chain never started or resolved.
  if (!attendanceOpen) {
    return null;
  }

  const openDays = daysOpen(attendanceOpen, context.date);
  if (openDays < ATTENDANCE_TO_SPONSOR_DAYS) {
    return null;
  }

  // Evidence must still support escalation.
  if (
    pressure.attendanceDeclining < 0.35 &&
    pressure.sponsorRisk < 0.35 &&
    pressure.fanPriceFriction < PRESSURE_THRESHOLDS.fanPriceVsLeaguePct / 100
  ) {
    return null;
  }
  if (pressure.sponsorRisk < 0.3 && pressure.attendanceDeclining < 0.4) {
    return null;
  }

  return {
    detectorKey: "sponsor_visibility_concern",
    kind: "situation",
    category: "sponsors",
    stage: 1,
    severity: "important",
    priorityHint: priorityForDetectorKey("sponsor_visibility_concern"),
    expiresAfterDays: ATTENDANCE_CHAIN_EXPIRE_DAYS,
    evidence: {
      daysSinceAttendanceAlert: openDays,
      attendanceDeclining: pressure.attendanceDeclining,
      sponsorRisk: pressure.sponsorRisk,
      fanPriceFriction: pressure.fanPriceFriction,
      mediaAttention: context.currentMediaAttention,
      attendanceDownPct: context.attendanceDownPctVsPriorMonth ?? 0,
    },
    templateContext: {
      daysSinceAttendanceAlert: openDays,
      attendanceDeclining: pressure.attendanceDeclining,
      sponsorRisk: pressure.sponsorRisk,
      mediaAttention: context.currentMediaAttention,
    },
    actions: [
      {
        id: "increase_marketing",
        label: "Boost marketing visibility",
        effectSummary:
          "Spends marketing budget to raise awareness and sponsor confidence.",
      },
      {
        id: "reduce_ticket_price",
        label: "Lower ticket prices",
        effectSummary:
          "May recover attendance that sponsors use as visibility proof.",
      },
      {
        id: "accept_sponsor_proposal",
        label: "Secure a sponsor deal",
        effectSummary:
          "Locks in sponsorship revenue if a deal can be signed now.",
      },
    ],
  };
}

/**
 * Media ownership pressure — escalates from ignored sponsor concern.
 */
export function detectMediaOwnershipPressure(
  context: NarrativeContext,
  situations: readonly NarrativeSituation[],
): DetectorCandidate | null {
  if (context.cadence !== "monthly" && context.cadence !== "weekly") {
    return null;
  }

  const pressure = pressureFromNarrativeContext(context);
  const sponsorOpen = findOpen(situations, "sponsor_visibility_concern");
  const mediaOpen = findOpen(situations, "media_ownership_pressure");

  if (
    mediaOpen &&
    (pressure.sponsorRisk < 0.25 ||
      pressure.attendanceDeclining < 0.2 ||
      context.consecutiveAttendanceRiseMonths >= 1)
  ) {
    return {
      detectorKey: "media_ownership_pressure",
      kind: "situation",
      category: "media",
      stage: mediaOpen.stage,
      severity: "informational",
      priorityHint: priorityForDetectorKey("media_ownership_pressure"),
      evidence: { resolved: true, sponsorRisk: pressure.sponsorRisk },
      templateContext: { sponsorRisk: pressure.sponsorRisk },
      resolve: true,
    };
  }

  if (mediaOpen || !sponsorOpen) {
    return null;
  }

  const openDays = daysOpen(sponsorOpen, context.date);
  if (openDays < SPONSOR_TO_MEDIA_DAYS) {
    return null;
  }

  if (pressure.sponsorRisk < 0.4 && pressure.attendanceDeclining < 0.45) {
    return null;
  }

  return {
    detectorKey: "media_ownership_pressure",
    kind: "situation",
    category: "media",
    stage: 1,
    severity: "critical",
    priorityHint: priorityForDetectorKey("media_ownership_pressure"),
    expiresAfterDays: ATTENDANCE_CHAIN_EXPIRE_DAYS,
    evidence: {
      daysSinceSponsorAlert: openDays,
      sponsorRisk: pressure.sponsorRisk,
      attendanceDeclining: pressure.attendanceDeclining,
      fanSentiment: context.currentFanSentiment,
      mediaAttention: context.currentMediaAttention,
      reputation: context.currentReputation,
    },
    templateContext: {
      daysSinceSponsorAlert: openDays,
      sponsorRisk: pressure.sponsorRisk,
      fanSentiment: context.currentFanSentiment,
      mediaAttention: context.currentMediaAttention,
    },
    actions: [
      {
        id: "increase_marketing",
        label: "Launch public response campaign",
        effectSummary:
          "Increases marketing spend to push back on negative coverage.",
      },
      {
        id: "reduce_ticket_price",
        label: "Cut ticket prices",
        effectSummary:
          "A public pricing concession that may calm fans and media.",
      },
      {
        id: "review_finances",
        label: "Review finances",
        effectSummary: "Opens the finances page to reassess commercial strategy.",
        href: "/finances",
      },
    ],
  };
}
