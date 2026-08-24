import type { OwnerNotificationId, OwnerObjectiveId, TeamId } from "@/domain/ids";
import type { NarrativeSituationId } from "@/domain/ids";

export type OwnerNotificationSeverity =
  | "info"
  | "success"
  | "warning"
  | "critical";

export const OWNER_NOTIFICATION_SEVERITIES: readonly OwnerNotificationSeverity[] =
  ["info", "success", "warning", "critical"];

export function isOwnerNotificationSeverity(
  value: string,
): value is OwnerNotificationSeverity {
  return OWNER_NOTIFICATION_SEVERITIES.includes(
    value as OwnerNotificationSeverity,
  );
}

export type OwnerNotificationType =
  | "objective_completed"
  | "objective_failed"
  | "playoff_qualified"
  | "playoff_eliminated"
  | "winning_streak"
  | "losing_streak"
  | "significant_financial_change"
  | "season_completed"
  | "offseason_began"
  | "home_sellout"
  | "poor_attendance"
  | "awareness_band"
  | "cash_runway_warning"
  | "financial_health_changed"
  | "calendar_milestone"
  | "narrative";

export const OWNER_NOTIFICATION_TYPES: readonly OwnerNotificationType[] = [
  "objective_completed",
  "objective_failed",
  "playoff_qualified",
  "playoff_eliminated",
  "winning_streak",
  "losing_streak",
  "significant_financial_change",
  "season_completed",
  "offseason_began",
  "home_sellout",
  "poor_attendance",
  "awareness_band",
  "cash_runway_warning",
  "financial_health_changed",
  "calendar_milestone",
  "narrative",
];

export function isOwnerNotificationType(
  value: string,
): value is OwnerNotificationType {
  return OWNER_NOTIFICATION_TYPES.includes(value as OwnerNotificationType);
}

export type OwnerNotification = {
  id: OwnerNotificationId;
  type: OwnerNotificationType;
  title: string;
  message: string;
  /** Fictional world date (YYYY-MM-DD). */
  occurredOn: string;
  severity: OwnerNotificationSeverity;
  read: boolean;
  /** Identity key for idempotent append; not a snapshot store. */
  dedupeKey: string;
  relatedObjectiveId?: OwnerObjectiveId;
  relatedTeamId?: TeamId;
  relatedSituationId?: NarrativeSituationId;
};

export type OwnerNotificationInput = {
  id: OwnerNotificationId;
  type: OwnerNotificationType;
  title: string;
  message: string;
  occurredOn: string;
  severity: OwnerNotificationSeverity;
  read: boolean;
  dedupeKey: string;
  relatedObjectiveId?: OwnerObjectiveId;
  relatedTeamId?: TeamId;
  relatedSituationId?: NarrativeSituationId;
};

/**
 * Structural construction only — does not infer content from game state.
 */
export function createOwnerNotification(
  input: OwnerNotificationInput,
): OwnerNotification {
  assertNonEmptyString(input.id, "id");
  if (!isOwnerNotificationType(input.type)) {
    throw new Error(
      `OwnerNotification type must be one of ${OWNER_NOTIFICATION_TYPES.join(", ")}.`,
    );
  }
  assertNonEmptyString(input.title, "title");
  assertNonEmptyString(input.message, "message");
  assertNonEmptyString(input.occurredOn, "occurredOn");
  if (!isOwnerNotificationSeverity(input.severity)) {
    throw new Error(
      `OwnerNotification severity must be one of ${OWNER_NOTIFICATION_SEVERITIES.join(", ")}.`,
    );
  }
  if (typeof input.read !== "boolean") {
    throw new Error("OwnerNotification read must be a boolean.");
  }
  assertNonEmptyString(input.dedupeKey, "dedupeKey");

  const notification: OwnerNotification = {
    id: input.id,
    type: input.type,
    title: input.title,
    message: input.message,
    occurredOn: input.occurredOn,
    severity: input.severity,
    read: input.read,
    dedupeKey: input.dedupeKey,
  };
  if (input.relatedObjectiveId !== undefined) {
    assertNonEmptyString(input.relatedObjectiveId, "relatedObjectiveId");
    notification.relatedObjectiveId = input.relatedObjectiveId;
  }
  if (input.relatedTeamId !== undefined) {
    assertNonEmptyString(input.relatedTeamId, "relatedTeamId");
    notification.relatedTeamId = input.relatedTeamId;
  }
  if (input.relatedSituationId !== undefined) {
    assertNonEmptyString(input.relatedSituationId, "relatedSituationId");
    notification.relatedSituationId = input.relatedSituationId;
  }
  return notification;
}

function assertNonEmptyString(value: string, field: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`OwnerNotification ${field} must be a non-empty string.`);
  }
  if (value.trim().length === 0) {
    throw new Error(
      `OwnerNotification ${field} cannot be whitespace-only.`,
    );
  }
}
