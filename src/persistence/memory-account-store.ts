import {
  type AccountStore,
  type LeagueInviteRecord,
  type SessionRecord,
  type UserRecord,
  UsernameTakenError,
} from "@/persistence/account-store";

/** In-memory adapter for tests. */
export function createMemoryAccountStore(): AccountStore {
  const users = new Map<string, UserRecord>();
  const sessions = new Map<string, SessionRecord>();
  const invites = new Map<string, LeagueInviteRecord>();

  return {
    async createUser(input) {
      for (const user of users.values()) {
        if (user.username === input.username) {
          throw new UsernameTakenError();
        }
      }
      const record = { ...input, createdAt: new Date() };
      users.set(record.id, record);
      return { ...record };
    },
    async findUserByUsername(username) {
      for (const user of users.values()) {
        if (user.username === username) {
          return { ...user };
        }
      }
      return null;
    },
    async findUserById(id) {
      const user = users.get(id);
      return user ? { ...user } : null;
    },

    async createSession(input) {
      const record = { ...input, createdAt: new Date() };
      sessions.set(record.id, record);
      return { ...record };
    },
    async findSession(id) {
      const session = sessions.get(id);
      return session ? { ...session } : null;
    },
    async deleteSession(id) {
      sessions.delete(id);
    },

    async createInvite(input) {
      const record: LeagueInviteRecord = {
        ...input,
        revokedAt: null,
        uses: 0,
        createdAt: new Date(),
      };
      invites.set(record.id, record);
      return { ...record };
    },
    async findInviteByTokenHash(tokenHash) {
      for (const invite of invites.values()) {
        if (invite.tokenHash === tokenHash) {
          return { ...invite };
        }
      }
      return null;
    },
    async listInvites(saveGameId) {
      return [...invites.values()]
        .filter((invite) => invite.saveGameId === saveGameId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((invite) => ({ ...invite }));
    },
    async consumeInvite(id, now) {
      const invite = invites.get(id);
      if (
        !invite ||
        invite.revokedAt !== null ||
        invite.expiresAt <= now ||
        invite.uses >= invite.maxUses
      ) {
        return false;
      }
      invite.uses += 1;
      return true;
    },
    async releaseInvite(id) {
      const invite = invites.get(id);
      if (invite && invite.uses > 0) {
        invite.uses -= 1;
      }
    },
    async revokeInvite(id, saveGameId, now) {
      const invite = invites.get(id);
      if (!invite || invite.saveGameId !== saveGameId) {
        return false;
      }
      invite.revokedAt ??= now;
      return true;
    },
  };
}
