import "server-only";

import type { SaveGameStore } from "@/persistence/save-game-store";
import { prismaSaveGameStore } from "@/persistence/save-game-repository";
import { getCurrentUserId } from "@/application/auth/session";
import { createActingSaveGameStore } from "@/application/online/acting-save-store";

/**
 * Hosted deployments set BALLSIM_REQUIRE_SIGN_IN=true so every single-player
 * save belongs to an account; locally, saves made signed out stay shared.
 */
export function requireSignInForSaves(): boolean {
  return process.env.BALLSIM_REQUIRE_SIGN_IN === "true";
}

/**
 * The save store for one request: online leagues are visible only to their
 * members and act as the signed-in participant; other saves only to the
 * account that created them. Pages and services must load saves through
 * this (or game-service getStore), never prismaSaveGameStore.
 */
export function getRequestSaveStore(): SaveGameStore {
  return createActingSaveGameStore(prismaSaveGameStore, getCurrentUserId, {
    requireSignIn: requireSignInForSaves(),
  });
}
