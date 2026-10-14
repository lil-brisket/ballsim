import {
  NARRATIVE_SITUATIONS_MAX,
  NARRATIVE_SNAPSHOTS_MAX,
  isNarrativeCategory,
  NARRATIVE_CATEGORIES,
  isNarrativeSeverity,
  NARRATIVE_SEVERITIES,
  isNarrativeSituationStatus,
  NARRATIVE_SITUATION_STATUSES,
  NARRATIVE_UPDATES_MAX,
  type NarrativeEvidence,
} from "@/domain/entities/narrative-situation";
import { parseCalendarDate } from "@/domain/calendar-date";
import {
  assertRecord,
  fail,
  assertNonEmptyString,
  assertNumber,
} from "@/persistence/validate-game-state/primitives";

export function validateNarrativeState(value: unknown): void {
  assertRecord(value, "user.narrative");
  if (!Array.isArray(value.situations)) {
    fail("user.narrative.situations must be an array.");
  }
  if (value.situations.length > NARRATIVE_SITUATIONS_MAX) {
    fail(
      `user.narrative.situations length must be <= ${NARRATIVE_SITUATIONS_MAX}.`,
    );
  }
  if (!Array.isArray(value.snapshots)) {
    fail("user.narrative.snapshots must be an array.");
  }
  if (value.snapshots.length > NARRATIVE_SNAPSHOTS_MAX) {
    fail(
      `user.narrative.snapshots length must be <= ${NARRATIVE_SNAPSHOTS_MAX}.`,
    );
  }
  if (
    value.cooldowns == null ||
    typeof value.cooldowns !== "object" ||
    Array.isArray(value.cooldowns)
  ) {
    fail("user.narrative.cooldowns must be a record.");
  }

  const seenIds = new Set<string>();
  for (const [index, situationValue] of (
    value.situations as unknown[]
  ).entries()) {
    const path = `user.narrative.situations[${index}]`;
    validateNarrativeSituation(situationValue, path, seenIds);
  }

  for (const [index, snapshotValue] of (
    value.snapshots as unknown[]
  ).entries()) {
    const path = `user.narrative.snapshots[${index}]`;
    validateNarrativeMonthSnapshot(snapshotValue, path);
  }

  for (const [key, until] of Object.entries(
    value.cooldowns as Record<string, unknown>,
  )) {
    if (typeof key !== "string" || key.trim().length === 0) {
      fail("user.narrative.cooldowns keys must be non-empty.");
    }
    if (typeof until !== "string" || until.trim().length === 0) {
      fail(`user.narrative.cooldowns["${key}"] must be a non-empty date.`);
    }
    parseCalendarDate(until);
  }
}

function validateNarrativeSituation(
  value: unknown,
  path: string,
  seenIds: Set<string>,
): void {
  assertRecord(value, path);
  assertNonEmptyString(value.id, `${path}.id`);
  if (seenIds.has(value.id)) {
    fail(`user.narrative.situations contains duplicate id "${value.id}".`);
  }
  seenIds.add(value.id);
  assertNonEmptyString(value.detectorKey, `${path}.detectorKey`);
  if (
    typeof value.category !== "string" ||
    !isNarrativeCategory(value.category)
  ) {
    fail(`${path}.category must be one of ${NARRATIVE_CATEGORIES.join(", ")}.`);
  }
  if (
    typeof value.severity !== "string" ||
    !isNarrativeSeverity(value.severity)
  ) {
    fail(`${path}.severity must be one of ${NARRATIVE_SEVERITIES.join(", ")}.`);
  }
  if (
    typeof value.status !== "string" ||
    !isNarrativeSituationStatus(value.status)
  ) {
    fail(
      `${path}.status must be one of ${NARRATIVE_SITUATION_STATUSES.join(", ")}.`,
    );
  }
  assertNumber(value.stage, `${path}.stage`);
  if (!Number.isInteger(value.stage) || (value.stage as number) < 0) {
    fail(`${path}.stage must be a non-negative integer.`);
  }
  assertNonEmptyString(value.title, `${path}.title`);
  assertNonEmptyString(value.summary, `${path}.summary`);
  assertNonEmptyString(value.body, `${path}.body`);
  assertNonEmptyString(value.createdOn, `${path}.createdOn`);
  parseCalendarDate(value.createdOn as string);
  assertNonEmptyString(value.updatedOn, `${path}.updatedOn`);
  parseCalendarDate(value.updatedOn as string);
  if (value.expiresOn !== undefined) {
    assertNonEmptyString(value.expiresOn, `${path}.expiresOn`);
    parseCalendarDate(value.expiresOn as string);
  }
  validateNarrativeEvidence(value.evidence, `${path}.evidence`);
  if (!Array.isArray(value.updates)) {
    fail(`${path}.updates must be an array.`);
  }
  if ((value.updates as unknown[]).length > NARRATIVE_UPDATES_MAX) {
    fail(`${path}.updates length must be <= ${NARRATIVE_UPDATES_MAX}.`);
  }
  for (const [uIndex, updateValue] of (value.updates as unknown[]).entries()) {
    validateNarrativeUpdate(updateValue, `${path}.updates[${uIndex}]`);
  }
  if (value.actions !== undefined) {
    if (!Array.isArray(value.actions)) {
      fail(`${path}.actions must be an array.`);
    }
    for (const [aIndex, actionValue] of (
      value.actions as unknown[]
    ).entries()) {
      const actionPath = `${path}.actions[${aIndex}]`;
      assertRecord(actionValue, actionPath);
      assertNonEmptyString(actionValue.id, `${actionPath}.id`);
      assertNonEmptyString(actionValue.label, `${actionPath}.label`);
      if (actionValue.href !== undefined) {
        assertNonEmptyString(actionValue.href, `${actionPath}.href`);
      }
      if (actionValue.effectSummary !== undefined) {
        assertNonEmptyString(
          actionValue.effectSummary,
          `${actionPath}.effectSummary`,
        );
      }
    }
  }
  if (value.related !== undefined) {
    assertRecord(value.related, `${path}.related`);
  }
  if (value.relatedNotificationId !== undefined) {
    assertNonEmptyString(
      value.relatedNotificationId,
      `${path}.relatedNotificationId`,
    );
  }
}

function validateNarrativeUpdate(value: unknown, path: string): void {
  assertRecord(value, path);
  assertNonEmptyString(value.occurredOn, `${path}.occurredOn`);
  parseCalendarDate(value.occurredOn as string);
  if (
    typeof value.severity !== "string" ||
    !isNarrativeSeverity(value.severity)
  ) {
    fail(`${path}.severity must be one of ${NARRATIVE_SEVERITIES.join(", ")}.`);
  }
  assertNonEmptyString(value.title, `${path}.title`);
  assertNonEmptyString(value.summary, `${path}.summary`);
  validateNarrativeEvidence(value.evidence, `${path}.evidence`);
}

function validateNarrativeEvidence(value: unknown, path: string): void {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    fail(`${path} must be a record.`);
  }
  for (const [key, entry] of Object.entries(value as NarrativeEvidence)) {
    if (typeof key !== "string" || key.trim().length === 0) {
      fail(`${path} keys must be non-empty.`);
    }
    const t = typeof entry;
    if (t !== "number" && t !== "boolean" && t !== "string") {
      fail(`${path}["${key}"] must be number, boolean, or string.`);
    }
  }
}

function validateNarrativeMonthSnapshot(value: unknown, path: string): void {
  assertRecord(value, path);
  assertNonEmptyString(value.monthId, `${path}.monthId`);
  assertNumber(value.attendanceAvg, `${path}.attendanceAvg`);
  assertNumber(value.fillRatePct, `${path}.fillRatePct`);
  assertNumber(value.ticketMerchRevenue, `${path}.ticketMerchRevenue`);
  assertNumber(value.fanSentiment, `${path}.fanSentiment`);
  assertNumber(value.reputation, `${path}.reputation`);
  assertNumber(value.mediaAttention, `${path}.mediaAttention`);
  assertNumber(value.cash, `${path}.cash`);
  assertNonEmptyString(value.healthBand, `${path}.healthBand`);
  assertNumber(value.wins, `${path}.wins`);
  assertNumber(value.losses, `${path}.losses`);
  assertNumber(value.franchiseValue, `${path}.franchiseValue`);
}
