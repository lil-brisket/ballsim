import type { Game, GamePlayerStats, GameScore } from "@/domain/entities/game";
import { combineNotability, type DetectorInput } from "./detector-input";
import { teamTagLabel } from "./compose-text";
import { toStatLine } from "./refs";
import { winPct } from "./season-context";
import type {
  GameAttachment,
  GameNotabilityReason,
  TimelinePerformer,
  TimelinePost,
} from "./types";

export const GAME_THRESHOLDS = {
  /** Final margin for a blowout. */
  blowoutMargin: 25,
  /** Deficit the winner trailed by at a period break. */
  comebackDeficit: 15,
  /** Win% gap (loser minus winner, before tip-off) for an upset. */
  upsetWinPctGap: 0.25,
  /** Both teams need this many games before an upset counts. */
  upsetMinGames: 10,
} as const;

const REGULATION_PERIODS = 4;

export function detectGames(input: DetectorInput): TimelinePost[] {
  const posts: TimelinePost[] = [];
  for (const game of input.ctx.games) {
    const post = detectGame(input, game);
    if (post) posts.push(post);
  }
  return posts;
}

function detectGame(input: DetectorInput, game: Game): TimelinePost | null {
  const { ctx, refs, viewerTeamId } = input;
  const homeWon = game.score.home > game.score.away;
  const winnerTeamId = homeWon ? game.homeTeamId : game.awayTeamId;
  const margin = Math.abs(game.score.home - game.score.away);
  const overtimePeriods = Math.max(
    0,
    game.periodScores.length - REGULATION_PERIODS,
  );
  const comebackDeficit = largestWinnerDeficit(game.periodScores, homeWon);

  const record = ctx.recordBefore.get(game.id);
  const homePct = record ? winPct(record.home) : null;
  const awayPct = record ? winPct(record.away) : null;

  const scored: Array<[GameNotabilityReason, number]> = [];
  if (game.homeTeamId === viewerTeamId || game.awayTeamId === viewerTeamId) {
    scored.push(["user_team", 40]);
  }
  if (game.competitionType === "playoffs") scored.push(["playoff", 55]);
  if (game.competitionType === "all_star") scored.push(["all_star", 50]);
  if (margin >= GAME_THRESHOLDS.blowoutMargin) {
    scored.push(["blowout", 30 + 2 * (margin - GAME_THRESHOLDS.blowoutMargin)]);
  }
  if (overtimePeriods > 0) {
    scored.push(["overtime", 40 + 10 * (overtimePeriods - 1)]);
  }
  if (comebackDeficit >= GAME_THRESHOLDS.comebackDeficit) {
    scored.push([
      "comeback",
      40 + 2 * (comebackDeficit - GAME_THRESHOLDS.comebackDeficit),
    ]);
  }
  if (record && isUpset(record, homeWon)) {
    const gap = homeWon
      ? (awayPct ?? 0) - (homePct ?? 0)
      : (homePct ?? 0) - (awayPct ?? 0);
    scored.push(["upset", 35 + 100 * (gap - GAME_THRESHOLDS.upsetWinPctGap)]);
  }
  if (scored.length === 0) return null;

  const home = refs.team(game.homeTeamId, game.homeTeamSnapshot);
  const away = refs.team(game.awayTeamId, game.awayTeamSnapshot);
  const topHome = topPerformer(input, game, game.homeTeamId);
  const topAway = topPerformer(input, game, game.awayTeamId);
  const reasons = scored.map(([reason]) => reason);
  const notability = combineNotability(scored.map(([, score]) => score));

  const attachment: GameAttachment = {
    type: "game",
    gameId: game.id,
    date: game.date,
    competitionType: game.competitionType,
    home,
    away,
    score: { ...game.score },
    periodScores: game.periodScores.map((period) => ({ ...period })),
    overtimePeriods,
    winnerTeamId,
    margin,
    reasons,
    comebackDeficit,
    winPctBefore: { home: homePct, away: awayPct },
    topPerformers: { home: topHome, away: topAway },
    series: input.series.byGameId.get(game.id) ?? null,
  };

  return {
    id: `game:${game.id}`,
    occurredOn: game.date,
    kind: "game",
    importance:
      game.competitionType === "playoffs" || notability >= 70
        ? "high"
        : "medium",
    notability,
    relevance: 0,
    teamIds: [game.homeTeamId, game.awayTeamId],
    playerIds: [topHome, topAway]
      .filter((p): p is TimelinePerformer => p !== null)
      .map((p) => p.player.playerId),
    gameId: game.id,
    attachment,
    tags: [teamTagLabel(home), teamTagLabel(away)],
    unread: false,
  };
}

/** Largest deficit the eventual winner faced at the end of any period. */
export function largestWinnerDeficit(
  periodScores: readonly GameScore[],
  homeWon: boolean,
): number {
  let home = 0;
  let away = 0;
  let deficit = 0;
  for (const period of periodScores) {
    home += period.home;
    away += period.away;
    const behind = homeWon ? away - home : home - away;
    if (behind > deficit) deficit = behind;
  }
  return deficit;
}

function isUpset(
  record: {
    home: { wins: number; losses: number };
    away: { wins: number; losses: number };
  },
  homeWon: boolean,
): boolean {
  const homeGames = record.home.wins + record.home.losses;
  const awayGames = record.away.wins + record.away.losses;
  if (
    homeGames < GAME_THRESHOLDS.upsetMinGames ||
    awayGames < GAME_THRESHOLDS.upsetMinGames
  ) {
    return false;
  }
  const homePct = record.home.wins / homeGames;
  const awayPct = record.away.wins / awayGames;
  const gap = homeWon ? awayPct - homePct : homePct - awayPct;
  return gap >= GAME_THRESHOLDS.upsetWinPctGap - 1e-9;
}

function topPerformer(
  input: DetectorInput,
  game: Game,
  teamId: string,
): TimelinePerformer | null {
  let best: GamePlayerStats | null = null;
  for (const row of game.playerStats) {
    if (row.teamId !== teamId) continue;
    if (!best || comparePerformers(row, best) < 0) best = row;
  }
  if (!best) return null;
  const player = input.refs.player(best.playerId, best);
  return player ? { player, line: toStatLine(best) } : null;
}

function comparePerformers(a: GamePlayerStats, b: GamePlayerStats): number {
  return (
    b.points - a.points ||
    b.rebounds + b.assists - (a.rebounds + a.assists) ||
    a.playerId.localeCompare(b.playerId)
  );
}
