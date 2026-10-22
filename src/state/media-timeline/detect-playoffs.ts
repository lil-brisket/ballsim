import type { PlayoffSeries } from "@/domain/entities/playoffs";
import { lastArchivedGameDate } from "./archive-dates";
import type { DetectorInput } from "./detector-input";
import type { TimelinePost } from "./types";

/**
 * Series wins and the champion from the current tournament, plus the
 * previous season's champion from franchise history.
 */
export function detectPlayoffs(input: DetectorInput): TimelinePost[] {
  const posts: TimelinePost[] = [];
  for (const series of input.state.competition.playoffs.series) {
    const post = seriesPost(input, series);
    if (post) posts.push(post);
  }
  const previous = previousChampionPost(input);
  if (previous) posts.push(previous);
  return posts;
}

function seriesPost(
  input: DetectorInput,
  series: PlayoffSeries,
): TimelinePost | null {
  const { state, refs, ctx } = input;
  if (series.status !== "complete" || !series.winnerTeamId) return null;
  const loserTeamId =
    series.higherSeedTeamId === series.winnerTeamId
      ? series.lowerSeedTeamId
      : series.higherSeedTeamId;
  if (!loserTeamId) return null;
  const lastGameId = series.gameIds[series.gameIds.length - 1];
  const lastGame = lastGameId ? state.competition.games[lastGameId] : null;
  if (!lastGame || lastGame.status !== "final") return null;

  const winnerWins = series.wins[series.winnerTeamId] ?? 0;
  const loserWins = series.wins[loserTeamId] ?? 0;
  const isFinal = series.round === input.series.finalRound;
  const sweep = loserWins === 0;
  const wentDistance = winnerWins === loserWins + 1 && winnerWins > 1;
  const winner = refs.team(series.winnerTeamId);
  const loser = refs.team(loserTeamId);
  const notability = isFinal
    ? 100
    : Math.min(95, 70 + 5 * series.round + (sweep || wentDistance ? 5 : 0));

  return {
    id: isFinal ? `playoff:champion:${ctx.seasonId}` : `playoff:${series.id}`,
    occurredOn: lastGame.date,
    kind: "playoff",
    importance: isFinal ? "critical" : "high",
    notability,
    relevance: 0,
    teamIds: [winner.teamId, loser.teamId],
    playerIds: [],
    gameId: lastGame.id,
    attachment: {
      type: "playoff",
      event: isFinal ? "champion" : "series_won",
      seasonYear: ctx.seasonYear,
      seriesId: series.id,
      roundLabel: input.series.roundLabel(series),
      winner,
      loser,
      seriesScore: { winner: winnerWins, loser: loserWins },
      sweep,
      wentDistance,
    },
    tags: [winner.abbreviation, loser.abbreviation],
    unread: false,
  };
}

function previousChampionPost(input: DetectorInput): TimelinePost | null {
  const { state, ctx, refs } = input;
  const year = ctx.seasonYear - 1;
  for (const [teamId, history] of Object.entries(
    state.business.franchiseHistory,
  )) {
    const season = history.seasons.find(
      (s) => s.seasonYear === year && s.championship,
    );
    if (!season) continue;
    const date = lastArchivedGameDate(state, season.seasonId, "playoffs");
    if (!date) return null;
    const winner = refs.team(teamId);
    return {
      id: `playoff:champion:${season.seasonId}`,
      occurredOn: date,
      kind: "playoff",
      importance: "high",
      notability: 70,
      relevance: 0,
      teamIds: [teamId],
      playerIds: [],
      attachment: {
        type: "playoff",
        event: "previous_champion",
        seasonYear: year,
        seriesId: null,
        roundLabel: null,
        winner,
        loser: null,
        seriesScore: null,
        sweep: false,
        wentDistance: false,
      },
      tags: [winner.abbreviation],
      unread: false,
    };
  }
  return null;
}
