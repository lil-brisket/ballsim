import type { PlayoffSeries } from "@/domain/entities/playoffs";
import type { GameId, TeamId } from "@/domain/ids";
import { SERIES_WINS_TO_CLINCH } from "@/systems/playoff-config";

/**
 * Records one completed game into a series. Stops at SERIES_WINS_TO_CLINCH.
 * Does not decide home court or create games.
 */
export function recordSeriesGameResult(
  series: PlayoffSeries,
  gameId: GameId,
  winnerTeamId: TeamId,
): PlayoffSeries {
  if (series.status === "complete") {
    throw new Error(
      `Series ${series.id} is complete and cannot accept additional games.`,
    );
  }
  if (series.status !== "active") {
    throw new Error(
      `Series ${series.id} status is "${series.status}"; only active series accept games.`,
    );
  }
  if (!series.higherSeedTeamId || !series.lowerSeedTeamId) {
    throw new Error(
      `Series ${series.id} is missing participants and cannot record a result.`,
    );
  }
  if (
    winnerTeamId !== series.higherSeedTeamId &&
    winnerTeamId !== series.lowerSeedTeamId
  ) {
    throw new Error(
      `Series ${series.id}: winner ${winnerTeamId} is not a series participant.`,
    );
  }
  if (series.gameIds.includes(gameId)) {
    throw new Error(
      `Series ${series.id} already includes game ${gameId}.`,
    );
  }
  if (series.gameIds.length >= 7) {
    throw new Error(
      `Series ${series.id} already has 7 games; cannot record another.`,
    );
  }

  const higherWins = series.wins[series.higherSeedTeamId] ?? 0;
  const lowerWins = series.wins[series.lowerSeedTeamId] ?? 0;
  if (
    higherWins >= SERIES_WINS_TO_CLINCH ||
    lowerWins >= SERIES_WINS_TO_CLINCH
  ) {
    throw new Error(
      `Series ${series.id} already has a clinched winner and cannot accept games.`,
    );
  }

  const nextWins = {
    ...series.wins,
    [winnerTeamId]: (series.wins[winnerTeamId] ?? 0) + 1,
  };

  if ((nextWins[winnerTeamId] ?? 0) > SERIES_WINS_TO_CLINCH) {
    throw new Error(
      `Series ${series.id}: team ${winnerTeamId} would exceed ${SERIES_WINS_TO_CLINCH} wins.`,
    );
  }

  const nextGameIds = [...series.gameIds, gameId];
  const clinched = (nextWins[winnerTeamId] ?? 0) >= SERIES_WINS_TO_CLINCH;

  return {
    ...series,
    wins: nextWins,
    gameIds: nextGameIds,
    status: clinched ? "complete" : "active",
    winnerTeamId: clinched ? winnerTeamId : series.winnerTeamId,
  };
}

/** True when either participant has reached the clinch threshold. */
export function isSeriesComplete(series: PlayoffSeries): boolean {
  return series.status === "complete";
}

/** Games still needed before a clinch is possible (0 if complete). */
export function seriesGamesPlayed(series: PlayoffSeries): number {
  return series.gameIds.length;
}
