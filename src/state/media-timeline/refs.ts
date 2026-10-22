import type { GamePlayerStats, GameTeamSnapshot } from "@/domain/entities/game";
import type { GameState } from "@/state/game-state";
import type {
  TimelinePlayerRef,
  TimelineStatLine,
  TimelineTeamRef,
} from "./types";

/** Per-build lookup cache for team and player display refs. */
export type RefResolver = {
  team(teamId: string, snapshot?: GameTeamSnapshot | null): TimelineTeamRef;
  player(playerId: string, row?: GamePlayerStats): TimelinePlayerRef | null;
};

export function createRefResolver(state: GameState): RefResolver {
  const teams = new Map<string, TimelineTeamRef>();
  return {
    team(teamId, snapshot) {
      // Snapshots keep the name the team had on game night (relocations).
      if (snapshot) {
        return {
          teamId,
          abbreviation: snapshot.abbreviation,
          displayName: `${snapshot.city} ${snapshot.name}`,
          name: snapshot.name,
          branding: snapshot.branding,
        };
      }
      const cached = teams.get(teamId);
      if (cached) return cached;
      const team = state.world.teams[teamId];
      const ref: TimelineTeamRef = team
        ? {
            teamId,
            abbreviation: team.abbreviation,
            displayName: `${team.city} ${team.name}`,
            name: team.name,
            branding: team.branding,
          }
        : {
            teamId,
            abbreviation: teamId.slice(0, 3).toUpperCase(),
            displayName: teamId,
            name: teamId,
            branding: null,
          };
      teams.set(teamId, ref);
      return ref;
    },
    player(playerId, row) {
      if (row?.firstName && row.lastName) {
        return {
          playerId,
          firstName: row.firstName,
          lastName: row.lastName,
          teamId: row.teamId,
        };
      }
      const player = state.world.players[playerId];
      if (!player) return null;
      return {
        playerId,
        firstName: player.firstName,
        lastName: player.lastName,
        teamId: row?.teamId ?? player.teamId,
      };
    },
  };
}

export function toStatLine(row: GamePlayerStats): TimelineStatLine {
  return {
    minutes: row.minutes,
    points: row.points,
    rebounds: row.rebounds,
    assists: row.assists,
    steals: row.steals,
    blocks: row.blocks,
    fieldGoalsMade: row.fieldGoalsMade,
    fieldGoalsAttempted: row.fieldGoalsAttempted,
    threePointersMade: row.threePointersMade,
    threePointersAttempted: row.threePointersAttempted,
  };
}
