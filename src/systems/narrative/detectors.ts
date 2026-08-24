import type { NarrativeContext, DetectorCandidate } from "@/systems/narrative/types";
import { priorityForDetectorKey } from "@/systems/narrative/priority";
import { OWNER_STREAK_NOTIFICATION_THRESHOLD } from "@/systems/owner-objectives-config";

export function detectAttendanceDecline(
  context: NarrativeContext,
): DetectorCandidate | null {
  if (context.cadence !== "monthly") {
    return null;
  }

  const consecutive = context.consecutiveAttendanceDeclineMonths;
  const openStage = context.openSituationStages.get("attendance_decline");

  // Resolution path when attendance recovers.
  if (
    context.openDetectorKeys.has("attendance_decline") &&
    context.consecutiveAttendanceRiseMonths >= 1 &&
    consecutive === 0
  ) {
    return {
      detectorKey: "attendance_decline",
      kind: "situation",
      category: "fans",
      stage: openStage ?? 1,
      severity: "informational",
      priorityHint: priorityForDetectorKey("attendance_decline"),
      evidence: {
        consecutiveDecliningMonths: 0,
        consecutiveRisingMonths: context.consecutiveAttendanceRiseMonths,
        resolved: true,
      },
      templateContext: {
        consecutiveRisingMonths: context.consecutiveAttendanceRiseMonths,
      },
      resolve: true,
    };
  }

  if (consecutive < 2) {
    return null;
  }

  // Prefer league-relative or expectation miss for signal.
  const vsLeague = context.leagueRelative.vsLeagueFillPct;
  const attendanceObjective = context.objectives.find(
    (objective) =>
      objective.type === "attendance" && objective.status === "active",
  );
  const belowObjective =
    attendanceObjective?.gap !== null &&
    attendanceObjective?.gap !== undefined &&
    attendanceObjective.gap > 0;
  const unusualVsLeague = vsLeague !== null && vsLeague <= -3;

  if (consecutive < 3 && !belowObjective && !unusualVsLeague) {
    // Two months alone with league also soft and no objective miss → silence.
    if (vsLeague !== null && vsLeague >= -1) {
      return null;
    }
  }

  const stage = consecutive >= 3 ? 2 : 1;
  const severity =
    consecutive >= 3 && (context.sentimentChangeVsPriorMonth ?? 0) < -5
      ? "important"
      : consecutive >= 3
        ? "notable"
        : "notable";

  if (openStage !== undefined && stage <= openStage) {
    return null;
  }

  return {
    detectorKey: "attendance_decline",
    kind: "situation",
    category: "fans",
    stage,
    severity,
    priorityHint: priorityForDetectorKey("attendance_decline"),
    evidence: {
      consecutiveDecliningMonths: consecutive,
      attendanceDownPct: context.attendanceDownPctVsPriorMonth ?? 0,
      sentimentChange: context.sentimentChangeVsPriorMonth ?? 0,
      vsLeagueAttendancePct: vsLeague ?? 0,
      belowAttendanceObjective: belowObjective,
      fillPct: context.currentFillPctEstimate ?? 0,
    },
    templateContext: {
      consecutiveDecliningMonths: consecutive,
      attendanceDownPct: context.attendanceDownPctVsPriorMonth ?? 0,
      sentimentChange: context.sentimentChangeVsPriorMonth ?? 0,
      vsLeagueAttendancePct: vsLeague ?? 0,
      belowAttendanceObjective: belowObjective,
      stage,
    },
    actions: [
      {
        id: "reduce_ticket_price",
        label: "Lower ticket prices",
      },
      {
        id: "increase_marketing",
        label: "Increase marketing",
      },
    ],
    aggregateGroup: "fan_demand",
  };
}

export function detectFanPriceFriction(
  context: NarrativeContext,
): DetectorCandidate | null {
  if (context.cadence !== "monthly" && context.cadence !== "weekly") {
    return null;
  }

  const vsLeaguePrice = context.leagueRelative.vsLeagueTicketPricePct;
  const priceElevated = vsLeaguePrice !== null && vsLeaguePrice >= 8;
  const attendanceDown =
    (context.attendanceDownPctVsPriorMonth ?? 0) >= 3 ||
    context.consecutiveAttendanceDeclineMonths >= 1;
  const sentimentDown = (context.sentimentChangeVsPriorMonth ?? 0) <= -3;

  if (!priceElevated || !attendanceDown || !sentimentDown) {
    return null;
  }

  return {
    detectorKey: "fan_price_friction",
    kind: "situation",
    category: "fans",
    stage: 1,
    severity: "notable",
    priorityHint: priorityForDetectorKey("fan_price_friction"),
    evidence: {
      vsLeagueTicketPricePct: vsLeaguePrice ?? 0,
      attendanceDownPct: context.attendanceDownPctVsPriorMonth ?? 0,
      sentimentChange: context.sentimentChangeVsPriorMonth ?? 0,
      ticketPrice: context.currentTicketPrice,
    },
    templateContext: {
      vsLeagueTicketPricePct: vsLeaguePrice ?? 0,
      attendanceDownPct: context.attendanceDownPctVsPriorMonth ?? 0,
      sentimentChange: context.sentimentChangeVsPriorMonth ?? 0,
      ticketPrice: context.currentTicketPrice,
    },
    actions: [
      {
        id: "reduce_ticket_price",
        label: "Lower ticket prices",
      },
    ],
    aggregateGroup: "fan_demand",
  };
}

export function detectLosingSlide(
  context: NarrativeContext,
): DetectorCandidate | null {
  if (context.cadence !== "weekly" && context.cadence !== "daily") {
    return null;
  }
  if (context.streakKind !== "L") {
    if (
      context.openDetectorKeys.has("losing_slide") &&
      (context.streakKind === "W" || context.streakLength === 0)
    ) {
      return {
        detectorKey: "losing_slide",
        kind: "situation",
        category: "team",
        stage: 1,
        severity: "informational",
        priorityHint: priorityForDetectorKey("losing_slide"),
        evidence: { resolved: true, streakLength: context.streakLength },
        templateContext: { streakLength: context.streakLength },
        resolve: true,
      };
    }
    return null;
  }
  if (context.streakLength < OWNER_STREAK_NOTIFICATION_THRESHOLD) {
    return null;
  }

  const attendanceWeak =
    (context.attendanceDownPctVsPriorMonth ?? 0) >= 3 ||
    (context.currentFillPctEstimate !== null &&
      context.leagueRelative.vsLeagueFillPct !== null &&
      context.leagueRelative.vsLeagueFillPct <= -5);
  const revenueWeak = (context.ticketMerchChangeVsPriorMonth ?? 0) <= -5;

  if (!attendanceWeak && !revenueWeak) {
    return null;
  }

  return {
    detectorKey: "losing_slide",
    kind: "situation",
    category: "team",
    stage: context.streakLength >= 8 ? 2 : 1,
    severity: context.streakLength >= 8 ? "important" : "notable",
    priorityHint: priorityForDetectorKey("losing_slide"),
    evidence: {
      streakLength: context.streakLength,
      attendanceWeak,
      revenueWeak,
      attendanceDownPct: context.attendanceDownPctVsPriorMonth ?? 0,
      winPct: context.winPct,
    },
    templateContext: {
      streakLength: context.streakLength,
      attendanceDownPct: context.attendanceDownPctVsPriorMonth ?? 0,
      winPct: context.winPct,
    },
    aggregateGroup: "fan_demand",
  };
}

export function detectPlayoffMomentum(
  context: NarrativeContext,
): DetectorCandidate | null {
  if (context.cadence !== "weekly") {
    return null;
  }
  const winning =
    context.streakKind === "W" &&
    context.streakLength >= OWNER_STREAK_NOTIFICATION_THRESHOLD;
  const attendanceUp =
    context.consecutiveAttendanceRiseMonths >= 1 ||
    (context.leagueRelative.vsLeagueFillPct !== null &&
      context.leagueRelative.vsLeagueFillPct >= 3);
  const mediaUp =
    context.leagueRelative.vsLeagueMedia !== null &&
    context.leagueRelative.vsLeagueMedia >= 5;

  if (!winning || (!attendanceUp && !mediaUp && !context.playoffQualified)) {
    return null;
  }

  return {
    detectorKey: "playoff_momentum",
    kind: "situation",
    category: "team",
    stage: 1,
    severity: "notable",
    priorityHint: priorityForDetectorKey("playoff_momentum"),
    evidence: {
      streakLength: context.streakLength,
      playoffQualified: context.playoffQualified,
      vsLeagueFillPct: context.leagueRelative.vsLeagueFillPct ?? 0,
      vsLeagueMedia: context.leagueRelative.vsLeagueMedia ?? 0,
    },
    templateContext: {
      streakLength: context.streakLength,
      playoffQualified: context.playoffQualified,
      vsLeagueFillPct: context.leagueRelative.vsLeagueFillPct ?? 0,
    },
  };
}

export function detectFinancialPressure(
  context: NarrativeContext,
): DetectorCandidate | null {
  if (context.cadence !== "monthly" && context.cadence !== "daily") {
    return null;
  }

  const critical =
    context.healthBand === "critical" || context.healthBand === "insolvent";
  const warning = context.healthBand === "warning";
  const revenueDown =
    (context.ticketMerchChangeVsPriorMonth ?? 0) <= -8 &&
    context.snapshots.length >= 3;

  if (!critical && !warning && !revenueDown) {
    if (
      context.openDetectorKeys.has("financial_pressure") &&
      (context.healthBand === "healthy" || context.healthBand === "stable")
    ) {
      return {
        detectorKey: "financial_pressure",
        kind: "situation",
        category: "financial",
        stage: 1,
        severity: "informational",
        priorityHint: priorityForDetectorKey("financial_pressure"),
        evidence: { resolved: true, healthBand: context.healthBand },
        templateContext: { healthBand: context.healthBand },
        resolve: true,
      };
    }
    return null;
  }

  const stage = critical ? 3 : warning ? 2 : 1;
  const severity = critical
    ? "critical"
    : warning
      ? "important"
      : "notable";

  return {
    detectorKey: "financial_pressure",
    kind: "situation",
    category: "financial",
    stage,
    severity,
    priorityHint: critical
      ? 5
      : priorityForDetectorKey("financial_pressure"),
    evidence: {
      healthBand: context.healthBand,
      cash: context.currentCash,
      runwayWeeks: context.runwayWeeks ?? -1,
      ticketMerchChangePct: context.ticketMerchChangeVsPriorMonth ?? 0,
    },
    templateContext: {
      healthBand: context.healthBand,
      cash: context.currentCash,
      runwayWeeks: context.runwayWeeks ?? -1,
      ticketMerchChangePct: context.ticketMerchChangeVsPriorMonth ?? 0,
    },
    actions: [
      { id: "review_finances", label: "Review finances" },
      { id: "reduce_ticket_price", label: "Adjust ticket prices" },
    ],
    aggregateGroup: "money_pressure",
  };
}

export function detectExpectationGap(
  context: NarrativeContext,
): DetectorCandidate | null {
  if (context.cadence !== "weekly" && context.cadence !== "monthly") {
    return null;
  }

  const winObjective = context.objectives.find(
    (objective) =>
      objective.type === "minimum_win_total" &&
      objective.status === "active" &&
      objective.target !== null &&
      objective.progress !== null,
  );

  let gapPct: number | null = null;
  let beating = false;
  let missing = false;
  if (winObjective?.target && winObjective.target > 0) {
    const expectedPace =
      winObjective.target *
      (context.wins + context.losses > 0
        ? (context.wins + context.losses) /
          Math.max(winObjective.target * 2, 1)
        : 0);
    // Simpler: compare current wins to linear pace assuming ~82 or settings length.
    const gamesPlayed = context.wins + context.losses;
    if (gamesPlayed >= 10 && winObjective.target > 0) {
      const seasonLength = Math.max(gamesPlayed, 20);
      const expectedWins = (winObjective.target * gamesPlayed) / seasonLength;
      gapPct =
        Math.round(((context.wins - expectedWins) / winObjective.target) * 1000) /
        10;
      beating = gapPct >= 12;
      missing = gapPct <= -12;
    }
  }

  // Prior-season baseline when no win objective.
  if (
    !beating &&
    !missing &&
    context.priorSeasonWins !== null &&
    context.wins + context.losses >= 15
  ) {
    const priorGames =
      (context.priorSeasonWins ?? 0) + (context.priorSeasonLosses ?? 0);
    if (priorGames > 0) {
      const priorWinPct = (context.priorSeasonWins ?? 0) / priorGames;
      const delta = context.winPct - priorWinPct;
      if (delta >= 0.12) {
        beating = true;
        gapPct = Math.round(delta * 1000) / 10;
      } else if (delta <= -0.12) {
        missing = true;
        gapPct = Math.round(delta * 1000) / 10;
      }
    }
  }

  if (!beating && !missing) {
    return null;
  }

  const attendanceMoved =
    Math.abs(context.attendanceDownPctVsPriorMonth ?? 0) >= 3 ||
    context.consecutiveAttendanceRiseMonths >= 1 ||
    context.consecutiveAttendanceDeclineMonths >= 1;
  const mediaMoved =
    context.leagueRelative.vsLeagueMedia !== null &&
    Math.abs(context.leagueRelative.vsLeagueMedia) >= 4;

  return {
    detectorKey: "expectation_gap",
    kind: "situation",
    category: "ownership",
    stage: Math.abs(gapPct ?? 0) >= 20 ? 2 : 1,
    severity: missing ? "important" : "notable",
    priorityHint: priorityForDetectorKey("expectation_gap"),
    evidence: {
      beating,
      missing,
      gapPct: gapPct ?? 0,
      wins: context.wins,
      losses: context.losses,
      winPct: context.winPct,
      attendanceMoved,
      mediaMoved,
    },
    templateContext: {
      beating,
      missing,
      gapPct: gapPct ?? 0,
      wins: context.wins,
      losses: context.losses,
      attendanceMoved,
      mediaMoved,
    },
  };
}

export function detectFacilityStaffConcern(
  context: NarrativeContext,
): DetectorCandidate | null {
  if (context.cadence !== "weekly" && context.cadence !== "offseason") {
    return null;
  }

  const lag = context.leagueRelative.vsLeagueFacility;
  if (lag >= -0.4) {
    if (
      context.openDetectorKeys.has("facility_staff_concern") &&
      lag >= 0
    ) {
      return {
        detectorKey: "facility_staff_concern",
        kind: "situation",
        category: "facilities",
        stage: 1,
        severity: "informational",
        priorityHint: priorityForDetectorKey("facility_staff_concern"),
        evidence: { resolved: true, vsLeagueFacility: lag },
        templateContext: { vsLeagueFacility: lag },
        resolve: true,
      };
    }
    return null;
  }

  const losing =
    context.streakKind === "L" && context.streakLength >= 3
      ? true
      : context.winPct < 0.4 && context.wins + context.losses >= 10;
  const developmentWeak = context.dayEvents.some(
    (event) => event.type === "PlayerDeclined",
  );

  if (!losing && !developmentWeak && lag > -0.75) {
    return null;
  }

  return {
    detectorKey: "facility_staff_concern",
    kind: "situation",
    category: "facilities",
    stage: lag <= -1.25 ? 2 : 1,
    severity: lag <= -1.25 ? "important" : "notable",
    priorityHint: priorityForDetectorKey("facility_staff_concern"),
    evidence: {
      vsLeagueFacility: lag,
      facilityMean: context.facilityMean,
      leagueMedianFacility: context.leagueRelative.leagueMedianFacility,
      losing,
      developmentWeak,
    },
    templateContext: {
      vsLeagueFacility: lag,
      facilityMean: context.facilityMean,
      leagueMedianFacility: context.leagueRelative.leagueMedianFacility,
      losing,
      developmentWeak,
    },
    actions: [
      {
        id: "review_facilities",
        label: "Review facilities",
      },
    ],
  };
}

export function detectSponsorOpportunity(
  context: NarrativeContext,
): DetectorCandidate | null {
  if (context.cadence !== "monthly" && context.cadence !== "offseason") {
    return null;
  }
  if (context.sponsorshipClimate < 55) {
    return null;
  }
  if (context.currentReputation < 55 && context.currentMediaAttention < 45) {
    return null;
  }
  const rising =
    context.currentReputation >= 60 ||
    (context.leagueRelative.vsLeagueMedia !== null &&
      context.leagueRelative.vsLeagueMedia >= 5);
  if (!rising) {
    return null;
  }

  return {
    detectorKey: "sponsor_opportunity",
    kind: "situation",
    category: "sponsors",
    stage: 1,
    severity: "notable",
    priorityHint: priorityForDetectorKey("sponsor_opportunity"),
    evidence: {
      reputation: context.currentReputation,
      mediaAttention: context.currentMediaAttention,
      sponsorshipClimate: context.sponsorshipClimate,
    },
    templateContext: {
      reputation: context.currentReputation,
      mediaAttention: context.currentMediaAttention,
      sponsorshipClimate: context.sponsorshipClimate,
    },
    actions: [
      { id: "accept_sponsor_proposal", label: "Pursue sponsorship" },
      { id: "decline_sponsor_proposal", label: "Decline for now" },
    ],
  };
}

export function detectObjectiveProgress(
  context: NarrativeContext,
): DetectorCandidate | null {
  if (context.cadence !== "monthly") {
    return null;
  }

  const active = context.objectives.filter(
    (objective) => objective.status === "active" && objective.gap !== null,
  );
  if (active.length === 0) {
    return null;
  }

  // Near hit or material miss only.
  const nearHit = active.find(
    (objective) =>
      objective.target !== null &&
      objective.progress !== null &&
      objective.gap !== null &&
      objective.gap > 0 &&
      objective.gap <= Math.max(1, objective.target * 0.08),
  );
  const materialMiss = active.find(
    (objective) =>
      objective.target !== null &&
      objective.progress !== null &&
      objective.gap !== null &&
      objective.gap >= Math.max(2, objective.target * 0.25),
  );
  const focus = materialMiss ?? nearHit;
  if (!focus || focus.gap === null || focus.target === null) {
    return null;
  }

  const financial =
    focus.category === "financial" ||
    focus.type === "revenue_target" ||
    focus.type === "improve_finances" ||
    focus.type === "positive_cash";

  return {
    detectorKey: "objective_progress",
    kind: "situation",
    category: "ownership",
    stage: materialMiss ? 2 : 1,
    severity: materialMiss ? "important" : "notable",
    priorityHint: priorityForDetectorKey("objective_progress"),
    evidence: {
      objectiveType: focus.type,
      gap: focus.gap,
      target: focus.target,
      progress: focus.progress ?? 0,
      failing: Boolean(materialMiss),
      financialObjective: financial,
      nearHit: Boolean(nearHit) && !materialMiss,
    },
    templateContext: {
      description: focus.description,
      gap: focus.gap,
      target: focus.target,
      progress: focus.progress ?? 0,
      failing: Boolean(materialMiss),
      nearHit: Boolean(nearHit) && !materialMiss,
    },
    relatedObjectiveId: focus.id,
    aggregateGroup: financial ? "money_pressure" : undefined,
  };
}

export function detectFranchiseValueMove(
  context: NarrativeContext,
): DetectorCandidate | null {
  if (context.cadence !== "monthly") {
    return null;
  }
  const change = context.franchiseValueChangePctVsPriorMonth;
  if (change === null || Math.abs(change) < 4) {
    return null;
  }

  return {
    detectorKey: "franchise_value_move",
    kind: "situation",
    category: "ownership",
    stage: Math.abs(change) >= 8 ? 2 : 1,
    severity: Math.abs(change) >= 8 ? "notable" : "informational",
    priorityHint: priorityForDetectorKey("franchise_value_move"),
    evidence: {
      franchiseValueChangePct: change,
      winPct: context.winPct,
      ticketMerchChangePct: context.ticketMerchChangeVsPriorMonth ?? 0,
      vsLeagueFranchiseValuePct:
        context.leagueRelative.vsLeagueFranchiseValuePct ?? 0,
    },
    templateContext: {
      franchiseValueChangePct: change,
      winPct: context.winPct,
      ticketMerchChangePct: context.ticketMerchChangeVsPriorMonth ?? 0,
      rising: change > 0,
    },
  };
}

export function detectRivalStrengthChange(
  context: NarrativeContext,
  stateRosterStrength?: ReadonlyMap<string, number>,
): DetectorCandidate | null {
  if (context.cadence !== "weekly" && context.cadence !== "daily") {
    return null;
  }

  // Require a high-overall transaction involving another conference team.
  const meaningful = context.dayEvents.filter((event) => {
    if (
      event.type !== "PlayerTraded" &&
      event.type !== "FreeAgentSigned"
    ) {
      return false;
    }
    const toTeamId = String(
      event.payload.toTeamId ?? event.payload.teamId ?? "",
    );
    if (!toTeamId || toTeamId === context.teamId) {
      return false;
    }
    const overall = Number(event.payload.overall ?? event.payload.playerOverall);
    // Without overall on payload, require strength map or silence.
    if (Number.isFinite(overall)) {
      return overall >= 80;
    }
    return false;
  });

  if (meaningful.length === 0) {
    return null;
  }

  const event = meaningful[0]!;
  const rivalTeamId = String(
    event.payload.toTeamId ?? event.payload.teamId ?? "",
  );
  const overall = Number(event.payload.overall ?? event.payload.playerOverall);

  return {
    detectorKey: "rival_strength_change",
    kind: "situation",
    category: "league",
    stage: 1,
    severity: "notable",
    priorityHint: priorityForDetectorKey("rival_strength_change"),
    evidence: {
      rivalTeamId,
      playerOverall: overall,
      eventType: event.type,
      strengthKnown: stateRosterStrength?.has(rivalTeamId) ?? false,
    },
    templateContext: {
      rivalTeamId,
      playerOverall: overall,
      eventType: event.type,
    },
    relatedRivalTeamId: rivalTeamId as never,
  };
}

export function detectFacilityCompleted(
  context: NarrativeContext,
): DetectorCandidate | null {
  if (context.cadence !== "weekly" && context.cadence !== "daily") {
    return null;
  }
  const completed = context.dayEvents.find(
    (event) =>
      event.type === "FacilityUpgradeCompleted" &&
      event.payload.teamId === context.teamId,
  );
  if (!completed) {
    return null;
  }

  const category = String(completed.payload.category ?? "facility");
  const level = Number(completed.payload.level ?? 0);

  return {
    detectorKey: "facility_completed",
    kind: "story",
    category: "facilities",
    stage: 0,
    severity: "informational",
    priorityHint: priorityForDetectorKey("facility_completed"),
    evidence: {
      facilityCategory: category,
      facilityLevel: level,
    },
    templateContext: {
      facilityCategory: category,
      facilityLevel: level,
    },
  };
}

export function detectSponsorExpiry(
  context: NarrativeContext,
): DetectorCandidate | null {
  if (context.cadence !== "monthly" && context.cadence !== "offseason") {
    return null;
  }
  const expired = context.dayEvents.find(
    (event) =>
      event.type === "SponsorshipExpired" &&
      event.payload.teamId === context.teamId,
  );
  if (!expired) {
    return null;
  }

  return {
    detectorKey: "sponsor_expiry",
    kind: "story",
    category: "sponsors",
    stage: 0,
    severity: "notable",
    priorityHint: priorityForDetectorKey("sponsor_expiry"),
    evidence: {
      sponsorshipId: String(expired.payload.sponsorshipId ?? ""),
    },
    templateContext: {
      sponsorshipId: String(expired.payload.sponsorshipId ?? ""),
    },
    actions: [
      { id: "accept_sponsor_proposal", label: "Seek a replacement" },
      { id: "decline_sponsor_proposal", label: "Defer" },
    ],
    relatedSponsorshipId: String(expired.payload.sponsorshipId ?? ""),
  };
}

export function detectLeagueEconomyShift(
  context: NarrativeContext,
): DetectorCandidate | null {
  if (context.cadence !== "monthly") {
    return null;
  }
  // Without prior league snapshot, use absolute extremes only.
  if (
    context.leaguePopularity < 40 ||
    context.leaguePopularity > 70 ||
    context.leagueBroadcast < 40 ||
    context.leagueBroadcast > 70
  ) {
    const rising = context.leaguePopularity >= 65 || context.leagueBroadcast >= 65;
    const falling = context.leaguePopularity <= 40 || context.leagueBroadcast <= 40;
    if (!rising && !falling) {
      return null;
    }
    return {
      detectorKey: "league_economy_shift",
      kind: "story",
      category: "league",
      stage: 0,
      severity: "informational",
      priorityHint: priorityForDetectorKey("league_economy_shift"),
      evidence: {
        leaguePopularity: context.leaguePopularity,
        leagueBroadcast: context.leagueBroadcast,
        sponsorshipClimate: context.sponsorshipClimate,
        rising,
        falling,
      },
      templateContext: {
        leaguePopularity: context.leaguePopularity,
        leagueBroadcast: context.leagueBroadcast,
        rising,
        falling,
      },
    };
  }
  return null;
}
