import { addCalendarDays } from "@/domain/calendar-date";
import type { GameSettings } from "@/domain/game-settings";
import { DEFAULT_SEASON_EVENTS_SETTINGS } from "@/domain/game-settings";
import type { GameState } from "@/state/game-state";

export type MidseasonEventWindow = {
  /** Midpoint date along scheduled RS calendar. */
  anchorDate: string;
  votingOpenDate: string;
  votingCloseDate: string;
  allStarDate: string;
  awardsCutoffDate: string;
  awardsAnnounceDate: string;
  tournamentStartDate: string;
  tournamentEndDate: string;
};

function seasonEventsConfig(
  settings: GameSettings,
): GameSettings["seasonEvents"] {
  return settings.seasonEvents ?? DEFAULT_SEASON_EVENTS_SETTINGS;
}

/**
 * Unique sorted dates of committed regular-season games in the schedule.
 * Uses schedule.gameIds + games — never "games played".
 */
export function listScheduledRegularSeasonDates(state: GameState): string[] {
  const dates = new Set<string>();
  for (const gameId of state.competition.schedule.gameIds) {
    const game = state.competition.games[gameId];
    if (!game || game.competitionType !== "regular_season") {
      continue;
    }
    dates.add(game.date);
  }
  return [...dates].sort();
}

/**
 * Midseason anchor from committed RS schedule (schedule_fraction).
 * Falls back to settings-only estimate only when no RS schedule exists yet.
 * Never mutates regularSeasonStartDate.
 */
export function deriveMidseasonAnchorDate(state: GameState): string | null {
  const config = seasonEventsConfig(state.settings);
  const fraction = Math.min(
    1,
    Math.max(0, config.midseasonAnchor.fraction),
  );
  const dates = listScheduledRegularSeasonDates(state);
  if (dates.length > 0) {
    if (dates.length === 1) {
      return dates[0]!;
    }
    const index = Math.min(
      dates.length - 1,
      Math.max(0, Math.floor((dates.length - 1) * fraction)),
    );
    return dates[index]!;
  }

  // Schedule not materialized — settings-derived only.
  const start = state.competition.season.regularSeasonStartDate;
  if (start == null || start.length === 0) {
    return null;
  }
  // Approximate 180-day span when schedule unknown.
  const FALLBACK_SPAN_DAYS = 180;
  return addCalendarDays(start, Math.floor(FALLBACK_SPAN_DAYS * fraction));
}

export function deriveMidseasonEventWindow(
  state: GameState,
): MidseasonEventWindow | null {
  const anchorDate = deriveMidseasonAnchorDate(state);
  if (anchorDate == null) {
    return null;
  }
  const config = seasonEventsConfig(state.settings);
  const votingOpenDate = addCalendarDays(
    anchorDate,
    -Math.max(0, config.votingDaysBeforeAnchor),
  );
  const votingCloseDate = addCalendarDays(
    anchorDate,
    Math.max(0, config.votingDaysAfterAnchor),
  );
  const allStarDate = addCalendarDays(
    votingCloseDate,
    Math.max(0, config.allStarDaysAfterVotingClose),
  );
  const awardsCutoffDate = votingCloseDate;
  const awardsAnnounceDate = awardsCutoffDate;
  const tournamentStartDate = addCalendarDays(allStarDate, 1);
  const tournamentEndDate = addCalendarDays(tournamentStartDate, 6);

  return {
    anchorDate,
    votingOpenDate,
    votingCloseDate,
    allStarDate,
    awardsCutoffDate,
    awardsAnnounceDate,
    tournamentStartDate,
    tournamentEndDate,
  };
}
