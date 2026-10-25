import {
  type OwnershipConfidenceState,
  isOwnershipMood,
  OWNERSHIP_MOODS,
  BOARD_PRESSURE_STAGES,
  isBoardPressureStage,
  OWNERSHIP_EVIDENCE_RING_MAX,
  OWNERSHIP_SEASON_NOTES_MAX,
  type AlignmentEvidence,
  isAlignmentEvidenceKind,
  ALIGNMENT_EVIDENCE_KINDS,
  isAlignmentEvidenceSignificance,
  ALIGNMENT_EVIDENCE_SIGNIFICANCES,
  isAlignmentEvidenceDirection,
  ALIGNMENT_EVIDENCE_DIRECTIONS,
  isAlignmentDimension,
  ALIGNMENT_DIMENSIONS,
  type StrategicReversal,
  type OwnershipSeasonNote,
} from "@/domain/entities/ownership-confidence";
import {
  isOwnerObjectiveType,
  OWNER_OBJECTIVE_TYPES,
  isOwnerObjectiveStatus,
  OWNER_OBJECTIVE_STATUSES,
  isOwnerObjectiveCategory,
  OWNER_OBJECTIVE_CATEGORIES,
  isOwnerObjectiveLifecycle,
  OWNER_OBJECTIVE_LIFECYCLES,
  isOwnerObjectiveRole,
  OWNER_OBJECTIVE_ROLES,
} from "@/domain/entities/owner-objective";
import {
  isOwnerNotificationType,
  OWNER_NOTIFICATION_TYPES,
  isOwnerNotificationSeverity,
  OWNER_NOTIFICATION_SEVERITIES,
} from "@/domain/entities/owner-notification";
import { parseCalendarDate } from "@/domain/calendar-date";
import {
  fail,
  assertNumber,
  assertNonEmptyString,
  assertRecord,
} from "@/persistence/validate-game-state/primitives";

/**
 * Structural validation only — no objective-type-specific business rules.
 */
export function validateOwnershipConfidence(
  confidence: OwnershipConfidenceState,
): void {
  const path = "user.ownershipConfidence";
  if (
    typeof confidence.mood !== "string" ||
    !isOwnershipMood(confidence.mood)
  ) {
    fail(`${path}.mood must be one of ${OWNERSHIP_MOODS.join(", ")}.`);
  }
  assertNumber(confidence.concernLevel, `${path}.concernLevel`);
  if (
    !Number.isFinite(confidence.concernLevel) ||
    confidence.concernLevel < 0 ||
    confidence.concernLevel > 100
  ) {
    fail(`${path}.concernLevel must be between 0 and 100.`);
  }
  assertNumber(confidence.alignmentScore, `${path}.alignmentScore`);
  if (
    !Number.isFinite(confidence.alignmentScore) ||
    confidence.alignmentScore < 0 ||
    confidence.alignmentScore > 100
  ) {
    fail(`${path}.alignmentScore must be between 0 and 100.`);
  }
  if (!Array.isArray(confidence.recentEvidence)) {
    fail(`${path}.recentEvidence must be an array.`);
  }
  if (confidence.recentEvidence.length > OWNERSHIP_EVIDENCE_RING_MAX) {
    fail(
      `${path}.recentEvidence must have at most ${OWNERSHIP_EVIDENCE_RING_MAX} entries.`,
    );
  }
  for (const [index, evidence] of confidence.recentEvidence.entries()) {
    validateAlignmentEvidence(evidence, `${path}.recentEvidence[${index}]`);
  }
  if (!Array.isArray(confidence.recentHelping)) {
    fail(`${path}.recentHelping must be an array.`);
  }
  if (!Array.isArray(confidence.recentHurting)) {
    fail(`${path}.recentHurting must be an array.`);
  }
  for (const [index, line] of confidence.recentHelping.entries()) {
    assertNonEmptyString(line, `${path}.recentHelping[${index}]`);
  }
  for (const [index, line] of confidence.recentHurting.entries()) {
    assertNonEmptyString(line, `${path}.recentHurting[${index}]`);
  }
  assertNonEmptyString(
    confidence.lastConfidenceChangeOn,
    `${path}.lastConfidenceChangeOn`,
  );
  if (confidence.lastPostureCheckOn !== undefined) {
    assertNonEmptyString(
      confidence.lastPostureCheckOn,
      `${path}.lastPostureCheckOn`,
    );
  }
  if (confidence.lastReversal !== undefined) {
    validateStrategicReversal(confidence.lastReversal, `${path}.lastReversal`);
  }
  if (!Array.isArray(confidence.seasonNotes)) {
    fail(`${path}.seasonNotes must be an array.`);
  }
  if (confidence.seasonNotes.length > OWNERSHIP_SEASON_NOTES_MAX) {
    fail(
      `${path}.seasonNotes must have at most ${OWNERSHIP_SEASON_NOTES_MAX} entries.`,
    );
  }
  for (const [index, note] of confidence.seasonNotes.entries()) {
    validateOwnershipSeasonNote(note, `${path}.seasonNotes[${index}]`);
  }
  const stage = (confidence.boardPressure as { stage?: unknown } | undefined)
    ?.stage;
  if (typeof stage !== "string" || !isBoardPressureStage(stage)) {
    fail(
      `${path}.boardPressure.stage must be one of ${BOARD_PRESSURE_STAGES.join(", ")}.`,
    );
  }
}

function validateAlignmentEvidence(
  evidence: AlignmentEvidence,
  path: string,
): void {
  assertNonEmptyString(evidence.id, `${path}.id`);
  assertNonEmptyString(evidence.occurredOn, `${path}.occurredOn`);
  if (
    typeof evidence.kind !== "string" ||
    !isAlignmentEvidenceKind(evidence.kind)
  ) {
    fail(`${path}.kind must be one of ${ALIGNMENT_EVIDENCE_KINDS.join(", ")}.`);
  }
  if (
    typeof evidence.significance !== "string" ||
    !isAlignmentEvidenceSignificance(evidence.significance)
  ) {
    fail(
      `${path}.significance must be one of ${ALIGNMENT_EVIDENCE_SIGNIFICANCES.join(", ")}.`,
    );
  }
  if (
    typeof evidence.direction !== "string" ||
    !isAlignmentEvidenceDirection(evidence.direction)
  ) {
    fail(
      `${path}.direction must be one of ${ALIGNMENT_EVIDENCE_DIRECTIONS.join(", ")}.`,
    );
  }
  assertNonEmptyString(evidence.summary, `${path}.summary`);
  if (evidence.detail !== undefined) {
    assertNonEmptyString(evidence.detail, `${path}.detail`);
  }
  if (
    typeof evidence.dimension !== "string" ||
    !isAlignmentDimension(evidence.dimension)
  ) {
    fail(
      `${path}.dimension must be one of ${ALIGNMENT_DIMENSIONS.join(", ")}.`,
    );
  }
}

function validateStrategicReversal(
  reversal: StrategicReversal,
  path: string,
): void {
  assertNonEmptyString(reversal.priorDirection, `${path}.priorDirection`);
  assertNonEmptyString(reversal.newDirection, `${path}.newDirection`);
  if (typeof reversal.acknowledged !== "boolean") {
    fail(`${path}.acknowledged must be a boolean.`);
  }
  assertNonEmptyString(reversal.summary, `${path}.summary`);
  assertNonEmptyString(reversal.occurredOn, `${path}.occurredOn`);
}

function validateOwnershipSeasonNote(
  note: OwnershipSeasonNote,
  path: string,
): void {
  assertNumber(note.seasonYear, `${path}.seasonYear`);
  if (!Number.isInteger(note.seasonYear)) {
    fail(`${path}.seasonYear must be an integer.`);
  }
  if (typeof note.mood !== "string" || !isOwnershipMood(note.mood)) {
    fail(`${path}.mood must be one of ${OWNERSHIP_MOODS.join(", ")}.`);
  }
  assertNonEmptyString(note.mandateSummary, `${path}.mandateSummary`);
}

export function validateOwnerObjectives(objectives: unknown[]): void {
  const seenIds = new Set<string>();

  for (const [index, objectiveValue] of objectives.entries()) {
    const path = `user.objectives[${index}]`;
    assertRecord(objectiveValue, path);
    assertNonEmptyString(objectiveValue.id, `${path}.id`);
    if (seenIds.has(objectiveValue.id)) {
      fail(`user.objectives contains duplicate id "${objectiveValue.id}".`);
    }
    seenIds.add(objectiveValue.id);

    if (
      typeof objectiveValue.type !== "string" ||
      !isOwnerObjectiveType(objectiveValue.type)
    ) {
      fail(`${path}.type must be one of ${OWNER_OBJECTIVE_TYPES.join(", ")}.`);
    }

    assertNonEmptyString(objectiveValue.description, `${path}.description`);
    if (objectiveValue.description.trim().length === 0) {
      fail(`${path}.description cannot be whitespace-only.`);
    }

    if (
      typeof objectiveValue.status !== "string" ||
      !isOwnerObjectiveStatus(objectiveValue.status)
    ) {
      fail(
        `${path}.status must be one of ${OWNER_OBJECTIVE_STATUSES.join(", ")}.`,
      );
    }

    assertNumber(objectiveValue.seasonYear, `${path}.seasonYear`);
    if (!Number.isInteger(objectiveValue.seasonYear)) {
      fail(`${path}.seasonYear must be an integer.`);
    }

    if (typeof objectiveValue.consequenceApplied !== "boolean") {
      fail(`${path}.consequenceApplied must be a boolean.`);
    }

    if (
      typeof objectiveValue.category !== "string" ||
      !isOwnerObjectiveCategory(objectiveValue.category)
    ) {
      fail(
        `${path}.category must be one of ${OWNER_OBJECTIVE_CATEGORIES.join(", ")}.`,
      );
    }

    if (
      typeof objectiveValue.lifecycle !== "string" ||
      !isOwnerObjectiveLifecycle(objectiveValue.lifecycle)
    ) {
      fail(
        `${path}.lifecycle must be one of ${OWNER_OBJECTIVE_LIFECYCLES.join(", ")}.`,
      );
    }

    if (
      typeof objectiveValue.role !== "string" ||
      !isOwnerObjectiveRole(objectiveValue.role)
    ) {
      fail(`${path}.role must be one of ${OWNER_OBJECTIVE_ROLES.join(", ")}.`);
    }

    if (objectiveValue.target !== undefined) {
      assertNumber(objectiveValue.target, `${path}.target`);
    }

    if (objectiveValue.progress !== undefined) {
      assertNumber(objectiveValue.progress, `${path}.progress`);
      if (objectiveValue.progress < 0) {
        fail(`${path}.progress must be >= 0.`);
      }
    }

    if (objectiveValue.horizonYears !== undefined) {
      assertNumber(objectiveValue.horizonYears, `${path}.horizonYears`);
      if (
        !Number.isInteger(objectiveValue.horizonYears) ||
        objectiveValue.horizonYears < 1
      ) {
        fail(`${path}.horizonYears must be an integer >= 1.`);
      }
    }

    if (objectiveValue.baseline !== undefined) {
      assertNumber(objectiveValue.baseline, `${path}.baseline`);
    }
  }
}

export function validateOwnerNotifications(notifications: unknown[]): void {
  const seenIds = new Set<string>();
  const seenDedupeKeys = new Set<string>();

  for (const [index, notificationValue] of notifications.entries()) {
    const path = `user.notifications[${index}]`;
    assertRecord(notificationValue, path);
    assertNonEmptyString(notificationValue.id, `${path}.id`);
    if (seenIds.has(notificationValue.id)) {
      fail(
        `user.notifications contains duplicate id "${notificationValue.id}".`,
      );
    }
    seenIds.add(notificationValue.id);

    if (
      typeof notificationValue.type !== "string" ||
      !isOwnerNotificationType(notificationValue.type)
    ) {
      fail(
        `${path}.type must be one of ${OWNER_NOTIFICATION_TYPES.join(", ")}.`,
      );
    }

    assertNonEmptyString(notificationValue.title, `${path}.title`);
    assertNonEmptyString(notificationValue.message, `${path}.message`);
    assertNonEmptyString(notificationValue.occurredOn, `${path}.occurredOn`);
    parseCalendarDate(notificationValue.occurredOn);

    if (
      typeof notificationValue.severity !== "string" ||
      !isOwnerNotificationSeverity(notificationValue.severity)
    ) {
      fail(
        `${path}.severity must be one of ${OWNER_NOTIFICATION_SEVERITIES.join(", ")}.`,
      );
    }

    if (typeof notificationValue.read !== "boolean") {
      fail(`${path}.read must be a boolean.`);
    }

    assertNonEmptyString(notificationValue.dedupeKey, `${path}.dedupeKey`);
    if (seenDedupeKeys.has(notificationValue.dedupeKey)) {
      fail(
        `user.notifications contains duplicate dedupeKey "${notificationValue.dedupeKey}".`,
      );
    }
    seenDedupeKeys.add(notificationValue.dedupeKey);

    if (notificationValue.relatedObjectiveId !== undefined) {
      assertNonEmptyString(
        notificationValue.relatedObjectiveId,
        `${path}.relatedObjectiveId`,
      );
    }
    if (notificationValue.relatedTeamId !== undefined) {
      assertNonEmptyString(
        notificationValue.relatedTeamId,
        `${path}.relatedTeamId`,
      );
    }
    if (notificationValue.relatedSituationId !== undefined) {
      assertNonEmptyString(
        notificationValue.relatedSituationId,
        `${path}.relatedSituationId`,
      );
    }
  }
}
