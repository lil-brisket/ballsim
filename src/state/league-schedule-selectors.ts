/**
 * League-wide schedule browsing — Around Today default.
 * Distinct from Calendar (simulation/time control).
 */

import type { GameStatus } from "@/domain/entities/game";
import type { GameState } from "@/state/game-state";
import { getGamesForSeason } from "@/state/game-access";
import { getActiveOwnerTeamId } from "@/state/owner-context";
import {
  toBrandingView,
  type TeamBrandingView,
} from "@/state/team-branding-view";
import { addCalendarDays } from "@/domain/calendar-date";

export type LeagueScheduleGameRow = {
  gameId: string;
  date: string;
  homeTeamId: string;
  awayTeamId: string;
  homeAbbreviation: string;
  awayAbbreviation: string;
  homeName: string;
  awayName: string;
  homeBranding: TeamBrandingView | null;
  awayBranding: TeamBrandingView | null;
  status: GameStatus | string;
  homeScore: number | null;
  awayScore: number | null;
  competitionType: string;
  /** User can manage home game-day event. */
  canManageEvent: boolean;
};

export type LeagueScheduleView = {
  saveId: string;
  currentDate: string;
  focusDate: string;
  myTeamId: string;
  today: LeagueScheduleGameRow[];
  upcoming: LeagueScheduleGameRow[];
  recent: LeagueScheduleGameRow[];
  teams: Array<{
    teamId: string;
    label: string;
    abbreviation: string;
  }>;
  seasonPhase: string;
  emptyReason: string | null;
};

export type LeagueScheduleFilters = {
  focusDate?: string;
  teamId?: string | null;
  status?: "all" | "upcoming" | "final";
};

function toRow(
  state: GameState,
  game: GameState["competition"]["games"][string],
  myTeamId: string,
): LeagueScheduleGameRow {
  const home = state.world.teams[game.homeTeamId];
  const away = state.world.teams[game.awayTeamId];
  const isFinal = game.status === "final";
  return {
    gameId: game.id,
    date: game.date,
    homeTeamId: game.homeTeamId,
    awayTeamId: game.awayTeamId,
    homeAbbreviation: home?.abbreviation ?? "???",
    awayAbbreviation: away?.abbreviation ?? "???",
    homeName: home ? `${home.city} ${home.name}` : "Home",
    awayName: away ? `${away.city} ${away.name}` : "Away",
    homeBranding: toBrandingView(home?.branding),
    awayBranding: toBrandingView(away?.branding),
    status: game.status,
    homeScore: isFinal ? game.score.home : null,
    awayScore: isFinal ? game.score.away : null,
    competitionType: game.competitionType,
    canManageEvent: game.homeTeamId === myTeamId,
  };
}

function sortGames(
  a: LeagueScheduleGameRow,
  b: LeagueScheduleGameRow,
): number {
  const d = a.date.localeCompare(b.date);
  if (d !== 0) {
    return d;
  }
  return a.gameId.localeCompare(b.gameId);
}

export function toLeagueScheduleView(
  state: GameState,
  filters: LeagueScheduleFilters = {},
): LeagueScheduleView {
  const myTeamId = getActiveOwnerTeamId(state);
  const currentDate = state.world.calendar.currentDate;
  const focusDate = filters.focusDate || currentDate;
  const seasonId = state.competition.season.id;
  const phase = state.competition.season.phase;

  let games = getGamesForSeason(state, seasonId).filter(
    (g) => g.competitionType !== "development_league",
  );

  if (filters.teamId) {
    const tid = filters.teamId;
    games = games.filter(
      (g) => g.homeTeamId === tid || g.awayTeamId === tid,
    );
  }

  if (filters.status === "final") {
    games = games.filter((g) => g.status === "final");
  } else if (filters.status === "upcoming") {
    games = games.filter((g) => g.status !== "final");
  }

  const rows = games.map((g) => toRow(state, g, myTeamId));

  const today = rows.filter((r) => r.date === focusDate).sort(sortGames);

  const upcoming = rows
    .filter((r) => r.date > focusDate && r.status !== "final")
    .sort(sortGames)
    .slice(0, 24);

  // Also include scheduled games on focus date that aren't final in upcoming? No — today section covers focus date.

  const recent = rows
    .filter((r) => r.date < focusDate && r.status === "final")
    .sort((a, b) => {
      const d = b.date.localeCompare(a.date);
      if (d !== 0) {
        return d;
      }
      return b.gameId.localeCompare(a.gameId);
    })
    .slice(0, 12);

  const teams = Object.values(state.world.teams)
    .map((t) => ({
      teamId: t.id,
      label: `${t.city} ${t.name}`,
      abbreviation: t.abbreviation,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  let emptyReason: string | null = null;
  if (
    today.length === 0 &&
    upcoming.length === 0 &&
    recent.length === 0
  ) {
    if (phase === "offseason" || phase === "postseason") {
      emptyReason =
        "No scheduled games — open the Calendar for offseason milestones.";
    } else {
      emptyReason = "No games match these filters.";
    }
  }

  return {
    saveId: state.meta.saveId,
    currentDate,
    focusDate,
    myTeamId,
    today,
    upcoming,
    recent,
    teams,
    seasonPhase: phase,
    emptyReason,
  };
}

export function shiftFocusDate(iso: string, deltaDays: number): string {
  return addCalendarDays(iso, deltaDays);
}
