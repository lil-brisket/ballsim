/**
 * Season recap: one season of the owner's franchise in a few facts, built
 * from the annual franchise report, the franchise history, the final games
 * and the stored awards and player history. Pure and deterministic; never
 * mutates state.
 */

import type {
  AnnualFranchiseReport,
  TrajectoryArrow,
  YoYMetric,
} from "@/domain/entities/annual-franchise-report";
import type { PlayoffResultSnapshot } from "@/domain/entities/franchise-history";
import type { Game } from "@/domain/entities/game";
import type { PlayerPortraitAssignment } from "@/domain/entities/player-portrait";
import { getFinalGamesForSeason } from "@/state/game-access";
import type { GameState } from "@/state/game-state";
import { toAwardsNightView } from "@/state/awards-night-selectors";
import { getActiveOwnerTeamId } from "@/state/owner-context";
import { getPlayerIdentity } from "@/state/player-identity";
import { selectPlayerPortrait } from "@/state/player-portrait-selectors";
import { getCachedAnnualReport } from "@/systems/franchise-report/generate-annual-report";

export type SeasonRecapGame = {
  gameId: string;
  date: string;
  playoff: boolean;
  home: boolean;
  opponentAbbreviation: string;
  opponentName: string;
  teamScore: number;
  opponentScore: number;
  margin: number;
  overtimes: number;
};

export type SeasonRecapBestPlayer = {
  playerId: string;
  name: string;
  position: string | null;
  portrait: PlayerPortraitAssignment | null;
  games: number;
  /** Per game, one decimal. */
  points: number;
  rebounds: number;
  assists: number;
};

export type SeasonRecapView = {
  seasonYear: number;
  teamId: string;
  teamName: string;
  wins: number;
  losses: number;
  leagueRank: number | null;
  /** Playoff seed, only while that season's bracket is still loaded; else null. */
  seed: number | null;
  playoffResult: PlayoffResultSnapshot;
  playoffLabel: string;
  championship: boolean;
  /** Up to 3 of the team's wins: overtime first, then margin. */
  bestGames: SeasonRecapGame[];
  awardWinners: Array<{ awardName: string; winnerName: string }>;
  bestPlayer: SeasonRecapBestPlayer | null;
  finances: { netIncome: YoYMetric; endingCash: YoYMetric };
  trajectory: {
    competitive: TrajectoryArrow;
    financial: TrajectoryArrow;
    brand: TrajectoryArrow;
  };
  /** Report exists for the current season and the phase is offseason. */
  isCurrent: boolean;
};

const BEST_GAMES = 3;
const REGULATION_PERIODS = 4;

const PLAYOFF_LABELS: Record<PlayoffResultSnapshot, string> = {
  missed: "Missed the playoffs",
  first_round: "Lost in the first round",
  second_round: "Lost in the second round",
  conference_finals: "Lost in the conference finals",
  finals: "Lost in the Finals",
  champion: "Won the title",
};

type PlayerLine = {
  games: number;
  points: number;
  rebounds: number;
  assists: number;
};

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function oneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Years that have a recap for the team, newest first. */
export function listRecapSeasons(state: GameState, teamId?: string): number[] {
  const byTeam =
    state.business.franchiseReportCache?.[
      teamId ?? getActiveOwnerTeamId(state)
    ];
  if (!byTeam) return [];
  return Object.values(byTeam)
    .map((report) => report.seasonYear)
    .sort((a, b) => b - a);
}

function toRecapGame(
  state: GameState,
  game: Game,
  teamId: string,
): SeasonRecapGame | null {
  const home = game.homeTeamId === teamId;
  if (!home && game.awayTeamId !== teamId) return null;
  const teamScore = home ? game.score.home : game.score.away;
  const opponentScore = home ? game.score.away : game.score.home;
  if (teamScore <= opponentScore) return null;
  const opponentId = home ? game.awayTeamId : game.homeTeamId;
  const snapshot = home ? game.awayTeamSnapshot : game.homeTeamSnapshot;
  const opponent = state.world.teams[opponentId];
  return {
    gameId: game.id,
    date: game.date,
    playoff: game.competitionType === "playoffs",
    home,
    opponentAbbreviation:
      snapshot?.abbreviation ?? opponent?.abbreviation ?? String(opponentId),
    opponentName: snapshot
      ? `${snapshot.city} ${snapshot.name}`
      : opponent
        ? `${opponent.city} ${opponent.name}`
        : String(opponentId),
    teamScore,
    opponentScore,
    margin: teamScore - opponentScore,
    overtimes: Math.max(0, game.periodScores.length - REGULATION_PERIODS),
  };
}

function selectBestGames(
  state: GameState,
  teamId: string,
  seasonYear: number,
): SeasonRecapGame[] {
  const season = state.business.franchiseHistory[teamId]?.seasons.find(
    (record) => record.seasonYear === seasonYear,
  );
  if (!season) return [];
  const wins: SeasonRecapGame[] = [];
  for (const game of getFinalGamesForSeason(state, season.seasonId)) {
    if (
      game.competitionType !== "regular_season" &&
      game.competitionType !== "playoffs"
    ) {
      continue;
    }
    const recap = toRecapGame(state, game, teamId);
    if (recap) wins.push(recap);
  }
  wins.sort(
    (a, b) =>
      b.overtimes - a.overtimes ||
      b.margin - a.margin ||
      Number(b.playoff) - Number(a.playoff) ||
      compareText(a.date, b.date) ||
      compareText(a.gameId, b.gameId),
  );
  return wins.slice(0, BEST_GAMES);
}

function selectBestPlayer(
  state: GameState,
  teamId: string,
  seasonYear: number,
): SeasonRecapBestPlayer | null {
  let best: { playerId: string; overall: number; line: PlayerLine } | null =
    null;
  for (const [playerId, history] of Object.entries(
    state.business.playerHistory,
  )) {
    const record = history.seasons.find(
      (season) =>
        season.seasonYear === seasonYear &&
        season.contractSnapshot.teamId === teamId,
    );
    if (!record) continue;
    const line = record.competition.regular;
    if (line.games <= 0) continue;
    if (
      best === null ||
      record.overall > best.overall ||
      (record.overall === best.overall &&
        compareText(playerId, best.playerId) < 0)
    ) {
      best = { playerId, overall: record.overall, line };
    }
  }
  if (!best) return null;
  const identity = getPlayerIdentity(state, best.playerId);
  const { line } = best;
  return {
    playerId: best.playerId,
    name: identity?.displayName ?? best.playerId,
    position: identity?.position ?? null,
    portrait: selectPlayerPortrait(state, best.playerId),
    games: line.games,
    points: oneDecimal(line.points / line.games),
    rebounds: oneDecimal(line.rebounds / line.games),
    assists: oneDecimal(line.assists / line.games),
  };
}

/** Null when the team has no annual report for the season. */
export function toSeasonRecapView(
  state: GameState,
  seasonYear?: number,
  teamId?: string,
): SeasonRecapView | null {
  const resolvedTeamId = teamId ?? getActiveOwnerTeamId(state);
  const team = state.world.teams[resolvedTeamId];
  if (!team) return null;
  const year = seasonYear ?? listRecapSeasons(state, resolvedTeamId)[0];
  if (year === undefined) return null;
  const report: AnnualFranchiseReport | null = getCachedAnnualReport(
    state,
    resolvedTeamId as AnnualFranchiseReport["teamId"],
    year,
  );
  if (!report) return null;

  const season = state.competition.season;
  const bracketLoaded = year === season.year;
  const seed = bracketLoaded
    ? (state.competition.playoffs.qualifiedTeams.find(
        (entry) => entry.teamId === resolvedTeamId,
      )?.seed ?? null)
    : null;
  const awards = toAwardsNightView(state, year);
  const { competitive, financial, franchiseTrajectory } = report;

  return {
    seasonYear: year,
    teamId: resolvedTeamId,
    teamName: `${team.city} ${team.name}`,
    wins: competitive.wins,
    losses: competitive.losses,
    leagueRank: competitive.leagueRank,
    seed,
    playoffResult: competitive.playoffResult,
    playoffLabel: PLAYOFF_LABELS[competitive.playoffResult],
    championship: competitive.championship,
    bestGames: selectBestGames(state, resolvedTeamId, year),
    awardWinners: (awards?.awards ?? [])
      .filter((award) => award.userWon)
      .map((award) => ({
        awardName: award.displayName,
        winnerName: award.winner.name,
      })),
    bestPlayer: selectBestPlayer(state, resolvedTeamId, year),
    finances: {
      netIncome: financial.netIncome,
      endingCash: financial.endingCash,
    },
    trajectory: {
      competitive: franchiseTrajectory.competitive,
      financial: franchiseTrajectory.financial,
      brand: franchiseTrajectory.brand,
    },
    isCurrent: bracketLoaded && season.phase === "offseason",
  };
}
