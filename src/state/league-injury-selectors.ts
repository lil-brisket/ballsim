/**
 * League-wide notable injuries — presentation scan of world.players.
 * Does not mutate state.
 */

import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { InjurySeverity } from "@/domain/entities/injury";
import type { GameState } from "@/state/game-state";

export type LeagueInjuryRow = {
  playerId: string;
  playerName: string;
  teamId: string | null;
  teamAbbreviation: string | null;
  severity: InjurySeverity;
  bodyPart: string;
  injuredOn: string;
  overall: number;
  gameRestriction: string;
};

const SEVERITY_RANK: Record<InjurySeverity, number> = {
  severe: 4,
  major: 3,
  moderate: 2,
  minor: 1,
};

/**
 * Notable current injuries across the league, prioritized by severity then overall.
 */
export function toLeagueInjuryBriefing(
  state: GameState,
  limit = 5,
): LeagueInjuryRow[] {
  const rows: LeagueInjuryRow[] = [];

  for (const player of Object.values(state.world.players)) {
    const injuries = player.activeInjuries ?? [];
    if (injuries.length === 0) {
      continue;
    }
    // Most severe active injury
    let best = injuries[0]!;
    for (const injury of injuries) {
      if (
        SEVERITY_RANK[injury.severity] > SEVERITY_RANK[best.severity]
      ) {
        best = injury;
      }
    }
    const teamId = player.teamId ?? null;
    const team = teamId ? state.world.teams[teamId] : null;
    rows.push({
      playerId: player.id,
      playerName: `${player.firstName} ${player.lastName}`,
      teamId,
      teamAbbreviation: team?.abbreviation ?? null,
      severity: best.severity,
      bodyPart: best.bodyPart,
      injuredOn: best.injuredOn,
      overall: calculatePlayerOverall(player.position, player.attributes),
      gameRestriction: best.gameRestriction,
    });
  }

  rows.sort((a, b) => {
    const sev = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    if (sev !== 0) {
      return sev;
    }
    if (b.overall !== a.overall) {
      return b.overall - a.overall;
    }
    return b.injuredOn.localeCompare(a.injuredOn);
  });

  return rows.slice(0, limit);
}
