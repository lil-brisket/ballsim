import "server-only";

import type { SaveGameStore } from "@/persistence/save-game-store";
import { prismaSaveGameStore } from "@/persistence/save-game-repository";
import { getCurrentUserId } from "@/application/auth/session";
import { createActingSaveGameStore } from "@/application/online/acting-save-store";

/**
 * The save store for one request: online leagues are visible only to their
 * members and act as the signed-in participant. Pages and services must load
 * saves through this (or game-service getStore), never prismaSaveGameStore.
 */
export function getRequestSaveStore(): SaveGameStore {
  return createActingSaveGameStore(prismaSaveGameStore, getCurrentUserId);
}
