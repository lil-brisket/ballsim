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

export type DomainEvent = {
  id: DomainEventId;
  type: DomainEventType;
  /** Fictional world date (YYYY-MM-DD) when the event occurred in-game. */
  occurredOn: string;
  payload: Record<string, unknown>;
};

let eventSequence = 0;

export function createDomainEvent(input: {
  type: DomainEventType;
  occurredOn: string;
  payload?: Record<string, unknown>;
}): DomainEvent {
  eventSequence += 1;
  return {
    id: asDomainEventId(`evt_${eventSequence}_${input.type}`),
    type: input.type,
    occurredOn: input.occurredOn,
    payload: input.payload ?? {},
  };
}

export function resetDomainEventSequenceForTests(): void {
  eventSequence = 0;
}
