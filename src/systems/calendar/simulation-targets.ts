/**
 * Next simulation target finders — explicit stop modes for time control.
 */

import { calendarDaysBetween } from "@/domain/calendar-date";
import type { CalendarEventView } from "@/domain/entities/calendar-event";
import { importanceAtLeast } from "@/domain/entities/event-source";
import {
  getBlockingOwnerDecisions,
  hasBlockingOwnerDecision,
} from "@/domain/entities/owner-decision";
import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { projectCalendarEvents } from "@/systems/calendar/project-calendar-events";

export type SimulationTargetMode =
  | "next_game"
  | "next_important"
  | "next_decision"
  | "next_deadline";

export type SimulationTarget = {
  date: string;
  event?: CalendarEventView;
  daysUntil: number;
};

export function findNextSimulationTarget(
  state: GameState,
  mode: SimulationTargetMode,
): SimulationTarget | null {
  const currentDate = state.world.calendar.currentDate;
  const teamId = state.user.activeOwnerTeamId;

  switch (mode) {
    case "next_decision":
      return findNextDecision(state, currentDate);
    case "next_game":
      return findNextGame(state, currentDate, teamId);
    case "next_deadline":
      return findNextDeadline(state, currentDate);
    case "next_important":
      return findNextImportant(state, currentDate, teamId);
  }
}

function toTarget(
  currentDate: string,
  event: CalendarEventView,
): SimulationTarget {
  return {
    date: event.date,
    event,
    daysUntil: calendarDaysBetween(currentDate, event.date),
  };
}

function findNextDecision(
  state: GameState,
  currentDate: string,
): SimulationTarget | null {
  if (!hasBlockingOwnerDecision(state.user)) {
    return null;
  }
  const decisions = projectCalendarEvents(state, {
    from: currentDate,
    filter: "action_required",
  }).filter((event) => event.blocking);
  const first = decisions[0];
  if (first) {
    return toTarget(currentDate, first);
  }
  const blocking = getBlockingOwnerDecisions(state.user)[0];
  if (!blocking) return null;
  return {
    date: currentDate,
    daysUntil: 0,
  };
}

function findNextGame(
  state: GameState,
  currentDate: string,
  teamId: TeamId,
): SimulationTarget | null {
  const games = projectCalendarEvents(state, {
    from: currentDate,
    filter: "game",
    userTeamOnly: true,
    teamId,
  }).filter(
    (event) =>
      event.lifecycle === "scheduled" &&
      event.teamIds?.includes(teamId) === true,
  );
  const first = games[0];
  return first ? toTarget(currentDate, first) : null;
}

function findNextDeadline(
  state: GameState,
  currentDate: string,
): SimulationTarget | null {
  const deadlines = projectCalendarEvents(state, {
    from: currentDate,
    filter: "deadline",
  }).filter(
    (event) =>
      event.date >= currentDate &&
      event.lifecycle === "scheduled" &&
      !event.completed,
  );
  const first = deadlines[0];
  return first ? toTarget(currentDate, first) : null;
}

function findNextImportant(
  state: GameState,
  currentDate: string,
  teamId: TeamId,
): SimulationTarget | null {
  const events = projectCalendarEvents(state, {
    from: currentDate,
  }).filter((event) => {
    if (event.date < currentDate) return false;
    if (!importanceAtLeast(event.importance, "high")) return false;
    if (event.blocking) return true;
    if (event.category === "deadline" || event.category === "league") {
      return (
        event.lifecycle === "scheduled" ||
        event.lifecycle === "action_required"
      );
    }
    return (
      event.teamIds?.includes(teamId) === true &&
      (event.lifecycle === "scheduled" ||
        event.lifecycle === "action_required")
    );
  });

  const first = events[0];
  return first ? toTarget(currentDate, first) : null;
}
