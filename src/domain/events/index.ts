export type { DomainEvent, DomainEventType } from "@/domain/events/domain-event";
export {
  DOMAIN_EVENT_TYPES,
  createDomainEvent,
  isDomainEventType,
  resetDomainEventSequenceForTests,
} from "@/domain/events/domain-event";
