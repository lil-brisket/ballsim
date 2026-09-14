/**
 * Owner-calendar projection — controlled-team schedule plus owner-relevant events.
 * Explicit allow-list so the calendar does not become a league-wide schedule dump.
 */

import type { CalendarEventView } from "@/domain/entities/calendar-event";
import { importanceAtLeast } from "@/domain/entities/event-source";
import type { SaveId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import {
  projectCalendarEvents,
  type ProjectCalendarEventsOptions,
} from "@/systems/calendar/project-calendar-events";

export type ProjectOwnerCalendarEventsOptions = {
  from?: string;
  to?: string;
  saveId?: SaveId | string;
  teamId?: TeamId;
};

/**
 * Events that belong on the owner calendar for the controlled team.
 */
export function isOwnerCalendarEvent(
  event: CalendarEventView,
  teamId: TeamId,
): boolean {
  if (event.blocking || event.lifecycle === "action_required") {
    return true;
  }

  if (event.category === "deadline") {
    return true;
  }

  if (event.category === "game") {
    return event.teamIds?.includes(teamId) === true;
  }

  if (event.category === "league") {
    return importanceAtLeast(event.importance, "high");
  }

  if (
    (event.category === "team" ||
      event.category === "transaction" ||
      event.category === "injury" ||
      event.category === "news") &&
    event.teamIds?.includes(teamId) === true
  ) {
    return importanceAtLeast(event.importance, "high") || event.blocking;
  }

  return false;
}

/**
 * Project calendar events for the owner calendar surface.
 */
export function projectOwnerCalendarEvents(
  state: GameState,
  options: ProjectOwnerCalendarEventsOptions = {},
): CalendarEventView[] {
  const teamId = options.teamId ?? state.user.activeOwnerTeamId;
  const projected = projectCalendarEvents(state, {
    from: options.from,
    to: options.to,
    saveId: options.saveId,
    teamId,
  } satisfies ProjectCalendarEventsOptions);

  return projected.filter((event) => isOwnerCalendarEvent(event, teamId));
}
