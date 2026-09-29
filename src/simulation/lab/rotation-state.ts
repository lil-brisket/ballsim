import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createPlayer, type Player } from "@/domain/entities/player";
import { asPlayerId, asTeamId, type TeamId } from "@/domain/ids";
import { normalizeSeed } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import type { GameState } from "@/state/game-state";
import {
  recommendRosterManagement,
  withTeamRosterManagement,
} from "@/systems/roster-management";

export type LabRotationSetup = {
  state: GameState;
  homeTeamId: TeamId;
  awayTeamId: TeamId;
  homePlayers: Player[];
  awayPlayers: Player[];
  homeStarters: Player[];
  awayStarters: Player[];
};

function clonePlayerToTeam(player: Player, teamId: TeamId): Player {
  return createPlayer({
    ...player,
    id: asPlayerId(player.id),
    teamId,
    attributes: { ...player.attributes },
    potential: { ...player.potential },
    personality: { ...player.personality },
    development: { ...player.development },
    physical: { ...player.physical },
    activeInjuries: player.activeInjuries.map((injury) => ({ ...injury })),
    injuryHistory: player.injuryHistory.map((entry) => ({ ...entry })),
  });
}

/**
 * Injects Lab-generated rosters onto two existing CBL teams and builds
 * rotation management so simulateGame substitutions can run.
 */
export function buildLabRotationState(
  homeSource: readonly Player[],
  awaySource: readonly Player[],
  seed: number | string,
): LabRotationSetup {
  let state = createInitialGameState({
    saveId: "lab_rotation",
    rngSeed: normalizeSeed(seed),
    nowIso: "2026-08-13T12:00:00.000Z",
    settings: CBL_GAME_SETTINGS,
  });
  const teamIds = Object.keys(state.world.teams).sort();
  if (teamIds.length < 2) {
    throw new Error("buildLabRotationState requires at least two teams.");
  }
  const homeTeamId = asTeamId(teamIds[0]!);
  const awayTeamId = asTeamId(teamIds[1]!);

  const homePlayers = homeSource.map((player) =>
    clonePlayerToTeam(player, homeTeamId),
  );
  const awayPlayers = awaySource.map((player) =>
    clonePlayerToTeam(player, awayTeamId),
  );

  const players = { ...state.world.players };
  for (const player of [...homePlayers, ...awayPlayers]) {
    players[player.id] = player;
  }

  state = {
    ...state,
    world: {
      ...state.world,
      players,
      teams: {
        ...state.world.teams,
        [homeTeamId]: {
          ...state.world.teams[homeTeamId]!,
          roster: homePlayers.map((player) => player.id),
        },
        [awayTeamId]: {
          ...state.world.teams[awayTeamId]!,
          roster: awayPlayers.map((player) => player.id),
        },
      },
    },
  };

  const homeMgmt = recommendRosterManagement(state, homeTeamId, {
    rotationPreset: "balanced",
    configuredBy: "ai",
  });
  const awayMgmt = recommendRosterManagement(state, awayTeamId, {
    rotationPreset: "balanced",
    configuredBy: "ai",
  });
  state = withTeamRosterManagement(state, homeTeamId, homeMgmt);
  state = withTeamRosterManagement(state, awayTeamId, awayMgmt);

  const homeStarters = homeMgmt.startingLineup.map(
    (slot) => state.world.players[slot.playerId]!,
  );
  const awayStarters = awayMgmt.startingLineup.map(
    (slot) => state.world.players[slot.playerId]!,
  );

  return {
    state,
    homeTeamId,
    awayTeamId,
    homePlayers,
    awayPlayers,
    homeStarters,
    awayStarters,
  };
}
