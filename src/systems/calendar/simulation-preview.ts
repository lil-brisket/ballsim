/**
 * Rich simulation-range preview for simulate-until confirmation.
 */

import { calendarDaysBetween } from "@/domain/calendar-date";
import type { CalendarEventView } from "@/domain/entities/calendar-event";
import { hasBlockingOwnerDecision } from "@/domain/entities/owner-decision";
import type { GameState } from "@/state/game-state";
import { projectCalendarEvents } from "@/systems/calendar/project-calendar-events";
import { isUserOnDraftClock } from "@/systems/draft/draft-clock";
import { getCalendarContext } from "@/systems/simulation/calendar-context";

export type SimulationRangeYourTeamPreview = {
  games: number;
  home: number;
  away: number;
  events: CalendarEventView[];
};

export type SimulationRangeLeaguePreview = {
  games: number;
  deadlines: CalendarEventView[];
};

export type SimulationRangePreview = {
  fromDate: string;
  toDate: string;
  days: number;
  yourTeam: SimulationRangeYourTeamPreview;
  league: SimulationRangeLeaguePreview;
  deadlines: CalendarEventView[];
  potentialInterruptions: string[];
  systemsProcessing: string[];
};

/**
 * Summarize what is known between currentDate and targetDate (inclusive).
 * Rejects targetDate before currentDate.
 */
export function summarizeSimulationRange(
  state: GameState,
  targetDate: string,
): SimulationRangePreview {
  const fromDate = state.world.calendar.currentDate;
  if (targetDate < fromDate) {
    throw new Error(
      `summarizeSimulationRange targetDate ${targetDate} is before currentDate ${fromDate}.`,
    );
  }

  const days = calendarDaysBetween(fromDate, targetDate);
  const teamId = state.user.activeOwnerTeamId;

  const rangeEvents = projectCalendarEvents(state, {
    from: fromDate,
    to: targetDate,
  });

  const yourTeamGames = rangeEvents.filter(
    (event) =>
      event.category === "game" &&
      event.lifecycle === "scheduled" &&
      event.teamIds?.includes(teamId) === true,
  );

  let home = 0;
  let away = 0;
  for (const event of yourTeamGames) {
    if (event.source.type !== "game") continue;
    const game = state.competition.games[event.source.id];
    if (!game) continue;
    if (game.homeTeamId === teamId) home += 1;
    else if (game.awayTeamId === teamId) away += 1;
  }

  const leagueGames = rangeEvents.filter(
    (event) =>
      event.category === "game" && event.lifecycle === "scheduled",
  );

  const deadlines = rangeEvents.filter(
    (event) =>
      event.category === "deadline" &&
      event.date >= fromDate &&
      event.date <= targetDate,
  );

  const potentialInterruptions = buildInterruptions(state, rangeEvents);
  const systemsProcessing = buildSystemsProcessing(state, fromDate, targetDate);

  return {
    fromDate,
    toDate: targetDate,
    days,
    yourTeam: {
      games: yourTeamGames.length,
      home,
      away,
      events: yourTeamGames,
    },
    league: {
      games: leagueGames.length,
      deadlines,
    },
    deadlines,
    potentialInterruptions,
    systemsProcessing,
  };
}

function buildInterruptions(
  state: GameState,
  rangeEvents: readonly CalendarEventView[],
): string[] {
  const interruptions: string[] = [];

  if (hasBlockingOwnerDecision(state.user)) {
    interruptions.push("Blocking owner decision pending");
  } else if (
    rangeEvents.some(
      (event) => event.lifecycle === "action_required" || event.blocking,
    )
  ) {
    interruptions.push("Blocking decision may pause simulation");
  }

  if (isUserOnDraftClock(state)) {
    interruptions.push("Draft pick required (on the clock)");
  }

  const userTeamId = state.user.activeOwnerTeamId;
  const nextUserGame = rangeEvents.find(
    (event) =>
      event.category === "game" &&
      event.lifecycle === "scheduled" &&
      event.teamIds?.includes(userTeamId) === true,
  );
  if (nextUserGame) {
    interruptions.push(`Your team plays on ${nextUserGame.date}`);
  }

  const deadline = rangeEvents.find(
    (event) => event.category === "deadline" && !event.completed,
  );
  if (deadline) {
    interruptions.push(`${deadline.title} on ${deadline.date}`);
  }

  return interruptions;
}

function buildSystemsProcessing(
  state: GameState,
  fromDate: string,
  toDate: string,
): string[] {
  const systems = new Set<string>([
    "Player development",
    "Injuries",
    "Finances",
    "Staff",
    "Transactions",
  ]);

  const ctx = getCalendarContext(state);
  if (ctx.lifecyclePhase === "regular" || ctx.lifecyclePhase === "playoffs") {
    systems.add("Games");
    systems.add("Standings");
  }
  if (ctx.lifecyclePhase === "playoffs") {
    systems.add("Playoffs");
  }
  if (
    ctx.lifecyclePhase === "offseason" ||
    ctx.offseasonStage !== "none"
  ) {
    systems.add("Offseason lifecycle");
  }
  if (ctx.deadlineWindow || (ctx.daysUntilTradeDeadline !== null && ctx.daysUntilTradeDeadline >= 0)) {
    systems.add("Trade market");
  }

  // Month/week boundaries crossed in range.
  if (fromDate.slice(0, 7) !== toDate.slice(0, 7)) {
    systems.add("Monthly awards");
    systems.add("Sponsorships");
  }

  return [...systems];
}
