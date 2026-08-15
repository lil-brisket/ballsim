import type { PlayoffSeed } from "@/domain/entities/playoffs";
import type { TeamStanding } from "@/domain/entities/standings";
import type { TeamId } from "@/domain/ids";
import { compareStandings } from "@/systems/standings";

/**
 * Qualifies the top N teams from final regular-season standings (league-wide)
 * and assigns seeds 1..N in standings order.
 * Conferences do not drive qualification or seeding.
 */
export function qualifyAndSeed(
  standings: readonly TeamStanding[],
  playoffTeams: number,
): PlayoffSeed[] {
  if (
    !Number.isInteger(playoffTeams) ||
    playoffTeams < 1
  ) {
    throw new Error(
      `qualifyAndSeed playoffTeams must be a positive integer; got ${playoffTeams}.`,
    );
  }
  if (standings.length < playoffTeams) {
    throw new Error(
      `qualifyAndSeed needs at least ${playoffTeams} standing rows; found ${standings.length}.`,
    );
  }

  const ranked = [...standings].sort(compareStandings);
  const qualified: PlayoffSeed[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < playoffTeams; index += 1) {
    const row = ranked[index]!;
    if (seen.has(row.teamId)) {
      throw new Error(
        `qualifyAndSeed found duplicate teamId ${row.teamId} in standings.`,
      );
    }
    seen.add(row.teamId);
    qualified.push({
      teamId: row.teamId as TeamId,
      seed: index + 1,
    });
  }

  return qualified;
}

/**
 * Play-in: auto-qualify seeds 1..N-2; bubble single games assign seeds N-1 and N.
 * Game A: rank N-1 vs N+2 → winner is seed N-1
 * Game B: rank N vs N+1 → winner is seed N
 * Losers are eliminated.
 */
export function applyPlayInResults(
  standings: readonly TeamStanding[],
  playoffTeams: number,
  gameAWinnerTeamId: TeamId,
  gameBWinnerTeamId: TeamId,
): PlayoffSeed[] {
  const ranked = [...standings].sort(compareStandings);
  if (ranked.length < playoffTeams + 2) {
    throw new Error(
      `applyPlayInResults needs at least ${playoffTeams + 2} standing rows.`,
    );
  }

  const autoCount = playoffTeams - 2;
  const bubble = {
    nMinus1: ranked[playoffTeams - 2]!.teamId as TeamId,
    n: ranked[playoffTeams - 1]!.teamId as TeamId,
    nPlus1: ranked[playoffTeams]!.teamId as TeamId,
    nPlus2: ranked[playoffTeams + 1]!.teamId as TeamId,
  };

  const gameAParticipants = new Set([bubble.nMinus1, bubble.nPlus2]);
  const gameBParticipants = new Set([bubble.n, bubble.nPlus1]);
  if (!gameAParticipants.has(gameAWinnerTeamId)) {
    throw new Error(
      `applyPlayInResults game A winner must be ${bubble.nMinus1} or ${bubble.nPlus2}.`,
    );
  }
  if (!gameBParticipants.has(gameBWinnerTeamId)) {
    throw new Error(
      `applyPlayInResults game B winner must be ${bubble.n} or ${bubble.nPlus1}.`,
    );
  }

  const qualified: PlayoffSeed[] = [];
  for (let index = 0; index < autoCount; index += 1) {
    qualified.push({
      teamId: ranked[index]!.teamId as TeamId,
      seed: index + 1,
    });
  }
  qualified.push({ teamId: gameAWinnerTeamId, seed: playoffTeams - 1 });
  qualified.push({ teamId: gameBWinnerTeamId, seed: playoffTeams });
  return qualified;
}

/** Bubble matchup pairs for play-in (better record hosts). */
export function playInMatchups(
  standings: readonly TeamStanding[],
  playoffTeams: number,
): {
  gameA: { homeTeamId: TeamId; awayTeamId: TeamId };
  gameB: { homeTeamId: TeamId; awayTeamId: TeamId };
} {
  const ranked = [...standings].sort(compareStandings);
  if (ranked.length < playoffTeams + 2) {
    throw new Error(
      `playInMatchups needs at least ${playoffTeams + 2} standing rows.`,
    );
  }
  const nMinus1 = ranked[playoffTeams - 2]!.teamId as TeamId;
  const n = ranked[playoffTeams - 1]!.teamId as TeamId;
  const nPlus1 = ranked[playoffTeams]!.teamId as TeamId;
  const nPlus2 = ranked[playoffTeams + 1]!.teamId as TeamId;
  return {
    gameA: { homeTeamId: nMinus1, awayTeamId: nPlus2 },
    gameB: { homeTeamId: n, awayTeamId: nPlus1 },
  };
}
