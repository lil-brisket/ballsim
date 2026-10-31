"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Which roster view (sheet or table) the viewer last chose, kept in
 * localStorage (never in the save). Blocked storage falls back to an
 * in-memory choice for the session. Server render and first client render
 * both use DEFAULT_ROSTER_VIEW so hydration matches.
 */
export type RosterViewMode = "sheet" | "table";

export const DEFAULT_ROSTER_VIEW: RosterViewMode = "sheet";
export const ROSTER_VIEW_STORAGE_KEY = "ballsim:roster-view";

let memory: RosterViewMode | null = null;
const listeners = new Set<() => void>();

export function parseRosterView(value: unknown): RosterViewMode | null {
  return value === "sheet" || value === "table" ? value : null;
}

function readStored(): RosterViewMode | null {
  try {
    return parseRosterView(
      window.localStorage.getItem(ROSTER_VIEW_STORAGE_KEY),
    );
  } catch {
    return null;
  }
}

function getSnapshot(): RosterViewMode {
  return memory ?? readStored() ?? DEFAULT_ROSTER_VIEW;
}

function getServerSnapshot(): RosterViewMode {
  return DEFAULT_ROSTER_VIEW;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function setRosterView(mode: RosterViewMode): void {
  try {
    window.localStorage.setItem(ROSTER_VIEW_STORAGE_KEY, mode);
    memory = null;
  } catch {
    memory = mode;
  }
  listeners.forEach((listener) => listener());
}

/** The stored choice (default "sheet") and a setter. */
export function useStoredRosterView(): [
  RosterViewMode,
  (mode: RosterViewMode) => void,
] {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const set = useCallback((next: RosterViewMode) => setRosterView(next), []);
  return [mode, set];
}
