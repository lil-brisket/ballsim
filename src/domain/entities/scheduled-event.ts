import type { ScheduledEventId } from "@/domain/ids";

/**
 * Closed union of scheduled simulation event types.
 * Handlers are registered in the simulation scheduled-events module.
 * Extend this union when adding a new persisted scheduled event kind.
 */
export type ScheduledEventType = "noop";

export const SCHEDULED_EVENT_TYPES: readonly ScheduledEventType[] = [
  "noop",
] as const;

export type ScheduledEventStatus = "pending" | "executed";

export const SCHEDULED_EVENT_STATUSES: readonly ScheduledEventStatus[] = [
  "pending",
  "executed",
] as const;

export type ScheduledEvent = {
  id: ScheduledEventId;
  type: ScheduledEventType;
  /** Fictional world date (YYYY-MM-DD) when the event becomes due. */
  triggerDate: string;
  status: ScheduledEventStatus;
  payload: Record<string, unknown>;
};

export function isScheduledEventType(
  value: unknown,
): value is ScheduledEventType {
  return (
    typeof value === "string" &&
    (SCHEDULED_EVENT_TYPES as readonly string[]).includes(value)
  );
}

export function isScheduledEventStatus(
  value: unknown,
): value is ScheduledEventStatus {
  return (
    typeof value === "string" &&
    (SCHEDULED_EVENT_STATUSES as readonly string[]).includes(value)
  );
}
