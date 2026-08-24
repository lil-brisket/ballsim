import type { DetectorCandidate } from "@/systems/narrative/types";
import { priorityForDetectorKey } from "@/systems/narrative/priority";

const FAN_DEMAND_KEYS = new Set([
  "attendance_decline",
  "fan_price_friction",
  "losing_slide",
]);

const MONEY_PRESSURE_KEYS = new Set(["financial_pressure", "objective_progress"]);

/**
 * Deterministic aggregation: overlapping group members become one candidate.
 */
export function aggregateCandidates(
  candidates: readonly DetectorCandidate[],
): DetectorCandidate[] {
  const byKey = new Map<string, DetectorCandidate>();
  for (const candidate of candidates) {
    byKey.set(candidate.detectorKey, candidate);
  }

  const used = new Set<string>();
  const result: DetectorCandidate[] = [];

  const fanMembers = [...FAN_DEMAND_KEYS].filter((key) => byKey.has(key));
  if (fanMembers.length >= 2) {
    const primary = byKey.get("attendance_decline") ?? byKey.get(fanMembers[0]!)!;
    const evidence = { ...primary.evidence };
    const templateContext = { ...primary.templateContext };
    for (const key of fanMembers) {
      const member = byKey.get(key)!;
      Object.assign(evidence, member.evidence);
      Object.assign(templateContext, member.templateContext);
      used.add(key);
    }
    const maxSeverity = pickMaxSeverity(
      fanMembers.map((key) => byKey.get(key)!.severity),
    );
    result.push({
      ...primary,
      detectorKey: "fan_demand",
      kind: "situation",
      category: "fans",
      severity: maxSeverity,
      priorityHint: priorityForDetectorKey("fan_demand"),
      evidence,
      templateContext: {
        ...templateContext,
        aggregated: true,
        memberKeys: fanMembers.join(","),
      },
      aggregateGroup: "fan_demand",
      actions: primary.actions,
    });
  }

  const moneyMembers = [...MONEY_PRESSURE_KEYS].filter((key) => {
    const candidate = byKey.get(key);
    if (!candidate) {
      return false;
    }
    if (key === "objective_progress") {
      return (
        candidate.evidence.financialObjective === true &&
        candidate.evidence.failing === true
      );
    }
    return true;
  });
  if (
    moneyMembers.includes("financial_pressure") &&
    moneyMembers.includes("objective_progress")
  ) {
    const primary = byKey.get("financial_pressure")!;
    const objective = byKey.get("objective_progress")!;
    used.add("financial_pressure");
    used.add("objective_progress");
    result.push({
      ...primary,
      detectorKey: "financial_pressure",
      severity: pickMaxSeverity([primary.severity, objective.severity]),
      priorityHint: priorityForDetectorKey("financial_pressure"),
      evidence: { ...primary.evidence, ...objective.evidence, aggregated: true },
      templateContext: {
        ...primary.templateContext,
        ...objective.templateContext,
        aggregated: true,
      },
      aggregateGroup: "money_pressure",
    });
  }

  for (const candidate of candidates) {
    if (used.has(candidate.detectorKey)) {
      continue;
    }
    result.push(candidate);
  }

  return result;
}

function pickMaxSeverity(
  severities: readonly DetectorCandidate["severity"][],
): DetectorCandidate["severity"] {
  const order: DetectorCandidate["severity"][] = [
    "critical",
    "important",
    "notable",
    "informational",
  ];
  for (const severity of order) {
    if (severities.includes(severity)) {
      return severity;
    }
  }
  return "informational";
}
