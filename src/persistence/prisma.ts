import "server-only";

import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set.");
  }

  const adapter = new PrismaLibSql({ url });
  return new PrismaClient({ adapter });
}

/**
 * Lazy Prisma client. Construction (and DATABASE_URL check) happens on first use
 * so tests can inject a client without requiring a process-wide database URL.
 */
export function getPrisma(): PrismaClient {
  globalForPrisma.prisma ??= createPrismaClient();
  return globalForPrisma.prisma;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrisma();
    const value = Reflect.get(client, prop, client) as unknown;
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});
