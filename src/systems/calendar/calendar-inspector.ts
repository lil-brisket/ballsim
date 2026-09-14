/**
 * Server-side Date Inspector view model for the Calendar page.
 * React renders this object — it does not assemble preview/game/event data itself.
 */

import { parseCalendarDate } from "@/domain/calendar-date";
import type { CalendarEventView } from "@/domain/entities/calendar-event";
import type { GameState } from "@/state/game-state";
import { projectOwnerCalendarEvents } from "@/systems/calendar/project-owner-calendar";
import {
  getTeamGameForDate,
  projectTeamGameView,
  type TeamCalendarGameView,
} from "@/systems/calendar/schedule-projection";
import { summarizeSimulationRange } from "@/systems/calendar/simulation-preview";
import {
  getActivePhaseId,
  getPhaseDefinition,
} from "@/systems/phase-engine";
import { getCalendarContext } from "@/systems/simulation/calendar-context";

export type CalendarDateInspectorView = {
  date: string;
  longDateLabel: string;
  dateStatus: "past" | "today" | "future";
  phaseLabel: string;
  simulationStatus: string;
  teamGame: TeamCalendarGameView | null;
  specialEvents: CalendarEventView[];
  leagueContextSnippet: string | null;
  simulationPreview: {
    canSimulate: boolean;
    summaryLines: string[];
    days: number;
  } | null;
  action: "none" | "simulate_to_date";
};

function formatLongDate(isoDate: string): string {
  try {
    const { year, month, day } = parseCalendarDate(isoDate);
    const utc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    return utc.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return isoDate;
  }
}

function buildLeagueSnippet(state: GameState, date: string): string | null {
  const ctx = getCalendarContext(state);
  const parts: string[] = [ctx.displayLabel];

  if (ctx.tradeDeadlineDate != null && ctx.tradeDeadlineDate === date) {
    parts.push("Trade deadline");
  } else if (
    ctx.daysUntilTradeDeadline != null &&
    ctx.daysUntilTradeDeadline >= 0 &&
    ctx.daysUntilTradeDeadline <= 14 &&
    date === state.world.calendar.currentDate
  ) {
    parts.push(
      ctx.daysUntilTradeDeadline === 0
        ? "Trade deadline today"
        : `Trade deadline in ${ctx.daysUntilTradeDeadline} day${
            ctx.daysUntilTradeDeadline === 1 ? "" : "s"
          }`,
    );
  }

  if (ctx.seasonStory) {
    parts.push(ctx.seasonStory);
  }

  const joined = parts.filter(Boolean).join(" · ");
  return joined.length > 0 ? joined : null;
}

function buildPreviewSummaryLines(
  state: GameState,
  selectedDate: string,
  teamGame: TeamCalendarGameView | null,
  specialEvents: readonly CalendarEventView[],
): { summaryLines: string[]; days: number } | null {
  try {
    const preview = summarizeSimulationRange(state, selectedDate);
    const lines: string[] = [];

    if (teamGame) {
      lines.push(
        teamGame.home
          ? `Home vs ${teamGame.opponentName}`
          : `Away vs ${teamGame.opponentName}`,
      );
      lines.push(teamGame.seasonPhase);
    } else if (preview.yourTeam.games > 0) {
      lines.push(
        `${preview.yourTeam.games} team game${
          preview.yourTeam.games === 1 ? "" : "s"
        } in range`,
      );
    }

    if (specialEvents.length > 0) {
      lines.push(
        `${specialEvents.length} league event${
          specialEvents.length === 1 ? "" : "s"
        }`,
      );
    } else if (preview.deadlines.length > 0) {
      lines.push(
        `${preview.deadlines.length} deadline${
          preview.deadlines.length === 1 ? "" : "s"
        } in range`,
      );
    }

    lines.push(
      `${preview.days} day${preview.days === 1 ? "" : "s"} of world simulation`,
    );

    return { summaryLines: lines, days: preview.days };
  } catch {
    return null;
  }
}

/**
 * Build the Date Inspector view for a selected calendar date.
 */
export function buildCalendarDateInspectorView(
  state: GameState,
  selectedDate: string,
  options: { saveId?: string } = {},
): CalendarDateInspectorView {
  const currentDate = state.world.calendar.currentDate;
  const teamId = state.user.activeOwnerTeamId;
  const phaseId = getActivePhaseId(state);
  const phaseLabel = getPhaseDefinition(phaseId).name;
  const ctx = getCalendarContext(state);

  const dateStatus: CalendarDateInspectorView["dateStatus"] =
    selectedDate < currentDate
      ? "past"
      : selectedDate === currentDate
        ? "today"
        : "future";

  const game = getTeamGameForDate(state, teamId, selectedDate);
  const teamGame = game ? projectTeamGameView(state, teamId, game) : null;

  const dayEvents = projectOwnerCalendarEvents(state, {
    from: selectedDate,
    to: selectedDate,
    saveId: options.saveId,
    teamId,
  });
  const specialEvents = dayEvents.filter((event) => event.category !== "game");

  const isFuture = selectedDate > currentDate;
  const previewParts = isFuture
    ? buildPreviewSummaryLines(state, selectedDate, teamGame, specialEvents)
    : null;

  return {
    date: selectedDate,
    longDateLabel: formatLongDate(selectedDate),
    dateStatus,
    phaseLabel,
    simulationStatus: ctx.displayLabel,
    teamGame,
    specialEvents,
    leagueContextSnippet: buildLeagueSnippet(state, selectedDate),
    simulationPreview:
      isFuture && previewParts
        ? {
            canSimulate: true,
            summaryLines: previewParts.summaryLines,
            days: previewParts.days,
          }
        : null,
    action: isFuture && previewParts ? "simulate_to_date" : "none",
  };
}
