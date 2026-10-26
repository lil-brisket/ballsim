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
 *   Each write stamps the acting member's last-active time.
 * - delete(): only the host may delete an online league.
 *
 * Single-player and local shared saves belong to the account that created
 * them: a save with an owner is invisible to everyone else, and only its
 * owner may write or delete it. Saves made signed out have no owner and stay
 * open to anyone on this server, unless `requireSignIn` is set (hosted
 * deployments), which hides ownerless saves and refuses to create them.
 */

import type {
  LoadedSaveGame,
  SaveGameStore,
} from "@/persistence/save-game-store";
import type { GameState } from "@/state/game-state";
import {
  getParticipantForUser,
  isOnlineLeague,
  withActingParticipantSeen,
  withActingUser,
  withActiveTeamRemembered,
} from "@/systems/participation";

export type ResolveUserId = () => Promise<string | null>;

export type ActingSaveStoreOptions = {
  /** Hide ownerless single-player saves and refuse to create them. */
  requireSignIn?: boolean;
  /** Wall clock for members' last-active stamps (tests inject one). */
  now?: () => Date;
};

export function createActingSaveGameStore(
  base: SaveGameStore,
  resolveUserId: ResolveUserId,
  options: ActingSaveStoreOptions = {},
): SaveGameStore {
  const loadedAt = new Map<string, Date>();
  const requireSignIn = options.requireSignIn ?? false;
  const now = options.now ?? (() => new Date());

  /** Single-player and local shared saves: owner, or ownerless when allowed. */
  function ownsSave(
    ownerUserId: string | null | undefined,
    userId: string | null,
  ) {
    if (ownerUserId) {
      return ownerUserId === userId;
    }
    return !requireSignIn;
  }

  async function actAs(loaded: LoadedSaveGame): Promise<LoadedSaveGame | null> {
    if (!isOnlineLeague(loaded.state)) {
      return ownsSave(loaded.ownerUserId, await resolveUserId())
        ? loaded
        : null;
    }
    const userId = await resolveUserId();
    const acting = userId ? withActingUser(loaded.state, userId) : null;
    return acting ? { ...loaded, state: acting } : null;
  }

  return {
    async list() {
      // Online leagues have no owner; load hides the ones you are not in.
      const userId = await resolveUserId();
      return (await base.list()).filter(
        (summary) =>
          !summary.ownerUserId || ownsSave(summary.ownerUserId, userId),
      );
    },
    async create(input) {
      const userId = await resolveUserId();
      const online = isOnlineLeague(input.state);
      if (!online && requireSignIn && !userId) {
        throw new Error("Sign in to create a save.");
      }
      const created = await base.create({
        ...input,
        ownerUserId: online ? null : userId,
      });
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
        // Ownership was checked when this request loaded the save; a write
        // without that load checks the stored row.
        if (!loadedAt.has(input.id)) {
          const stored = await base.load(input.id);
          if (stored && !ownsSave(stored.ownerUserId, await resolveUserId())) {
            throw new Error("This save belongs to another account.");
          }
        }
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
      const state: GameState = withActingParticipantSeen(
        withActiveTeamRemembered(input.state),
        now(),
      );
      const saved = await base.save({ ...input, state, ifUpdatedAt });
      loadedAt.set(input.id, saved.updatedAt);
      const acting = await actAs(saved);
      return acting ?? saved;
    },
    async delete(id) {
      const loaded = await base.load(id);
      if (
        loaded &&
        !isOnlineLeague(loaded.state) &&
        !ownsSave(loaded.ownerUserId, await resolveUserId())
      ) {
        throw new Error("This save belongs to another account.");
      }
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
