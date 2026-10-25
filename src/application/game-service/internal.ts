import "server-only";
import { getRequestSaveStore } from "@/application/request-save-store";
import type {
  LoadedSaveGame,
  SaveGameSummary,
  SaveGameStore,
} from "@/persistence/save-game-store";
import type { CustomContentStore } from "@/persistence/custom-content-store";
import { withSaveHistory } from "@/persistence/save-history";
import { prismaCustomContentStore } from "@/persistence/custom-content-repository";
import { toDashboardSnapshot } from "@/state/selectors";
import { type GameState, appendEventLog } from "@/state/game-state";
import { ensurePlayerPortraits } from "@/systems/portraits/assign-player-portraits";
import type { DomainEvent } from "@/domain/events";
import { validateGameState } from "@/persistence/validate-game-state";
import type { TeamId, PlayerId } from "@/domain/ids";
import { getTradeBlock, addToTradeBlock } from "@/systems/trades";
import {
  type PlayerPosition,
  PLAYER_POSITIONS,
} from "@/domain/entities/player";
import { type Rng, createSeededRng } from "@/domain/rng";
import type {
  OwnerCommandFailure,
  OwnerCommandSuccess,
  OwnerCommandResult,
} from "@/application/game-service/types";

export function toSaveSummary(loaded: LoadedSaveGame): SaveGameSummary {
  return {
    id: loaded.id,
    name: loaded.name,
    schemaVersion: loaded.schemaVersion,
    createdAt: loaded.createdAt,
    updatedAt: loaded.updatedAt,
    ownerUserId: loaded.ownerUserId,
  };
}

export function getStore(store?: SaveGameStore): SaveGameStore {
  return store ?? getRequestSaveStore();
}

/**
 * The league with its finished-season history (see save-history.ts), for
 * read-only views that show past seasons: player careers and game logs,
 * box scores, the record book, past schedules. Everything else uses load.
 */
export async function loadSaveWithHistory(
  saveId: string,
  store?: SaveGameStore,
): Promise<LoadedSaveGame | null> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return null;
  }
  const history = await saveStore.loadHistory(saveId);
  return { ...loaded, state: withSaveHistory(loaded.state, history) };
}

export function getCustomStore(store?: CustomContentStore): CustomContentStore {
  return store ?? prismaCustomContentStore;
}

export function fail(error: string): OwnerCommandFailure {
  return { ok: false, error };
}

export function withDashboard(
  loaded: LoadedSaveGame,
  extra: object = {},
): OwnerCommandSuccess {
  return {
    ok: true,
    save: toSaveSummary(loaded),
    dashboard: toDashboardSnapshot(loaded.state),
    ...extra,
  };
}

/**
 * Shared portrait boundary for every save write: assigns a persisted portrait
 * to any player / draft prospect missing one. Never blocks persistence — on
 * failure the state is saved without new portraits (UI falls back to the
 * initials plate) and the next write retries.
 */
export function withPlayerPortraits(state: GameState): GameState {
  try {
    return ensurePlayerPortraits(state).state;
  } catch (error) {
    console.error(
      "Player portrait assignment failed; continuing without.",
      error,
    );
    return state;
  }
}

/**
 * Persist working state after successful command validation.
 * Writes RNG only on the working copy being saved.
 * Appends newlyEmittedEvents exactly once into user.eventLog (bounded).
 * When ifUpdatedAt is set, commits only if the store row still matches (CAS).
 */
export async function persistWorkingState(
  saveId: string,
  working: GameState,
  rngState: number,
  store: SaveGameStore,
  newlyEmittedEvents: readonly DomainEvent[] = [],
  options: { ifUpdatedAt?: Date } = {},
): Promise<LoadedSaveGame> {
  const withEvents = withPlayerPortraits(
    appendEventLog(working, newlyEmittedEvents),
  );
  const nowIso = new Date().toISOString();
  const nextState: GameState = {
    ...withEvents,
    meta: {
      ...withEvents.meta,
      rngState,
      updatedAt: nowIso,
    },
  };
  // One validation: nextState differs from withEvents only in meta.
  validateGameState(nextState);
  return store.save({
    id: saveId,
    state: nextState,
    ifUpdatedAt: options.ifUpdatedAt,
  });
}

/**
 * Ensures non-user teams have at least one surplus player on the trade block
 * so findTrades can discover 1-for-1 candidates. Pure working-copy mutation.
 */
export function ensureAiTradeBlocks(state: GameState): GameState {
  let current = state;
  const teamIds = (Object.keys(current.world.teams) as TeamId[])
    .filter((teamId) => teamId !== current.user.activeOwnerTeamId)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  for (const teamId of teamIds) {
    const block = getTradeBlock(current, teamId);
    if (block.assets.some((asset) => asset.kind === "player")) {
      continue;
    }
    const surplus = findSurplusPlayer(current, teamId);
    if (surplus === undefined) {
      continue;
    }
    current = addToTradeBlock(current, teamId, {
      kind: "player",
      playerId: surplus,
    }).state;
  }
  return current;
}

function findSurplusPlayer(
  state: GameState,
  teamId: TeamId,
): PlayerId | undefined {
  const team = state.world.teams[teamId];
  if (!team || team.roster.length === 0) {
    return undefined;
  }
  const counts = new Map<PlayerPosition, number>();
  for (const position of PLAYER_POSITIONS) {
    counts.set(position, 0);
  }
  for (const playerId of team.roster) {
    const player = state.world.players[playerId];
    if (!player) {
      continue;
    }
    counts.set(player.position, (counts.get(player.position) ?? 0) + 1);
  }
  let maxCount = 0;
  for (const count of counts.values()) {
    if (count > maxCount) {
      maxCount = count;
    }
  }
  if (maxCount <= 1) {
    // Still allow trading a low-overall player when no surplus position.
    const sorted = [...team.roster].sort((a, b) =>
      a < b ? -1 : a > b ? 1 : 0,
    );
    return sorted[sorted.length - 1];
  }
  const surplusPositions = PLAYER_POSITIONS.filter(
    (position) => (counts.get(position) ?? 0) === maxCount,
  );
  const candidates = team.roster
    .filter((playerId) => {
      const player = state.world.players[playerId];
      return player !== undefined && surplusPositions.includes(player.position);
    })
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return candidates[0];
}

export async function runOwnerFranchiseCommand(
  saveId: string,
  mutate: (
    state: GameState,
    rng: Rng,
  ) => { state: GameState; events: DomainEvent[] },
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const activeStore = getStore(store);
  const loaded = await activeStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }
  try {
    const rng = createSeededRng(loaded.state.meta.rngState);
    const result = mutate(loaded.state, rng);
    const persisted = await persistWorkingState(
      saveId,
      result.state,
      rng.getState(),
      activeStore,
      result.events,
    );
    return withDashboard(persisted);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}
