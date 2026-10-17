import type {
  BoxScoreSideView,
  BoxScoreTeamStatsView,
  GameBoxScoreView,
} from "@/state/selectors/box-score";
import { periodLabel } from "@/state/watch-game-selectors";

const TOP_PERFORMERS_PER_TEAM = 3;

export type CalendarGamePerformerView = {
  playerId: string;
  playerName: string;
  minutes: number;
  points: number;
  rebounds: number;
  assists: number;
};

export type CalendarGameSideStatsView = {
  teamId: string;
  abbreviation: string;
  score: number;
  teamStats: BoxScoreTeamStatsView;
  topPerformers: CalendarGamePerformerView[];
};

/** Compact final-game summary shown in the calendar date inspector. */
export type CalendarGameStatsView = {
  gameId: string;
  home: CalendarGameSideStatsView;
  away: CalendarGameSideStatsView;
  periods: Array<{ label: string; home: number; away: number }>;
  canWatch: boolean;
};

export function toCalendarGameStatsView(
  boxScore: GameBoxScoreView,
  canWatch: boolean,
): CalendarGameStatsView {
  return {
    gameId: boxScore.gameId,
    home: toSideStats(boxScore.home),
    away: toSideStats(boxScore.away),
    periods: boxScore.periods.map((period, index) => ({
      label: periodLabel(index + 1),
      home: period.home,
      away: period.away,
    })),
    canWatch,
  };
}

function toSideStats(side: BoxScoreSideView): CalendarGameSideStatsView {
  const topPerformers = [...side.players]
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.rebounds + b.assists - (a.rebounds + a.assists) ||
        b.minutes - a.minutes,
    )
    .slice(0, TOP_PERFORMERS_PER_TEAM)
    .map((row) => ({
      playerId: row.playerId,
      playerName: row.playerName,
      minutes: row.minutes,
      points: row.points,
      rebounds: row.rebounds,
      assists: row.assists,
    }));
  return {
    teamId: side.teamId,
    abbreviation: side.abbreviation,
    score: side.score,
    teamStats: side.teamStats,
    topPerformers,
  };
}
