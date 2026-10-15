import "server-only";

import { prismaAccountStore } from "@/persistence/account-repository";
import { prismaSaveGameStore } from "@/persistence/save-game-repository";
import { getCurrentUser } from "@/application/auth/session";
import type { OnlineLeagueContext } from "@/application/game-service/online-league";

/**
 * Context for online-league membership commands and views. The commands
 * re-check membership/host themselves, so they get the unscoped store.
 */
export async function onlineLeagueContext(): Promise<OnlineLeagueContext> {
  return {
    user: await getCurrentUser(),
    saves: prismaSaveGameStore,
    accounts: prismaAccountStore,
  };
}
