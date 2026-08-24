import type { DetectorCandidate } from "@/systems/narrative/types";
import type { NarrativeContext } from "@/systems/narrative/types";
import { compareCandidatesForPriority } from "@/systems/narrative/priority";

export const MAX_NEW_STORIES_PER_DAY = 2;

/** Days of cooldown after a situation resolves before the same key can reopen. */
export const DEFAULT_COOLDOWN_DAYS = 21;

/**
 * Filter candidates: cooldowns, silence already-open same stage,
 * and suppress when a milestone notification already covers the discrete event.
 */
export function applySpamFilters(
  candidates: readonly DetectorCandidate[],
  context: NarrativeContext,
): DetectorCandidate[] {
  return candidates.filter((candidate) => {
    if (candidate.resolve) {
      return context.openDetectorKeys.has(candidate.detectorKey);
    }

    const cooldownUntil = context.cooldowns[candidate.detectorKey];
    if (cooldownUntil && cooldownUntil > context.date) {
      return false;
    }

    const openStage = context.openSituationStages.get(candidate.detectorKey);
    if (openStage !== undefined && candidate.stage <= openStage) {
      // Same or lower stage while already open — no new story.
      return false;
    }

    // fan_demand maps to attendance_decline open key for memory.
    if (candidate.detectorKey === "fan_demand") {
      const attendanceStage = context.openSituationStages.get(
        "attendance_decline",
      );
      if (
        attendanceStage !== undefined &&
        candidate.stage <= attendanceStage
      ) {
        return false;
      }
    }

    if (candidate.detectorKey === "losing_slide") {
      // Keep existing streak milestone notification; skip duplicate story
      // when only streak evidence exists without gate/revenue weakness.
      if (
        candidate.evidence.attendanceWeak !== true &&
        candidate.evidence.revenueWeak !== true
      ) {
        return false;
      }
    }

    return true;
  });
}

/** Select at most MAX_NEW_STORIES_PER_DAY by deterministic priority. */
export function selectDailyStories(
  candidates: readonly DetectorCandidate[],
): DetectorCandidate[] {
  const sorted = [...candidates].sort(compareCandidatesForPriority);
  return sorted.slice(0, MAX_NEW_STORIES_PER_DAY);
}
