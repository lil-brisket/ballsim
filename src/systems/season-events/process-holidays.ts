import type { DomainEvent } from "@/domain/events";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { createSeasonDomainEvent } from "@/systems/season-events/season-event-domain";
import {
  ensureSeasonEventsState,
  withSeasonEvents,
} from "@/systems/season-events/plan-season-events";

/**
 * Presentation-only holiday processing (M3).
 * No economic / attendance / sentiment effects.
 */
export function processHolidays(
  state: GameState,
  simulatedDate: string,
  phase: "activate" | "complete",
): SystemResult {
  const seasonEvents = ensureSeasonEventsState(state);
  const events: DomainEvent[] = [];
  let holidays = { ...seasonEvents.holidays };
  let seasonEventMap = { ...seasonEvents.events };
  let changed = false;

  for (const key of Object.keys(holidays).sort()) {
    const holiday = holidays[key]!;
    const eventId = Object.keys(seasonEventMap).find(
      (id) =>
        seasonEventMap[id]!.type === "holiday" &&
        seasonEventMap[id]!.sidecarKey === key,
    );
    const seasonEvent = eventId ? seasonEventMap[eventId] : null;

    if (phase === "activate") {
      if (
        holiday.status === "scheduled" &&
        holiday.startDate <= simulatedDate &&
        holiday.endDate >= simulatedDate
      ) {
        holidays = {
          ...holidays,
          [key]: { ...holiday, status: "active" },
        };
        if (seasonEvent && eventId) {
          seasonEventMap = {
            ...seasonEventMap,
            [eventId]: { ...seasonEvent, status: "active" },
          };
        }
        events.push(
          createSeasonDomainEvent({
            type: "HolidayStarted",
            occurredOn: simulatedDate,
            key: `${state.competition.season.id}_holiday_${key}_start`,
            payload: {
              holidayKey: key,
              title: holiday.title,
              startDate: holiday.startDate,
              endDate: holiday.endDate,
            },
          }),
        );
        changed = true;
      }
    } else {
      if (
        (holiday.status === "active" || holiday.status === "scheduled") &&
        holiday.endDate < simulatedDate
      ) {
        // Catch-up: if we skipped the active window, still complete without
        // duplicate HolidayStarted when never activated (scheduled → completed).
        const wasActive = holiday.status === "active";
        holidays = {
          ...holidays,
          [key]: { ...holiday, status: "completed" },
        };
        if (seasonEvent && eventId) {
          seasonEventMap = {
            ...seasonEventMap,
            [eventId]: { ...seasonEvent, status: "completed" },
          };
        }
        if (wasActive) {
          events.push(
            createSeasonDomainEvent({
              type: "HolidayCompleted",
              occurredOn: simulatedDate,
              key: `${state.competition.season.id}_holiday_${key}_end`,
              payload: {
                holidayKey: key,
                title: holiday.title,
              },
            }),
          );
        } else if (
          holiday.startDate <= simulatedDate &&
          holiday.status === "scheduled"
        ) {
          // Bulk jump: emit start then complete for skipped single-day holidays.
          events.push(
            createSeasonDomainEvent({
              type: "HolidayStarted",
              occurredOn: holiday.startDate,
              key: `${state.competition.season.id}_holiday_${key}_start`,
              payload: {
                holidayKey: key,
                title: holiday.title,
                startDate: holiday.startDate,
                endDate: holiday.endDate,
              },
            }),
          );
          events.push(
            createSeasonDomainEvent({
              type: "HolidayCompleted",
              occurredOn: holiday.endDate,
              key: `${state.competition.season.id}_holiday_${key}_end`,
              payload: {
                holidayKey: key,
                title: holiday.title,
              },
            }),
          );
        }
        changed = true;
      } else if (
        holiday.status === "active" &&
        holiday.endDate === simulatedDate
      ) {
        holidays = {
          ...holidays,
          [key]: { ...holiday, status: "completed" },
        };
        if (seasonEvent && eventId) {
          seasonEventMap = {
            ...seasonEventMap,
            [eventId]: { ...seasonEvent, status: "completed" },
          };
        }
        events.push(
          createSeasonDomainEvent({
            type: "HolidayCompleted",
            occurredOn: simulatedDate,
            key: `${state.competition.season.id}_holiday_${key}_end`,
            payload: {
              holidayKey: key,
              title: holiday.title,
            },
          }),
        );
        changed = true;
      }
    }
  }

  if (!changed) {
    return systemResult(state);
  }

  return systemResult(
    withSeasonEvents(state, {
      ...seasonEvents,
      events: seasonEventMap,
      holidays,
    }),
    events,
  );
}
