import type { Game, GamePlayerStats } from "@/domain/entities/game";
import { combineNotability, type DetectorInput } from "./detector-input";
import { toStatLine } from "./refs";
import type { PerformanceReason, TimelinePost } from "./types";

export const PERFORMANCE_THRESHOLDS = {
  points: 40,
  /** Points and rebounds both at or above this for a 20/20. */
  twentyTwenty: 20,
  blocks: 8,
  steals: 7,
  assists: 15,
  /** Season-high posts start after this many game days... */
  seasonHighMinGameDays: 10,
  /** ...and need at least this many points. */
  seasonHighMinPoints: 30,
} as const;

const REASON_SCORE: Record<
  Exclude<PerformanceReason, "forty_points">,
  number
> = {
  twenty_twenty: 55,
  triple_double: 55,
  blocks: 50,
  steals: 50,
  assists: 50,
  season_high: 45,
};

type Candidate = {
  row: GamePlayerStats;
  reasons: PerformanceReason[];
  notability: number;
};

/** At most one performance post per game: the most notable line. */
export function detectPerformances(input: DetectorInput): TimelinePost[] {
  const posts: TimelinePost[] = [];
  for (const game of input.ctx.games) {
    if (game.competitionType === "all_star") continue;
    let best: Candidate | null = null;
    for (const row of game.playerStats) {
      const candidate = scoreRow(input, game, row);
      if (!candidate) continue;
      if (
        !best ||
        candidate.notability > best.notability ||
        (candidate.notability === best.notability &&
          candidate.row.playerId.localeCompare(best.row.playerId) < 0)
      ) {
        best = candidate;
      }
    }
    if (best) {
      const post = toPost(input, game, best);
      if (post) posts.push(post);
    }
  }
  return posts;
}

export function performanceReasons(
  row: Pick<
    GamePlayerStats,
    "points" | "rebounds" | "assists" | "steals" | "blocks"
  >,
): PerformanceReason[] {
  const t = PERFORMANCE_THRESHOLDS;
  const reasons: PerformanceReason[] = [];
  if (row.points >= t.points) reasons.push("forty_points");
  if (row.points >= t.twentyTwenty && row.rebounds >= t.twentyTwenty) {
    reasons.push("twenty_twenty");
  }
  const doubleDigits = [
    row.points,
    row.rebounds,
    row.assists,
    row.steals,
    row.blocks,
  ].filter((value) => value >= 10).length;
  if (doubleDigits >= 3) reasons.push("triple_double");
  if (row.blocks >= t.blocks) reasons.push("blocks");
  if (row.steals >= t.steals) reasons.push("steals");
  if (row.assists >= t.assists) reasons.push("assists");
  return reasons;
}

function scoreRow(
  input: DetectorInput,
  game: Game,
  row: GamePlayerStats,
): Candidate | null {
  const reasons = performanceReasons(row);
  const dayIndex = input.ctx.gameDayIndex.get(game.date) ?? 0;
  const previousHigh = input.ctx.seasonHighBefore.get(game.id) ?? 0;
  if (
    dayIndex >= PERFORMANCE_THRESHOLDS.seasonHighMinGameDays &&
    row.points >= PERFORMANCE_THRESHOLDS.seasonHighMinPoints &&
    row.points > previousHigh
  ) {
    reasons.push("season_high");
  }
  if (reasons.length === 0) return null;
  const scores = reasons.map((reason) =>
    reason === "forty_points"
      ? 60 + 2 * (row.points - PERFORMANCE_THRESHOLDS.points)
      : REASON_SCORE[reason],
  );
  return { row, reasons, notability: combineNotability(scores) };
}

function toPost(
  input: DetectorInput,
  game: Game,
  candidate: Candidate,
): TimelinePost | null {
  const { row } = candidate;
  const teamId = row.teamId;
  if (!teamId) return null;
  const player = input.refs.player(row.playerId, row);
  if (!player) return null;
  const isHome = teamId === game.homeTeamId;
  const team = isHome
    ? input.refs.team(game.homeTeamId, game.homeTeamSnapshot)
    : input.refs.team(game.awayTeamId, game.awayTeamSnapshot);
  const opponent = isHome
    ? input.refs.team(game.awayTeamId, game.awayTeamSnapshot)
    : input.refs.team(game.homeTeamId, game.homeTeamSnapshot);
  const won = isHome
    ? game.score.home > game.score.away
    : game.score.away > game.score.home;

  return {
    id: `perf:${game.id}:${row.playerId}`,
    occurredOn: game.date,
    kind: "performance",
    importance: candidate.notability >= 70 ? "high" : "medium",
    notability: candidate.notability,
    relevance: 0,
    teamIds: [team.teamId, opponent.teamId],
    playerIds: [row.playerId],
    gameId: game.id,
    attachment: {
      type: "performance",
      gameId: game.id,
      player,
      team,
      opponent,
      won,
      line: toStatLine(row),
      reasons: candidate.reasons,
    },
    tags: [team.abbreviation],
    unread: false,
  };
}
