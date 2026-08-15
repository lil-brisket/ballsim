import { parseCalendarDate } from "@/domain/calendar-date";
import type {
  ScheduledEvent,
  ScheduledEventType,
} from "@/domain/entities/scheduled-event";
import type { ScheduledEventId } from "@/domain/ids";
import { asScheduledEventId } from "@/domain/ids";
import type { Rng } from "@/domain/rng";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";

export type ScheduledEventHandler = (
  state: GameState,
  event: ScheduledEvent,
  rng: Rng,
) => SystemResult;

const handlers: Partial<
  Record<ScheduledEventType, ScheduledEventHandler>
> = {
  noop: (state) => systemResult(state),
};

/**
 * Registers or replaces a handler for a scheduled event type.
 * Used by future systems; core advanceSimulation does not grow per feature.
 */
export function registerScheduledEventHandler(
  type: ScheduledEventType,
  handler: ScheduledEventHandler,
): void {
  handlers[type] = handler;
}

export function getScheduledEventHandler(
  type: ScheduledEventType,
): ScheduledEventHandler | undefined {
  return handlers[type];
}

export type ScheduleEventInput = {
  id: string;
  type: ScheduledEventType;
  triggerDate: string;
  payload?: Record<string, unknown>;
};

/**
 * Inserts a pending scheduled event. IDs must be deterministic caller-supplied strings.
 * Throws if an event with the same id already exists.
 */
export function scheduleEvent(
  state: GameState,
  input: ScheduleEventInput,
): SystemResult {
  parseCalendarDate(input.triggerDate);
  const id = asScheduledEventId(input.id);
  if (state.world.scheduledEvents[id] !== undefined) {
    throw new Error(`Scheduled event "${id}" already exists.`);
  }

  const event: ScheduledEvent = {
    id,
    type: input.type,
    triggerDate: input.triggerDate,
    status: "pending",
    payload: input.payload ?? {},
  };

  return systemResult({
    ...state,
    world: {
      ...state.world,
      scheduledEvents: {
        ...state.world.scheduledEvents,
        [id]: event,
      },
    },
  });
}

export type ProcessScheduledEventsResult = SystemResult & {
  scheduledEventsProcessed: number;
};

/**
 * Executes all due pending events for currentDate in ascending (triggerDate, id) order.
 *
 * Failure rule: if a handler throws, effects are not applied, the event stays
 * pending, and the error surfaces (retryable on a later advance).
 */
export function processScheduledEvents(
  state: GameState,
  rng: Rng,
): ProcessScheduledEventsResult {
  const currentDate = state.world.calendar.currentDate;
  const due = Object.values(state.world.scheduledEvents)
    .filter(
      (event) =>
        event.status === "pending" && event.triggerDate <= currentDate,
    )
    .sort((a, b) => {
      if (a.triggerDate !== b.triggerDate) {
        return a.triggerDate < b.triggerDate ? -1 : 1;
      }
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });

  let current = state;
  const events = [];
  let processed = 0;

  for (const event of due) {
    const handler = handlers[event.type];
    if (!handler) {
      throw new Error(
        `No handler registered for scheduled event type "${event.type}".`,
      );
    }

    // Handler runs against current; on throw, current is unchanged and event stays pending.
    const handlerResult = handler(current, event, rng);
    current = markScheduledEventExecuted(handlerResult.state, event.id);
    events.push(...handlerResult.events);
    processed += 1;
  }

  return {
    ...systemResult(current, events),
    scheduledEventsProcessed: processed,
  };
}

function markScheduledEventExecuted(
  state: GameState,
  eventId: ScheduledEventId,
): GameState {
  const existing = state.world.scheduledEvents[eventId];
  if (!existing) {
    throw new Error(`Scheduled event "${eventId}" is missing.`);
  }
  if (existing.status === "executed") {
    return state;
  }
  return {
    ...state,
    world: {
      ...state.world,
      scheduledEvents: {
        ...state.world.scheduledEvents,
        [eventId]: {
          ...existing,
          status: "executed",
        },
      },
    },
  };
}
