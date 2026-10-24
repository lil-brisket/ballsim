/**
 * Request-scoped SaveGameStore decorator for online leagues.
 *
 * Every protected command and page loads saves through this store, so the
 * membership check cannot be forgotten at a call site:
 * - load(): online leagues are invisible (null, same as "not found") unless
 *   the signed-in user is a participant; members see the league as their own
 *   participant (withActingUser), never as whoever saved last.
 * - save(): online states are always written with an optimistic-concurrency
 *   token (the updatedAt this request loaded), so two players acting at once
 *   cannot silently overwrite each other; the loser gets a conflict error.
 * - delete(): only the host may delete an online league.
 *
 * Single-player and local shared saves pass through unchanged.
 */

import type {
  LoadedSaveGame,
  SaveGameStore,
} from "@/persistence/save-game-store";
import type { GameState } from "@/state/game-state";
import {
  getParticipantForUser,
  isOnlineLeague,
  withActingUser,
  withActiveTeamRemembered,
} from "@/systems/participation";

export type ResolveUserId = () => Promise<string | null>;

export function createActingSaveGameStore(
  base: SaveGameStore,
  resolveUserId: ResolveUserId,
): SaveGameStore {
  const loadedAt = new Map<string, Date>();

  async function actAs(loaded: LoadedSaveGame): Promise<LoadedSaveGame | null> {
    if (!isOnlineLeague(loaded.state)) {
      return loaded;
    }
    const userId = await resolveUserId();
    const acting = userId ? withActingUser(loaded.state, userId) : null;
    return acting ? { ...loaded, state: acting } : null;
  }

  return {
    async list() {
      return base.list();
    },
    async create(input) {
      const created = await base.create(input);
      loadedAt.set(created.id, created.updatedAt);
      const acting = await actAs(created);
      if (!acting) {
        throw new Error("Online leagues must be created by a signed-in host.");
      }
      return acting;
    },
    async load(id) {
      const loaded = await base.load(id);
      if (!loaded) {
        return null;
      }
      const acting = await actAs(loaded);
      if (acting) {
        loadedAt.set(id, loaded.updatedAt);
      }
      return acting;
    },
    async loadHistory(id) {
      // Membership is checked by load; history follows a load of the same
      // save in this request, like online writes.
      if (!loadedAt.has(id)) {
        throw new Error("Save history must follow a load in the same request.");
      }
      return base.loadHistory(id);
    },
    async save(input) {
      if (!isOnlineLeague(input.state)) {
        return base.save(input);
      }
      const userId = await resolveUserId();
      if (!userId || !getParticipantForUser(input.state, userId)) {
        throw new Error("You are not a member of this league.");
      }
      const ifUpdatedAt = input.ifUpdatedAt ?? loadedAt.get(input.id);
      if (!ifUpdatedAt) {
        throw new Error(
          "Online league writes must follow a load in the same request.",
        );
      }
      const state: GameState = withActiveTeamRemembered(input.state);
      const saved = await base.save({ ...input, state, ifUpdatedAt });
      loadedAt.set(input.id, saved.updatedAt);
      const acting = await actAs(saved);
      return acting ?? saved;
    },
    async delete(id) {
      const loaded = await base.load(id);
      if (loaded && isOnlineLeague(loaded.state)) {
        const userId = await resolveUserId();
        const participant = userId
          ? getParticipantForUser(loaded.state, userId)
          : null;
        if (!participant?.isHost) {
          throw new Error("Only the host can delete an online league.");
        }
      }
      return base.delete(id);
    },
  };
}
