import { createDomainEvent, type DomainEvent } from "@/domain/events";
import { asDomainEventId } from "@/domain/ids";

/**
 * Deterministic domain event helper for season-event transitions.
 * Overrides createDomainEvent's random id with a stable key.
 */
export function createSeasonDomainEvent(input: {
  type: DomainEvent["type"];
  occurredOn: string;
  key: string;
  payload?: Record<string, unknown>;
}): DomainEvent {
  return {
    ...createDomainEvent({
      type: input.type,
      occurredOn: input.occurredOn,
      payload: input.payload,
    }),
    id: asDomainEventId(`evt_${input.key}_${input.type}`),
  };
}
