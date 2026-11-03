import {
  playerCanPlay,
  playsPosition,
  type Player,
  type PlayerPosition,
} from "@/domain/entities/player";
import { asPlayerId } from "@/domain/ids";
import { createSeededRng, deriveSeed, type Rng } from "@/domain/rng";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { listFreeAgents } from "@/systems/free-agency";
import { assignLineupSlots } from "@/systems/lineup-assignment";
import { generatePlayerWithRng } from "@/systems/player-generation";
import { OPENING_FREE_AGENT_QUALITY } from "@/systems/roster-generation-config";
import { PLAYER_POSITIONS } from "@/domain/entities/player";

/**
 * Free agents the league always keeps for each position (a secondary position
 * counts for both of a player's positions). A league never runs out of them:
 * teams fill injury gaps and thin rosters from this pool.
 */
export const FREE_AGENT_POOL_MIN_PER_POSITION = 3;

/**
 * Preseason and regular season only: teams with a position their healthy
 * players cannot fill sign a free agent for it, so the pool also holds one
 * player per such team at that position, whatever the floor.
 */
function isRepairPhase(state: GameState): boolean {
  const phase = state.competition.season.phase;
  return phase === "preseason" || phase === "regular";
}

/** How many teams currently have no healthy player to fill each position. */
function openPositionDemand(state: GameState): Map<PlayerPosition, number> {
  const demand = new Map<PlayerPosition, number>();
  for (const team of Object.values(state.world.teams)) {
    const healthy = team.roster
      .map((id) => state.world.players[id])
      .filter((p): p is Player => p !== undefined && playerCanPlay(p));
    for (const position of assignLineupSlots(healthy).unfilled) {
      demand.set(position, (demand.get(position) ?? 0) + 1);
    }
  }
  return demand;
}

const POOL_ID_PREFIX = "player_fa_pool_";

/**
 * Tops the free-agent pool up to {@link FREE_AGENT_POOL_MIN_PER_POSITION} at
 * each position (more where several teams need that position filled, in the
 * preseason and regular season) with fringe players, the same band a new
 * league opens with.
 * Does nothing while a startup fantasy draft is unfinished (its pool is the
 * draft pool) or before any player exists.
 *
 * Draws from its own stream, derived from the Rng's current state without
 * consuming it, so nothing seeded after this call changes unless the pool
 * actually needed players. Idempotent: a full pool adds no one.
 */
export function ensureFreeAgentPool(state: GameState, rng: Rng): SystemResult {
  const draft = state.world.fantasyDraft;
  if (draft != null && draft.status !== "complete") {
    return systemResult(state);
  }
  if (Object.keys(state.world.players).length === 0) {
    return systemResult(state);
  }

  const pool = listFreeAgents(state).playerIds.map(
    (id) => state.world.players[id]!,
  );
  const demand = isRepairPhase(state) ? openPositionDemand(state) : null;
  const missing = PLAYER_POSITIONS.flatMap((position) => {
    const have = pool.filter((player) =>
      playsPosition(player, position),
    ).length;
    const target = Math.max(
      FREE_AGENT_POOL_MIN_PER_POSITION,
      demand?.get(position) ?? 0,
    );
    return Array.from({ length: Math.max(0, target - have) }, () => position);
  });
  if (missing.length === 0) {
    return systemResult(state);
  }

  const stream = createSeededRng(
    deriveSeed(
      rng.getState(),
      `free-agent-pool:${state.world.calendar.currentDate}`,
    ),
  );
  const occupiedNames = new Set<string>();
  for (const existing of Object.values(state.world.players)) {
    if (existing.retired === true) continue;
    occupiedNames.add(`${existing.firstName} ${existing.lastName}`);
  }
  let nextIndex = nextPoolIndex(state);

  const added: Record<string, Player> = {};
  for (const position of missing) {
    const id = asPlayerId(`${POOL_ID_PREFIX}${nextIndex}`);
    nextIndex += 1;
    const player = generatePlayerWithRng(stream, {
      id,
      teamId: null,
      contractId: null,
      position,
      occupiedNames,
      qualityBand: OPENING_FREE_AGENT_QUALITY,
    });
    occupiedNames.add(`${player.firstName} ${player.lastName}`);
    added[id] = player;
  }

  return systemResult({
    ...state,
    world: {
      ...state.world,
      players: { ...state.world.players, ...added },
    },
  });
}

function nextPoolIndex(state: GameState): number {
  let highest = -1;
  for (const id of Object.keys(state.world.players)) {
    if (!id.startsWith(POOL_ID_PREFIX)) continue;
    const index = Number(id.slice(POOL_ID_PREFIX.length));
    if (Number.isInteger(index) && index > highest) highest = index;
  }
  return highest + 1;
}
