import { playoffRoundLabel } from "@/domain/entities/playoffs";
import { seriesWinsToClinch } from "@/domain/game-settings";
import type { PlayoffSeries } from "@/domain/entities/playoffs";
import type { GameState } from "@/state/game-state";
import {
  analyzePlayoffBracket,
  type PlayoffBracketAnalysis,
} from "@/state/playoff-conference-view";
import { conferenceBracketRoundLabel } from "@/state/playoff-hub-selectors";
import type { TimelineSeriesState } from "./types";

export type PlayoffSeriesIndex = {
  byGameId: Map<string, TimelineSeriesState>;
  roundLabel(series: PlayoffSeries): string;
  finalRound: number;
};

/** Series state after each playoff game of the current tournament. */
export function buildPlayoffSeriesIndex(state: GameState): PlayoffSeriesIndex {
  const tournament = state.competition.playoffs;
  const bracket: PlayoffBracketAnalysis = analyzePlayoffBracket(
    tournament,
    state,
  );
  const roundLabel = (series: PlayoffSeries): string => {
    if (bracket.isConferenceBracket) {
      return conferenceBracketRoundLabel(
        series.round,
        bracket.conferenceBySeriesId.get(series.id) != null,
        bracket,
      );
    }
    try {
      const label = playoffRoundLabel(series.round, tournament.fieldSize)
        .replaceAll("_", " ")
        .replace(/^semifinal$/, "semifinals");
      return label.charAt(0).toUpperCase() + label.slice(1);
    } catch {
      return `Round ${series.round + 1}`;
    }
  };

  const winsToClinch = seriesWinsToClinch(state.settings.playoffs.seriesLength);
  const byGameId = new Map<string, TimelineSeriesState>();
  for (const series of tournament.series) {
    const wins: Record<string, number> = {};
    for (const teamId of [series.higherSeedTeamId, series.lowerSeedTeamId]) {
      if (teamId) wins[teamId] = 0;
    }
    const label = roundLabel(series);
    series.gameIds.forEach((gameId, index) => {
      const game = state.competition.games[gameId];
      if (!game || game.status !== "final") return;
      const winner =
        game.score.home > game.score.away ? game.homeTeamId : game.awayTeamId;
      wins[winner] = (wins[winner] ?? 0) + 1;
      byGameId.set(gameId, {
        seriesId: series.id,
        roundLabel: label,
        wins: { ...wins },
        gameNumber: index + 1,
        winsToClinch,
      });
    });
  }
  return { byGameId, roundLabel, finalRound: bracket.finalRound };
}
