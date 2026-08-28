import type { DomainEvent } from "@/domain/events";
import type { Rng } from "@/domain/rng";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import {
  appendMonthSnapshot,
  buildNarrativeContext,
} from "@/systems/narrative/build-narrative-context";
import { aggregateCandidates } from "@/systems/narrative/aggregation";
import {
  detectAttendanceDecline,
  detectExpectationGap,
  detectFacilityCompleted,
  detectFacilityStaffConcern,
  detectFanPriceFriction,
  detectFinancialPressure,
  detectFranchiseValueMove,
  detectLeagueEconomyShift,
  detectLosingSlide,
  detectObjectiveProgress,
  detectPlayoffMomentum,
  detectRivalStrengthChange,
  detectSponsorExpiry,
  detectSponsorOpportunity,
  detectRelocationPressure,
  detectExpansionDiscussion,
} from "@/systems/narrative/detectors";
import {
  detectMediaOwnershipPressure,
  detectSponsorVisibilityConcern,
  enrichAttendanceDeclineActions,
} from "@/systems/narrative/attendance-crisis-chain";
import {
  applyCandidateToSituations,
  expireDueSituations,
} from "@/systems/narrative/lifecycle";
import {
  applySpamFilters,
  selectDailyStories,
} from "@/systems/narrative/spam";
import { renderNarrative } from "@/systems/narrative/templates";
import type {
  DetectorCandidate,
  NarrativeCadence,
} from "@/systems/narrative/types";
import { getActiveOwnedFranchise, withOwnedFranchise } from "@/state/owner-context";

export type ProcessNarrativeOptions = {
  /** Cadences that apply for this evaluation (e.g. daily+weekly+monthly on month boundary). */
  cadences: readonly NarrativeCadence[];
  dayEvents?: readonly DomainEvent[];
  /** When set, append a month snapshot before evaluation (monthly cadence). */
  completedMonthId?: string;
};

function runDetectors(
  state: GameState,
  cadences: readonly NarrativeCadence[],
  dayEvents: readonly DomainEvent[],
): DetectorCandidate[] {
  const candidates: DetectorCandidate[] = [];
  const seenKeys = new Set<string>();

  for (const cadence of cadences) {
    const context = buildNarrativeContext(state, { cadence, dayEvents });
    const detectors = [
      detectAttendanceDecline,
      detectFanPriceFriction,
      detectLosingSlide,
      detectPlayoffMomentum,
      detectFinancialPressure,
      detectExpectationGap,
      detectFacilityStaffConcern,
      detectSponsorOpportunity,
      detectObjectiveProgress,
      detectFranchiseValueMove,
      detectRivalStrengthChange,
      detectFacilityCompleted,
      detectSponsorExpiry,
      detectLeagueEconomyShift,
    ];
    for (const detect of detectors) {
      const result = detect(context);
      if (result && !seenKeys.has(result.detectorKey)) {
        seenKeys.add(result.detectorKey);
        candidates.push(result);
      }
    }
    for (const detect of [
      detectRelocationPressure,
      detectExpansionDiscussion,
    ] as const) {
      const result = detect(state, context);
      if (result && !seenKeys.has(result.detectorKey)) {
        seenKeys.add(result.detectorKey);
        candidates.push(result);
      }
    }
  }
  return candidates;
}

/**
 * Narrative interpretation layer — observes state, never invents simulation truth.
 * Prefer silence over weak storytelling.
 */
export function processNarrativeLayer(
  state: GameState,
  rng: Rng,
  options: ProcessNarrativeOptions,
): SystemResult {
  let current = state;

  if (options.completedMonthId) {
    current = appendMonthSnapshot(current, options.completedMonthId);
  }

  const primaryCadence = options.cadences[options.cadences.length - 1] ?? "daily";
  const context = buildNarrativeContext(current, {
    cadence: primaryCadence,
    dayEvents: options.dayEvents,
  });

  let situations = expireDueSituations(
    getActiveOwnedFranchise(current).narrative.situations,
    context.date,
  );

  const contextForSpam = {
    ...context,
    openDetectorKeys: new Set(
      situations
        .filter(
          (situation) =>
            situation.status === "active" ||
            situation.status === "acknowledged" ||
            situation.status === "escalated",
        )
        .map((situation) => situation.detectorKey),
    ),
    openSituationStages: new Map(
      situations
        .filter(
          (situation) =>
            situation.status === "active" ||
            situation.status === "acknowledged" ||
            situation.status === "escalated",
        )
        .map((situation) => [situation.detectorKey, situation.stage]),
    ),
  };

  const raw = runDetectors(current, options.cadences, options.dayEvents ?? []);
  // Attendance crisis chain: escalate on inaction + persistent evidence.
  for (const cadence of options.cadences) {
    const chainContext = buildNarrativeContext(current, {
      cadence,
      dayEvents: options.dayEvents,
    });
    const sponsor = detectSponsorVisibilityConcern(chainContext, situations);
    if (sponsor && !raw.some((c) => c.detectorKey === sponsor.detectorKey)) {
      raw.push(sponsor);
    }
    const media = detectMediaOwnershipPressure(chainContext, situations);
    if (media && !raw.some((c) => c.detectorKey === media.detectorKey)) {
      raw.push(media);
    }
  }

  const enriched = raw.map((candidate) =>
    enrichAttendanceDeclineActions(candidate),
  );
  const aggregated = aggregateCandidates(enriched);
  const filtered = applySpamFilters(aggregated, contextForSpam);
  const selected = selectDailyStories(filtered);

  const notifications = [...getActiveOwnedFranchise(current).notifications];
  const cooldowns = { ...getActiveOwnedFranchise(current).narrative.cooldowns };

  for (const candidate of selected) {
    const actions = candidate.actions?.map((action) => ({
      ...action,
      href: action.href?.replace("/dashboard/PLACEHOLDER", ""),
    }));
    const withActions = actions ? { ...candidate, actions } : candidate;
    const rendered = renderNarrative(withActions, rng);
    const applied = applyCandidateToSituations(
      situations,
      withActions,
      rendered,
      context.date,
      context.teamId,
      context.monthId,
    );
    situations = applied.situations;
    if (applied.notification) {
      const exists = notifications.some(
        (notification) =>
          notification.dedupeKey === applied.notification!.dedupeKey,
      );
      if (!exists) {
        notifications.push(applied.notification);
      }
    }
    if (applied.cooldownKey && applied.cooldownUntil) {
      cooldowns[applied.cooldownKey] = applied.cooldownUntil;
    }
  }

  return systemResult(withOwnedFranchise(current, current.user.activeOwnerTeamId, (franchise) => ({
    ...franchise,
    notifications,
    narrative: {
      ...franchise.narrative,
      situations,
      cooldowns,
    },
  })));
}
