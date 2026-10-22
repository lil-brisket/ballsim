import type { Player } from "@/domain/entities/player";
import type { Team } from "@/domain/entities/team";
import type { PlayerId } from "@/domain/ids";
import { isJerseyNumber, preferredJerseyNumber } from "@/domain/jersey-number";
import { DEFAULT_PARTICIPATION_STATE } from "@/domain/participation";
import type { GameState } from "@/state/game-state";
import { reconcileJerseyNumbers } from "@/systems/jersey-numbers";
import type { TeamPlayStyle } from "@/persistence/mappers/game-state-migrations/legacy-team-play-style";

export type GameStateV66 = Omit<GameState, "meta" | "user" | "competition"> & {
  meta: Omit<GameState["meta"], "schemaVersion"> & { schemaVersion: 66 };
  user: Omit<GameState["user"], "participation">;
  competition: Omit<GameState["competition"], "aiTradeSearch">;
};

export type GameStateV67 = Omit<GameStateV68, "meta" | "competition"> & {
  meta: Omit<GameState["meta"], "schemaVersion"> & { schemaVersion: 67 };
  competition: Omit<GameState["competition"], "aiTradeSearch">;
};

export type GameStateV68 = Omit<GameState, "meta" | "world"> & {
  meta: Omit<GameState["meta"], "schemaVersion"> & { schemaVersion: 68 };
  world: Omit<GameState["world"], "players"> & {
    players: Record<PlayerId, Omit<Player, "jerseyNumber">>;
  };
};

export type GameStateV69 = Omit<GameState, "meta" | "world"> & {
  meta: Omit<GameState["meta"], "schemaVersion"> & { schemaVersion: 69 };
  world: Omit<GameState["world"], "teams"> & {
    teams: Record<string, Team & { playStyle?: TeamPlayStyle }>;
  };
};

/**
 * Deterministic v66 → v67: add user.participation. Every pre-existing save is
 * single-player, so all owned teams stay with the one human owner.
 */
export function migrateV66ToV67(state: GameStateV66): GameStateV67 {
  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 67,
    },
    user: {
      ...state.user,
      participation: { ...DEFAULT_PARTICIPATION_STATE },
    },
  };
}

/**
 * Deterministic v67 → v68: add competition.aiTradeSearch. Empty memory means
 * every CPU team runs its trade search on the next day, exactly as before.
 */
export function migrateV67ToV68(state: GameStateV67): GameStateV68 {
  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 68,
    },
    competition: {
      ...state.competition,
      aiTradeSearch: { byTeamId: {} },
    },
  };
}

/**
 * Deterministic v68 → v69: add Player.jerseyNumber. Every player gets his
 * preferred number (from his id, no RNG), then duplicates within a franchise
 * are resolved: the longest-serving player keeps the number.
 */
export function migrateV68ToV69(state: GameStateV68): GameStateV69 {
  const players: Record<PlayerId, Player> = {};
  for (const [id, player] of Object.entries(state.world.players)) {
    players[id as PlayerId] = {
      ...player,
      // Keep a valid number if one is somehow present; otherwise prefer.
      jerseyNumber: isJerseyNumber((player as Partial<Player>).jerseyNumber)
        ? (player as Player).jerseyNumber
        : preferredJerseyNumber(player.id),
    };
  }
  const migrated = reconcileJerseyNumbers({
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 69,
    },
    world: {
      ...state.world,
      players,
    },
  } as unknown as GameState);
  return migrated as unknown as GameStateV69;
}

/**
 * Deterministic v69 → v70: drop Team.playStyle. It was generated and stored
 * but never read; Team.coachingPhilosophy carries team style.
 */
export function migrateV69ToV70(state: GameStateV69): GameState {
  const teams: Record<string, Team> = {};
  for (const [id, team] of Object.entries(state.world.teams)) {
    const { playStyle: _playStyle, ...rest } = team;
    teams[id] = rest;
  }
  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 70,
    },
    world: {
      ...state.world,
      teams,
    },
  };
}
