import type { PlayoffSeed } from "@/domain/entities/playoffs";
import type { TeamStanding } from "@/domain/entities/standings";
import type { TeamId } from "@/domain/ids";
import { getPlayoffTeamCount } from "@/systems/playoff-config";
import { compareStandings } from "@/systems/standings";

/**
 * Qualifies the top N teams from final regular-season standings and assigns
 * seeds 1..N in standings order. N = getPlayoffTeamCount(teamCount).
 */
export function qualifyAndSeed(
  standings: readonly TeamStanding[],
  teamCount: number,
): PlayoffSeed[] {
  const fieldSize = getPlayoffTeamCount(teamCount);
  if (fieldSize === 0) {
    throw new Error(
      `qualifyAndSeed requires at least 8 teams for playoffs; teamCount=${teamCount}.`,
    );
  }
  if (standings.length < fieldSize) {
    throw new Error(
      `qualifyAndSeed needs at least ${fieldSize} standing rows; found ${standings.length}.`,
    );
  }

  const ranked = [...standings].sort(compareStandings);
  const qualified: PlayoffSeed[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < fieldSize; index += 1) {
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
