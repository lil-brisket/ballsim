import type { DomainEventId } from "@/domain/ids";
import { asDomainEventId } from "@/domain/ids";

/**
 * Planned domain event types.
 * Producers are added with their systems; the union exists so systems can
 * publish without coupling to UI.
 */
export type DomainEventType =
  | "GameCompleted"
  | "PlayerInjured"
  | "PlayerDeveloped"
  | "PlayerDeclined"
  | "ContractSigned"
  | "PlayerTraded"
  | "PlayerReleased"
  | "DraftPickMade"
  | "FreeAgentSigned"
  | "CoachHired"
  | "RevenueRecorded"
  | "ExpenseRecorded";

export const DOMAIN_EVENT_TYPES: readonly DomainEventType[] = [
  "GameCompleted",
  "PlayerInjured",
  "PlayerDeveloped",
  "PlayerDeclined",
  "ContractSigned",
  "PlayerTraded",
  "PlayerReleased",
  "DraftPickMade",
  "FreeAgentSigned",
  "CoachHired",
  "RevenueRecorded",
  "ExpenseRecorded",
];

export function isDomainEventType(value: string): value is DomainEventType {
  return (DOMAIN_EVENT_TYPES as readonly string[]).includes(value);
}

export type DomainEvent = {
  id: DomainEventId;
  type: DomainEventType;
  /** Fictional world date (YYYY-MM-DD) when the event occurred in-game. */
  occurredOn: string;
  payload: Record<string, unknown>;
};

/** Test-only counter; production IDs use crypto.randomUUID for cross-process uniqueness. */
let eventSequence = 0;

export function createDomainEvent(input: {
  type: DomainEventType;
  occurredOn: string;
  payload?: Record<string, unknown>;
}): DomainEvent {
  eventSequence += 1;
  const unique =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `seq_${eventSequence}`;
  return {
    id: asDomainEventId(`evt_${unique}_${input.type}`),
    type: input.type,
    occurredOn: input.occurredOn,
    payload: input.payload ?? {},
  };
}

export function resetDomainEventSequenceForTests(): void {
  eventSequence = 0;
}
