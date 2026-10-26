import {
  describeOwnerObjective,
  formatObjectiveValue,
  isMoneyObjectiveType,
} from "@/domain/owner-objective-text";

type SituationTextSource = {
  detectorKey: string;
  summary: string;
  body: string;
  evidence: Readonly<Record<string, unknown>>;
};

/**
 * Display text for a stored narrative situation. Objective-progress
 * situations created before objective text was formatted carry raw dollar
 * amounts ("98750000"); rewrite them from the situation's evidence. Other
 * situations pass through unchanged.
 */
export function situationText(situation: SituationTextSource): {
  summary: string;
  body: string;
} {
  const { evidence } = situation;
  const type = evidence.objectiveType;
  const target = evidence.target;
  if (
    situation.detectorKey !== "objective_progress" ||
    typeof type !== "string" ||
    typeof target !== "number"
  ) {
    return { summary: situation.summary, body: situation.body };
  }
  const summary = describeOwnerObjective({
    type,
    description: situation.summary,
    target,
  });
  if (!isMoneyObjectiveType(type)) {
    return { summary, body: situation.body };
  }
  let body = situation.body.replace(
    String(target),
    formatObjectiveValue(type, target),
  );
  const progress = evidence.progress;
  if (typeof progress === "number") {
    body = body.replace(String(progress), formatObjectiveValue(type, progress));
  }
  return { summary, body };
}
