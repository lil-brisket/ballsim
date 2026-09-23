/**
 * Schedule-authoritative team game lookups for the calendar.
 * The calendar never invents games — it only projects existing Game objects.
 */

import type { Game } from "@/domain/entities/game";
import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";

/**
 * All games involving `teamId` on `date` (supports doubleheaders).
 */
export function getTeamGamesForDate(
  state: GameState,
  teamId: TeamId,
  date: string,
): Game[] {
  const byDate = state.competition.schedule.gameIdsByDate?.[date];
  const candidateIds =
    byDate ??
    state.competition.schedule.gameIds.filter((gameId) => {
      const game = state.competition.games[gameId];
      return game?.date === date;
    });

  const games: Game[] = [];
  for (const gameId of candidateIds) {
    const game = state.competition.games[gameId];
    if (!game) continue;
    if (game.homeTeamId === teamId || game.awayTeamId === teamId) {
      games.push(game);
    }
  }
  return games;
}

/**
 * Primary team game for a date, or null when the team is idle.
 */
export function getTeamGameForDate(
  state: GameState,
  teamId: TeamId,
  date: string,
): Game | null {
  return getTeamGamesForDate(state, teamId, date)[0] ?? null;
}

export type TeamCalendarGameView = {
  gameId: string;
  home: boolean;
  homeAwayLabel: "HOME" | "AWAY";
  opponentAbbreviation: string;
  opponentName: string;
  opponentTeamId: string;
  status: string;
  seasonPhase: string;
  scoreLabel: string | null;
  resultLabel: string | null;
  startTimeLabel: string | null;
};

function seasonPhaseLabel(competitionType: Game["competitionType"]): string {
  switch (competitionType) {
    case "preseason":
      return "Preseason";
    case "playoffs":
      return "Playoffs";
    case "development_league":
      return "Development League";
    default:
      return "Regular Season";
  }
}

/**
 * Presentation view for a controlled-team game on the calendar / inspector.
 */
export function projectTeamGameView(
  state: GameState,
  teamId: TeamId,
  game: Game,
): TeamCalendarGameView {
  const home = game.homeTeamId === teamId;
  const opponentTeamId = home ? game.awayTeamId : game.homeTeamId;
  const opponent = state.world.teams[opponentTeamId];
  const opponentName = opponent
    ? `${opponent.city} ${opponent.name}`
    : String(opponentTeamId);
  const opponentAbbreviation = opponent?.abbreviation ?? "???";

  let scoreLabel: string | null = null;
  let resultLabel: string | null = null;
  if (game.status === "final") {
    const homeScore = game.score?.home;
    const awayScore = game.score?.away;
    if (typeof homeScore === "number" && typeof awayScore === "number") {
      const teamScore = home ? homeScore : awayScore;
      const opponentScore = home ? awayScore : homeScore;
      scoreLabel = `${teamScore}–${opponentScore}`;
      const tied = teamScore === opponentScore;
      const won = teamScore > opponentScore;
      resultLabel = tied
        ? `T ${scoreLabel}`
        : `${won ? "W" : "L"} ${scoreLabel}`;
    }
  }

  return {
    gameId: game.id,
    home,
    homeAwayLabel: home ? "HOME" : "AWAY",
    opponentAbbreviation,
    opponentName,
    opponentTeamId,
    status: game.status,
    seasonPhase: seasonPhaseLabel(game.competitionType),
    scoreLabel,
    resultLabel,
    startTimeLabel: null,
  };
}

/**
 * Earliest schedule date on/after currentDate with a game for `teamId`.
 * Schedule-authoritative — not coupled to simulation-target helpers.
 */
export function getNextTeamGameDate(
  state: GameState,
  teamId: TeamId,
): string | null {
  const currentDate = state.world.calendar.currentDate;
  let nextDate: string | null = null;

  for (const gameId of state.competition.schedule.gameIds) {
    const game = state.competition.games[gameId];
    if (!game) continue;
    if (game.homeTeamId !== teamId && game.awayTeamId !== teamId) continue;
    if (game.date < currentDate) continue;
    if (game.competitionType === "development_league") continue;
    if (nextDate == null || game.date < nextDate) {
      nextDate = game.date;
    }
  }

  return nextDate;
}
