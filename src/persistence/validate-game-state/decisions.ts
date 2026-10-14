import { asScheduledEventId } from "@/domain/ids";
import {
  SCHEDULED_EVENT_TYPES,
  type ScheduledEventType,
  SCHEDULED_EVENT_STATUSES,
  type ScheduledEventStatus,
} from "@/domain/entities/scheduled-event";
import { parseCalendarDate } from "@/domain/calendar-date";
import {
  assertRecord,
  assertNonEmptyString,
  fail,
} from "@/persistence/validate-game-state/primitives";

export function validateScheduledEvents(events: unknown): void {
  assertRecord(events, "world.scheduledEvents");
  for (const [key, value] of Object.entries(events)) {
    const path = `world.scheduledEvents[${key}]`;
    assertRecord(value, path);
    assertNonEmptyString(value.id, `${path}.id`);
    if (value.id !== key) {
      fail(`${path}.id must equal record key "${key}".`);
    }
    asScheduledEventId(value.id);

    if (
      typeof value.type !== "string" ||
      !(SCHEDULED_EVENT_TYPES as readonly string[]).includes(value.type)
    ) {
      fail(`${path}.type must be one of ${SCHEDULED_EVENT_TYPES.join(", ")}.`);
    }
    void (value.type as ScheduledEventType);

    assertNonEmptyString(value.triggerDate, `${path}.triggerDate`);
    try {
      parseCalendarDate(value.triggerDate);
    } catch (error) {
      fail(
        error instanceof Error
          ? `${path}.triggerDate: ${error.message}`
          : `${path}.triggerDate is invalid.`,
      );
    }

    if (
      typeof value.status !== "string" ||
      !(SCHEDULED_EVENT_STATUSES as readonly string[]).includes(value.status)
    ) {
      fail(
        `${path}.status must be one of ${SCHEDULED_EVENT_STATUSES.join(", ")}.`,
      );
    }
    void (value.status as ScheduledEventStatus);

    assertRecord(value.payload, `${path}.payload`);
  }
}

export function validatePendingDraftClassDecision(
  value: unknown,
  path: string,
  key: string,
  failFn: (message: string) => never,
): void {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    failFn(`${path} must be an object.`);
  }
  const decision = value as Record<string, unknown>;
  if (
    typeof decision.draftYear !== "number" ||
    !Number.isInteger(decision.draftYear)
  ) {
    failFn(`${path}.draftYear must be an integer.`);
  }
  if (String(decision.draftYear) !== key) {
    failFn(`${path} key must equal String(draftYear).`);
  }
  if (typeof decision.resolved !== "boolean") {
    failFn(`${path}.resolved must be a boolean.`);
  }
  if (decision.resolved === true) {
    if (decision.source !== "generated" && decision.source !== "custom") {
      failFn(`${path}.source must be "generated" or "custom" when resolved.`);
    }
    if (decision.source === "custom") {
      if (
        typeof decision.customContentId !== "string" ||
        decision.customContentId.length === 0
      ) {
        failFn(`${path}.customContentId is required when source is "custom".`);
      }
    }
  } else if (
    decision.source !== undefined &&
    decision.source !== "generated" &&
    decision.source !== "custom"
  ) {
    failFn(`${path}.source must be "generated" or "custom" when present.`);
  }
  if (
    decision.customContentId !== undefined &&
    typeof decision.customContentId !== "string"
  ) {
    failFn(`${path}.customContentId must be a string when present.`);
  }
}

export function validatePendingOwnerDecision(
  value: unknown,
  path: string,
  failFn: (message: string) => never,
): void {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    failFn(`${path} must be an object.`);
  }
  const decision = value as Record<string, unknown>;
  assertNonEmptyString(decision.id, `${path}.id`);
  if (decision.type !== "trade_offer") {
    failFn(`${path}.type must be "trade_offer".`);
  }
  assertNonEmptyString(decision.createdOn, `${path}.createdOn`);
  parseCalendarDate(decision.createdOn as string);
  if (
    decision.blockingLevel !== "blocking" &&
    decision.blockingLevel !== "non_blocking"
  ) {
    failFn(`${path}.blockingLevel must be "blocking" or "non_blocking".`);
  }
  assertNonEmptyString(decision.primaryTeamId, `${path}.primaryTeamId`);
  if (
    !Array.isArray(decision.participantTeamIds) ||
    decision.participantTeamIds.length < 1
  ) {
    failFn(`${path}.participantTeamIds must be a non-empty array.`);
  }
  for (
    let i = 0;
    i < (decision.participantTeamIds as unknown[]).length;
    i += 1
  ) {
    assertNonEmptyString(
      (decision.participantTeamIds as unknown[])[i],
      `${path}.participantTeamIds[${i}]`,
    );
  }
  if (
    !(decision.participantTeamIds as string[]).includes(
      decision.primaryTeamId as string,
    )
  ) {
    failFn(`${path}.primaryTeamId must be included in participantTeamIds.`);
  }
  validateTradeOfferDecisionPayload(
    decision.payload,
    `${path}.payload`,
    failFn,
  );
}

export function validateOwnerDecisionRecord(
  value: unknown,
  path: string,
  failFn: (message: string) => never,
): void {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    failFn(`${path} must be an object.`);
  }
  const record = value as Record<string, unknown>;
  assertNonEmptyString(record.id, `${path}.id`);
  if (record.type !== "trade_offer") {
    failFn(`${path}.type must be "trade_offer".`);
  }
  if (
    record.status !== "accepted" &&
    record.status !== "declined" &&
    record.status !== "delegated" &&
    record.status !== "expired"
  ) {
    failFn(
      `${path}.status must be one of accepted, declined, delegated, expired.`,
    );
  }
  if (
    record.decisionSource !== "owner" &&
    record.decisionSource !== "owner_ai" &&
    record.decisionSource !== "system"
  ) {
    failFn(`${path}.decisionSource must be "owner", "owner_ai", or "system".`);
  }
  assertNonEmptyString(record.createdOn, `${path}.createdOn`);
  parseCalendarDate(record.createdOn as string);
  assertNonEmptyString(record.resolvedOn, `${path}.resolvedOn`);
  parseCalendarDate(record.resolvedOn as string);
  assertNonEmptyString(record.fingerprint, `${path}.fingerprint`);
  if (
    record.blockingLevel !== "blocking" &&
    record.blockingLevel !== "non_blocking"
  ) {
    failFn(`${path}.blockingLevel must be "blocking" or "non_blocking".`);
  }
  assertNonEmptyString(record.primaryTeamId, `${path}.primaryTeamId`);
  if (
    !Array.isArray(record.participantTeamIds) ||
    record.participantTeamIds.length < 1
  ) {
    failFn(`${path}.participantTeamIds must be a non-empty array.`);
  }
  for (let i = 0; i < (record.participantTeamIds as unknown[]).length; i += 1) {
    assertNonEmptyString(
      (record.participantTeamIds as unknown[])[i],
      `${path}.participantTeamIds[${i}]`,
    );
  }
  if (
    !(record.participantTeamIds as string[]).includes(
      record.primaryTeamId as string,
    )
  ) {
    failFn(`${path}.primaryTeamId must be included in participantTeamIds.`);
  }
  if (record.expiresOn !== undefined) {
    assertNonEmptyString(record.expiresOn, `${path}.expiresOn`);
    parseCalendarDate(record.expiresOn as string);
  }
  validateTradeOfferDecisionPayload(record.payload, `${path}.payload`, failFn);
}

function validateTradeOfferDecisionPayload(
  value: unknown,
  path: string,
  failFn: (message: string) => never,
): void {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    failFn(`${path} must be an object.`);
  }
  const payload = value as Record<string, unknown>;
  assertNonEmptyString(payload.offeringTeamId, `${path}.offeringTeamId`);
  assertNonEmptyString(payload.userTeamId, `${path}.userTeamId`);
  assertNonEmptyString(payload.fingerprint, `${path}.fingerprint`);
  if (
    payload.proposal === null ||
    typeof payload.proposal !== "object" ||
    Array.isArray(payload.proposal)
  ) {
    failFn(`${path}.proposal must be an object.`);
  }
  const proposal = payload.proposal as Record<string, unknown>;
  validateTradeSide(proposal.sideA, `${path}.proposal.sideA`, failFn);
  validateTradeSide(proposal.sideB, `${path}.proposal.sideB`, failFn);

  if (payload.originalProposal !== undefined) {
    if (
      payload.originalProposal === null ||
      typeof payload.originalProposal !== "object" ||
      Array.isArray(payload.originalProposal)
    ) {
      failFn(`${path}.originalProposal must be an object when present.`);
    } else {
      const original = payload.originalProposal as Record<string, unknown>;
      validateTradeSide(
        original.sideA,
        `${path}.originalProposal.sideA`,
        failFn,
      );
      validateTradeSide(
        original.sideB,
        `${path}.originalProposal.sideB`,
        failFn,
      );
    }
  }
  if (payload.currentProposal !== undefined) {
    if (
      payload.currentProposal === null ||
      typeof payload.currentProposal !== "object" ||
      Array.isArray(payload.currentProposal)
    ) {
      failFn(`${path}.currentProposal must be an object when present.`);
    } else {
      const current = payload.currentProposal as Record<string, unknown>;
      validateTradeSide(current.sideA, `${path}.currentProposal.sideA`, failFn);
      validateTradeSide(current.sideB, `${path}.currentProposal.sideB`, failFn);
    }
  }
  if (payload.status !== undefined) {
    const status = payload.status;
    if (
      status !== "pending" &&
      status !== "negotiating" &&
      status !== "accepted" &&
      status !== "declined" &&
      status !== "expired"
    ) {
      failFn(`${path}.status is invalid.`);
    }
  }
  if (payload.negotiationHistory !== undefined) {
    if (!Array.isArray(payload.negotiationHistory)) {
      failFn(`${path}.negotiationHistory must be an array when present.`);
    }
  }
  if (payload.expiresOn !== undefined) {
    assertNonEmptyString(payload.expiresOn, `${path}.expiresOn`);
    parseCalendarDate(payload.expiresOn as string);
  }
}

function validateTradeSide(
  value: unknown,
  path: string,
  failFn: (message: string) => never,
): void {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    failFn(`${path} must be an object.`);
  }
  const side = value as Record<string, unknown>;
  assertNonEmptyString(side.teamId, `${path}.teamId`);
  if (!Array.isArray(side.playerIds)) {
    failFn(`${path}.playerIds must be an array.`);
  }
  if (!Array.isArray(side.draftPickIds)) {
    failFn(`${path}.draftPickIds must be an array.`);
  }
  for (let i = 0; i < (side.playerIds as unknown[]).length; i += 1) {
    assertNonEmptyString(
      (side.playerIds as unknown[])[i],
      `${path}.playerIds[${i}]`,
    );
  }
  for (let i = 0; i < (side.draftPickIds as unknown[]).length; i += 1) {
    assertNonEmptyString(
      (side.draftPickIds as unknown[])[i],
      `${path}.draftPickIds[${i}]`,
    );
  }
}
