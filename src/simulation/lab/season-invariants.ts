/**
 * Season-level Lab invariants over final regular-season games.
 *
 * These catch degenerate rosters/rotations that per-game checks cannot see:
 * a whole team scoring far below the league (9-73 team at 73.7 PPG vs a ~106
 * league), or one scorer far above the league's top-scorer distribution (a
 * 31 PPG player when everyone else in the top 10 is under 19). Minutes
 * conservation is checked per game so a short or mis-allocated rotation cannot
 * silently drop minutes.
 *
 * Pure functions over minimal row types so both `Game` (league state) and
 * `GameResult` (Lab) feed them without conversion.
 */
import type { RawInvariantFailure } from "@/simulation/lab/types";
import { GAME_SIMULATION_CONFIG } from "@/systems/game-simulation-config";
import { ROTATION_CONFIG } from "@/systems/rotation/rotation-config";

export type SeasonPlayerRow = {
  playerId: string;
  teamId: string | null;
  minutes: number;
  points: number;
};

export type SeasonGameRow = {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  score: { home: number; away: number };
  periodScores: readonly unknown[];
  playerStats: readonly SeasonPlayerRow[];
};

export const SEASON_INVARIANT_BANDS = {
  /** Teams with fewer games than this are not judged. */
  minTeamGames: 20,
  /** Whole-league sanity: no team's season PPG outside this range. */
  teamPpgAbsolute: { min: 70, max: 135 },
  /** Max |team PPG - league PPG| over a season. */
  teamPpgFromLeagueMean: 15,
  /** Players need at least this many games and minutes to be ranked. */
  minPlayerGames: 20,
  minPlayerMpg: 12,
  /** Scorer #1 may not exceed this multiple of the mean of scorers #2-#6. */
  topScorerRatio: 1.35,
  /** Ranks (1-based, inclusive) forming the reference top-scorer pack. */
  topScorerReferenceRanks: { from: 2, to: 6 },
  /** No player averages more than this, whatever the pack looks like. */
  playerPpgAbsoluteMax: 40,
  /** Allowed |sum(team minutes) - expected| per game. */
  minutesTolerance: 1,
} as const;

export type SeasonInvariantBands = typeof SEASON_INVARIANT_BANDS;

/** Expected total player-minutes for one team in a game with `ot` overtimes. */
export function expectedTeamMinutes(overtimePeriods: number): number {
  return (
    ROTATION_CONFIG.regulationPlayerMinutes +
    overtimePeriods *
      ROTATION_CONFIG.overtimePeriodMinutes *
      ROTATION_CONFIG.playersOnCourt
  );
}

function overtimePeriodsOf(game: SeasonGameRow): number {
  return Math.max(
    0,
    game.periodScores.length - GAME_SIMULATION_CONFIG.regulationPeriodCount,
  );
}

export function checkTeamPpg(
  games: readonly SeasonGameRow[],
  bands: SeasonInvariantBands = SEASON_INVARIANT_BANDS,
): RawInvariantFailure[] {
  const byTeam = new Map<string, { points: number; games: number }>();
  let leaguePoints = 0;
  let leagueTeamGames = 0;
  for (const game of games) {
    for (const [teamId, points] of [
      [game.homeTeamId, game.score.home],
      [game.awayTeamId, game.score.away],
    ] as const) {
      const row = byTeam.get(teamId) ?? { points: 0, games: 0 };
      row.points += points;
      row.games += 1;
      byTeam.set(teamId, row);
      leaguePoints += points;
      leagueTeamGames += 1;
    }
  }
  if (leagueTeamGames === 0) {
    return [];
  }
  const leagueMean = leaguePoints / leagueTeamGames;
  const failures: RawInvariantFailure[] = [];
  for (const [teamId, row] of [...byTeam].sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  )) {
    if (row.games < bands.minTeamGames) {
      continue;
    }
    const ppg = row.points / row.games;
    const outside =
      ppg < bands.teamPpgAbsolute.min || ppg > bands.teamPpgAbsolute.max;
    const far = Math.abs(ppg - leagueMean) > bands.teamPpgFromLeagueMean;
    if (outside || far) {
      failures.push({
        rule: "TEAM_PPG_OUT_OF_RANGE",
        detail: `team ${teamId} averaged ${ppg.toFixed(1)} PPG over ${row.games} games; league mean ${leagueMean.toFixed(1)} (allowed ${bands.teamPpgAbsolute.min}-${bands.teamPpgAbsolute.max} and within ${bands.teamPpgFromLeagueMean} of the league)`,
        context: { teamId, ppg, games: row.games, leagueMean },
      });
    }
  }
  return failures;
}

export function checkPlayerPpg(
  games: readonly SeasonGameRow[],
  bands: SeasonInvariantBands = SEASON_INVARIANT_BANDS,
): RawInvariantFailure[] {
  const byPlayer = new Map<
    string,
    { points: number; minutes: number; games: number; teamId: string | null }
  >();
  for (const game of games) {
    for (const row of game.playerStats) {
      if (row.minutes <= 0) {
        continue;
      }
      const acc = byPlayer.get(row.playerId) ?? {
        points: 0,
        minutes: 0,
        games: 0,
        teamId: row.teamId,
      };
      acc.points += row.points;
      acc.minutes += row.minutes;
      acc.games += 1;
      byPlayer.set(row.playerId, acc);
    }
  }
  const ranked = [...byPlayer]
    .filter(
      ([, acc]) =>
        acc.games >= bands.minPlayerGames &&
        acc.minutes / acc.games >= bands.minPlayerMpg,
    )
    .map(([playerId, acc]) => ({
      playerId,
      teamId: acc.teamId,
      ppg: acc.points / acc.games,
      games: acc.games,
    }))
    .sort((a, b) => b.ppg - a.ppg || (a.playerId < b.playerId ? -1 : 1));
  const top = ranked[0];
  if (top == null) {
    return [];
  }
  const failures: RawInvariantFailure[] = [];
  if (top.ppg > bands.playerPpgAbsoluteMax) {
    failures.push({
      rule: "PLAYER_PPG_OUTLIER",
      detail: `player ${top.playerId} averaged ${top.ppg.toFixed(1)} PPG, above the absolute cap ${bands.playerPpgAbsoluteMax}`,
      context: { playerId: top.playerId, teamId: top.teamId, ppg: top.ppg },
    });
    return failures;
  }
  const { from, to } = bands.topScorerReferenceRanks;
  const pack = ranked.slice(from - 1, to);
  if (pack.length === to - from + 1) {
    const packMean = pack.reduce((sum, row) => sum + row.ppg, 0) / pack.length;
    if (top.ppg > packMean * bands.topScorerRatio) {
      failures.push({
        rule: "PLAYER_PPG_OUTLIER",
        detail: `player ${top.playerId} averaged ${top.ppg.toFixed(1)} PPG, above ${bands.topScorerRatio}x the #${from}-#${to} scorers' mean (${packMean.toFixed(1)})`,
        context: {
          playerId: top.playerId,
          teamId: top.teamId,
          ppg: top.ppg,
          packMean,
        },
      });
    }
  }
  return failures;
}

export function checkMinutesConservation(
  games: readonly SeasonGameRow[],
  bands: SeasonInvariantBands = SEASON_INVARIANT_BANDS,
): RawInvariantFailure[] {
  const failures: RawInvariantFailure[] = [];
  for (const game of games) {
    const expected = expectedTeamMinutes(overtimePeriodsOf(game));
    const totals = new Map<string, number>([
      [game.homeTeamId, 0],
      [game.awayTeamId, 0],
    ]);
    for (const row of game.playerStats) {
      if (row.teamId != null && totals.has(row.teamId)) {
        totals.set(row.teamId, (totals.get(row.teamId) ?? 0) + row.minutes);
      }
    }
    for (const [teamId, total] of totals) {
      if (Math.abs(total - expected) > bands.minutesTolerance) {
        failures.push({
          rule: "MINUTES_NOT_CONSERVED",
          detail: `game ${game.id}: ${teamId} player minutes sum to ${total}, expected ${expected}`,
          context: { gameId: game.id, teamId, total, expected },
        });
      }
    }
  }
  return failures;
}

export function evaluateSeasonInvariants(
  games: readonly SeasonGameRow[],
  bands: SeasonInvariantBands = SEASON_INVARIANT_BANDS,
): RawInvariantFailure[] {
  return [
    ...checkTeamPpg(games, bands),
    ...checkPlayerPpg(games, bands),
    ...checkMinutesConservation(games, bands),
  ];
}
