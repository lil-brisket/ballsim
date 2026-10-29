"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { RatingDisplayMode } from "@/presentation/rating-grade";

/**
 * One per-viewer preference for the whole game: show skill ratings as letter
 * grades or as numbers. Stored in localStorage (never in the save); blocked
 * storage falls back to an in-memory choice for the session. The server and
 * the first client render both use DEFAULT_RATING_DISPLAY so hydration
 * matches; the stored value is applied right after.
 */
export const DEFAULT_RATING_DISPLAY: RatingDisplayMode = "grades";
export const RATING_DISPLAY_STORAGE_KEY = "ballsim:rating-display";

let memory: RatingDisplayMode | null = null;
const listeners = new Set<() => void>();

function isMode(value: unknown): value is RatingDisplayMode {
  return value === "grades" || value === "ratings";
}

function readStored(): RatingDisplayMode | null {
  try {
    const value = window.localStorage.getItem(RATING_DISPLAY_STORAGE_KEY);
    return isMode(value) ? value : null;
  } catch {
    return null;
  }
}

function getSnapshot(): RatingDisplayMode {
  return memory ?? readStored() ?? DEFAULT_RATING_DISPLAY;
}

function getServerSnapshot(): RatingDisplayMode {
  return DEFAULT_RATING_DISPLAY;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function setRatingDisplay(mode: RatingDisplayMode): void {
  try {
    window.localStorage.setItem(RATING_DISPLAY_STORAGE_KEY, mode);
    memory = null;
  } catch {
    // Storage blocked: the choice lasts for this session only.
    memory = mode;
  }
  listeners.forEach((listener) => listener());
}

export function useRatingDisplay(): [
  RatingDisplayMode,
  (mode: RatingDisplayMode) => void,
] {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const set = useCallback(
    (next: RatingDisplayMode) => setRatingDisplay(next),
    [],
  );
  return [mode, set];
}
