/** Deterministic priority ranks — lower number = higher priority. */
export const NARRATIVE_PRIORITY = {
  critical_financial: 10,
  objective_fail_risk: 20,
  major_sponsor: 30,
  expectation_gap: 40,
  playoff_momentum: 45,
  fan_demand: 50,
  facility_concern: 60,
  rival_strength: 70,
  league_news: 80,
  facility_completed: 85,
  sponsor_expiry: 55,
  franchise_value: 65,
  objective_progress: 48,
  default: 90,
} as const;

export function priorityForDetectorKey(detectorKey: string): number {
  switch (detectorKey) {
    case "financial_pressure":
      return NARRATIVE_PRIORITY.critical_financial;
    case "expectation_gap":
      return NARRATIVE_PRIORITY.expectation_gap;
    case "sponsor_opportunity":
      return NARRATIVE_PRIORITY.major_sponsor;
    case "sponsor_expiry":
      return NARRATIVE_PRIORITY.sponsor_expiry;
    case "playoff_momentum":
      return NARRATIVE_PRIORITY.playoff_momentum;
    case "attendance_decline":
    case "fan_price_friction":
    case "losing_slide":
    case "fan_demand":
      return NARRATIVE_PRIORITY.fan_demand;
    case "facility_staff_concern":
      return NARRATIVE_PRIORITY.facility_concern;
    case "rival_strength_change":
      return NARRATIVE_PRIORITY.rival_strength;
    case "league_economy_shift":
      return NARRATIVE_PRIORITY.league_news;
    case "facility_completed":
      return NARRATIVE_PRIORITY.facility_completed;
    case "franchise_value_move":
      return NARRATIVE_PRIORITY.franchise_value;
    case "objective_progress":
      return NARRATIVE_PRIORITY.objective_progress;
    default:
      return NARRATIVE_PRIORITY.default;
  }
}

/**
 * Sort candidates for the daily story cap.
 * Lower priority number wins; then higher severity; then detectorKey.
 */
export function compareCandidatesForPriority(
  a: { priorityHint: number; severity: string; detectorKey: string },
  b: { priorityHint: number; severity: string; detectorKey: string },
): number {
  if (a.priorityHint !== b.priorityHint) {
    return a.priorityHint - b.priorityHint;
  }
  const severityRank = (severity: string): number => {
    switch (severity) {
      case "critical":
        return 0;
      case "important":
        return 1;
      case "notable":
        return 2;
      default:
        return 3;
    }
  };
  const severityDelta = severityRank(a.severity) - severityRank(b.severity);
  if (severityDelta !== 0) {
    return severityDelta;
  }
  return a.detectorKey.localeCompare(b.detectorKey);
}
