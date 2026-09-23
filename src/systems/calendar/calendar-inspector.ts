/**
 * Server-side Date Inspector view model for the Calendar page.
 * React renders this object — it does not assemble preview/game/event data itself.
 */

import { parseCalendarDate } from "@/domain/calendar-date";
import type { CalendarEventView } from "@/domain/entities/calendar-event";
import type { GameState } from "@/state/game-state";
import { projectOwnerCalendarEvents } from "@/systems/calendar/project-owner-calendar";
import {
  toCalendarLeagueMilestoneMarker,
} from "@/systems/calendar/league-milestone-markers";
import { getLeagueMilestones } from "@/systems/league-rules/calendar-events";
import { canBeginRegularSeason } from "@/systems/league-rules";
import {
  getTeamGameForDate,
  projectTeamGameView,
  type TeamCalendarGameView,
} from "@/systems/calendar/schedule-projection";
import { summarizeSimulationRange } from "@/systems/calendar/simulation-preview";
import {
  getActivePhaseId,
  getPhaseDefinition,
  previewAdvance,
} from "@/systems/phase-engine";
import { getCalendarContext } from "@/systems/simulation/calendar-context";
import { needsRegularSeasonInitialization } from "@/systems/simulation/season-lifecycle";

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
    blockReason: string | null;
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

function leagueMilestoneEventsForDate(
  state: GameState,
  date: string,
  saveId: string,
): CalendarEventView[] {
  const events: CalendarEventView[] = [];

  for (const milestone of getLeagueMilestones(state)) {
    const marker = toCalendarLeagueMilestoneMarker(milestone);
    if (!marker || marker.date !== date) continue;

    events.push({
      id: `cal:milestone:${marker.key}:${marker.date}`,
      date: marker.date,
      lifecycle: marker.reached ? "occurred" : "scheduled",
      certainty: marker.reached ? "known" : "scheduled",
      category: marker.key === "tradeDeadline" ? "deadline" : "league",
      title: marker.label,
      importance: "high",
      source: { type: "milestone", key: marker.key },
      sourceKey: `milestone:${marker.key}`,
      blocking: false,
      completed: marker.reached,
      href: `/dashboard/${saveId}/calendar?date=${marker.date}`,
    });
  }

  return events;
}

/**
 * Server-built simulation preview — authoritative gates live in phase-engine /
 * season-lifecycle. The inspector only renders these fields.
 */
export function buildCalendarSimulationPreview(
  state: GameState,
  selectedDate: string,
  teamGame: TeamCalendarGameView | null,
  specialEvents: readonly CalendarEventView[],
): {
  canSimulate: boolean;
  summaryLines: string[];
  days: number;
  blockReason: string | null;
} | null {
  if (selectedDate <= state.world.calendar.currentDate) {
    return null;
  }

  const needsInit = needsRegularSeasonInitialization(state);
  const preview = previewAdvance(state);
  const gate = canBeginRegularSeason(state);
  const blocked =
    needsInit && (!preview.canAdvance || !gate.allowed);

  let blockReason: string | null = null;
  if (blocked) {
    const lines: string[] = ["Cannot begin regular season."];
    if (preview.blockReason) lines.push(preview.blockReason);
    if (gate.blockReason && gate.blockReason !== preview.blockReason) {
      lines.push(gate.blockReason);
    }
    for (const v of gate.violations) {
      if (v.message && !lines.includes(v.message)) {
        lines.push(`• ${v.message}`);
      }
    }
    blockReason = lines.join(" ");
  }

  const lines: string[] = [];

  if (needsInit) {
    lines.push(
      "Simulate to begin the regular season. No games will be played yet. Simulation will pause at the start of the regular season.",
    );
  } else if (
    state.competition.season.phase === "regular" &&
    state.competition.season.regularSeasonStartDate ===
      state.world.calendar.currentDate
  ) {
    const openerStillScheduled = Object.values(state.competition.games).some(
      (g) =>
        g.competitionType === "regular_season" &&
        g.date === state.world.calendar.currentDate &&
        g.status === "scheduled",
    );
    if (openerStillScheduled) {
      lines.push(
        "The regular season is ready. Simulate again to play today's games.",
      );
    }
  }

  try {
    const range = summarizeSimulationRange(state, selectedDate);

    if (teamGame) {
      lines.push(
        teamGame.home
          ? `Home vs ${teamGame.opponentName}`
          : `Away vs ${teamGame.opponentName}`,
      );
      lines.push(teamGame.seasonPhase);
    } else if (range.yourTeam.games > 0 && !needsInit) {
      lines.push(
        `${range.yourTeam.games} team game${
          range.yourTeam.games === 1 ? "" : "s"
        } in range`,
      );
    }

    if (specialEvents.length > 0) {
      lines.push(
        `${specialEvents.length} league event${
          specialEvents.length === 1 ? "" : "s"
        }`,
      );
    } else if (range.deadlines.length > 0) {
      lines.push(
        `${range.deadlines.length} deadline${
          range.deadlines.length === 1 ? "" : "s"
        } in range`,
      );
    }

    if (!needsInit) {
      lines.push(
        `${range.days} day${range.days === 1 ? "" : "s"} of world simulation`,
      );
    }

    return {
      canSimulate: !blocked,
      summaryLines: lines,
      days: range.days,
      blockReason,
    };
  } catch {
    if (lines.length === 0 && !blockReason) return null;
    return {
      canSimulate: !blocked,
      summaryLines: lines,
      days: 0,
      blockReason,
    };
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
  const milestoneEvents = leagueMilestoneEventsForDate(
    state,
    selectedDate,
    String(options.saveId ?? state.meta.saveId),
  );
  const specialEvents = [
    ...dayEvents.filter((event) => event.category !== "game"),
    ...milestoneEvents,
  ];

  const isFuture = selectedDate > currentDate;
  const simulationPreview = isFuture
    ? buildCalendarSimulationPreview(
        state,
        selectedDate,
        teamGame,
        specialEvents,
      )
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
    simulationPreview,
    action:
      isFuture && simulationPreview && simulationPreview.canSimulate
        ? "simulate_to_date"
        : isFuture && simulationPreview
          ? "simulate_to_date"
          : "none",
  };
}
