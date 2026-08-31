/**
 * Season-transition DL bookkeeping: season counting, graduation tasks, flag reset.
 */

import {
  createDefaultDevelopmentLeagueProfile,
  DL_MAX_SEASONS,
} from "@/domain/entities/development-league";
import { createPlayer, type Player } from "@/domain/entities/player";
import { createDomainEvent, type DomainEvent } from "@/domain/events";
import type { TeamId } from "@/domain/ids";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { archiveCompletedSeasonGames } from "@/systems/player-history";
import {
  getTopLeagueRosterSize,
  isPlayerDlAssigned,
} from "@/systems/development-league/franchise-membership";
import { recallPlayerFromDevelopmentLeague } from "@/systems/development-league/assignment";
import { TRADE_ROSTER_RULES } from "@/systems/trades-config";
import { isUserControlledTeam } from "@/state/owner-context";

export type GraduationPending = {
  playerId: string;
  teamId: TeamId;
  playerName: string;
  seasonsUsed: number;
  rosterFull: boolean;
};

/**
 * Count DL seasons, reset seasonal flags, mark graduates ineligible.
 * Does NOT blindly auto-recall when roster is full.
 */
export function processDevelopmentLeagueSeasonTransition(
  state: GameState,
): SystemResult & { graduationsPending: GraduationPending[] } {
  const events: DomainEvent[] = [];
  const graduationsPending: GraduationPending[] = [];
  const players: Record<string, Player> = { ...state.world.players };
  let current = state;

  // Archive DL games into gameArchive first
  const dlGames = current.competition.developmentLeague?.games ?? {};
  if (Object.keys(dlGames).length > 0) {
    const withDlInCompetition: GameState = {
      ...current,
      competition: {
        ...current.competition,
        games: {
          ...current.competition.games,
          ...dlGames,
        },
      },
    };
    const archived = archiveCompletedSeasonGames(withDlInCompetition);
    // Keep top-league games as they were; archive already copied finals
    current = {
      ...archived.state,
      competition: {
        ...archived.state.competition,
        games: current.competition.games,
        developmentLeague: current.competition.developmentLeague,
      },
    };
    events.push(...archived.events);
  }

  const playerIds = Object.keys(players).sort();
  for (const playerId of playerIds) {
    const player = players[playerId]!;
    const profile =
      player.developmentLeague ?? createDefaultDevelopmentLeagueProfile();
    let nextProfile = { ...profile };
    let changed = false;

    if (profile.assignedThisSeason) {
      nextProfile = {
        ...nextProfile,
        seasonsUsed: Math.min(DL_MAX_SEASONS, profile.seasonsUsed + 1),
        assignedThisSeason: false,
      };
      changed = true;
    }

    // Always clear seasonal lock at transition
    if (profile.dlAssignmentLockedThisSeason) {
      nextProfile = {
        ...nextProfile,
        dlAssignmentLockedThisSeason: false,
      };
      changed = true;
    }

    if (changed) {
      players[playerId] = createPlayer({
        ...player,
        developmentLeague: nextProfile,
      });
    }
  }

  current = {
    ...current,
    world: {
      ...current.world,
      players,
    },
  };

  // Graduation handling for players at max seasons
  for (const playerId of Object.keys(players).sort()) {
    const player = current.world.players[playerId]!;
    const seasonsUsed = player.developmentLeague?.seasonsUsed ?? 0;
    if (seasonsUsed < DL_MAX_SEASONS) continue;
    if (!isPlayerDlAssigned(player)) continue;
    if (player.teamId == null) continue;

    const teamId = player.teamId;
    const rosterFull =
      getTopLeagueRosterSize(teamId, current) >=
      TRADE_ROSTER_RULES.maxRosterSize;

    if (!isUserControlledTeam(current, teamId) && !rosterFull) {
      const recalled = recallPlayerFromDevelopmentLeague(
        current,
        player.id,
        teamId,
      );
      if (recalled.success) {
        current = recalled.state;
        events.push(...recalled.events);
        events.push(
          createDomainEvent({
            type: "PlayerGraduatedFromDevelopmentLeague",
            occurredOn: current.world.calendar.currentDate,
            payload: {
              playerId: player.id,
              teamId,
              seasonsUsed,
              auto: true,
            },
          }),
        );
      }
    } else {
      graduationsPending.push({
        playerId: player.id,
        teamId,
        playerName: `${player.firstName} ${player.lastName}`,
        seasonsUsed,
        rosterFull,
      });
      events.push(
        createDomainEvent({
          type: "PlayerGraduatedFromDevelopmentLeague",
          occurredOn: current.world.calendar.currentDate,
          payload: {
            playerId: player.id,
            teamId,
            seasonsUsed,
            auto: false,
            rosterFull,
            pending: true,
          },
        }),
      );
    }
  }

  return {
    ...systemResult(current, events),
    graduationsPending,
  };
}
