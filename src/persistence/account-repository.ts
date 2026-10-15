import "server-only";

import { getPrisma } from "@/persistence/prisma";
import {
  type AccountStore,
  UsernameTakenError,
} from "@/persistence/account-store";

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

export const prismaAccountStore: AccountStore = {
  async createUser(input) {
    try {
      return await getPrisma().user.create({ data: input });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new UsernameTakenError();
      }
      throw error;
    }
  },
  async findUserByUsername(username) {
    return getPrisma().user.findUnique({ where: { username } });
  },
  async findUserById(id) {
    return getPrisma().user.findUnique({ where: { id } });
  },

  async createSession(input) {
    return getPrisma().session.create({ data: input });
  },
  async findSession(id) {
    return getPrisma().session.findUnique({ where: { id } });
  },
  async deleteSession(id) {
    await getPrisma().session.deleteMany({ where: { id } });
  },

  async createInvite(input) {
    return getPrisma().leagueInvite.create({ data: input });
  },
  async findInviteByTokenHash(tokenHash) {
    return getPrisma().leagueInvite.findUnique({ where: { tokenHash } });
  },
  async listInvites(saveGameId) {
    return getPrisma().leagueInvite.findMany({
      where: { saveGameId },
      orderBy: { createdAt: "desc" },
    });
  },
  async consumeInvite(id, now) {
    const invite = await getPrisma().leagueInvite.findUnique({ where: { id } });
    if (!invite || invite.revokedAt !== null || invite.expiresAt <= now) {
      return false;
    }
    // Conditional increment in one statement: concurrent joiners cannot both
    // take the last use. Prisma's updateMany cannot compare two columns, so
    // the uses < maxUses check is raw SQL (no date columns compared in SQL).
    const updated = await getPrisma().$executeRaw`
      UPDATE "LeagueInvite"
      SET "uses" = "uses" + 1
      WHERE "id" = ${id}
        AND "revokedAt" IS NULL
        AND "uses" < "maxUses"`;
    return updated === 1;
  },
  async releaseInvite(id) {
    await getPrisma().leagueInvite.updateMany({
      where: { id, uses: { gt: 0 } },
      data: { uses: { decrement: 1 } },
    });
  },
  async revokeInvite(id, saveGameId, now) {
    const result = await getPrisma().leagueInvite.updateMany({
      where: { id, saveGameId },
      data: { revokedAt: now },
    });
    return result.count === 1;
  },
};
