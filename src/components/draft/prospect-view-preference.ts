"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Which prospect pool layout (scouting sheet or cards) the viewer last chose,
 * kept in localStorage (never in the save). Same pattern as
 * roster-view-preference.ts. Blocked storage falls back to an in-memory choice
 * for the session. Server render and first client render both use
 * DEFAULT_PROSPECT_VIEW so hydration matches.
 */
export type ProspectViewMode = "sheet" | "cards";

export const DEFAULT_PROSPECT_VIEW: ProspectViewMode = "sheet";
export const PROSPECT_VIEW_STORAGE_KEY = "ballsim:prospect-view";

let memory: ProspectViewMode | null = null;
const listeners = new Set<() => void>();

export function parseProspectView(value: unknown): ProspectViewMode | null {
  return value === "sheet" || value === "cards" ? value : null;
}

function readStored(): ProspectViewMode | null {
  try {
    return parseProspectView(
      window.localStorage.getItem(PROSPECT_VIEW_STORAGE_KEY),
    );
  } catch {
    return null;
  }
}

function getSnapshot(): ProspectViewMode {
  return memory ?? readStored() ?? DEFAULT_PROSPECT_VIEW;
}

function getServerSnapshot(): ProspectViewMode {
  return DEFAULT_PROSPECT_VIEW;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function setProspectView(mode: ProspectViewMode): void {
  try {
    window.localStorage.setItem(PROSPECT_VIEW_STORAGE_KEY, mode);
    memory = null;
  } catch {
    memory = mode;
  }
  listeners.forEach((listener) => listener());
}

/** The stored choice (default "sheet") and a setter. */
export function useStoredProspectView(): [
  ProspectViewMode,
  (mode: ProspectViewMode) => void,
] {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const set = useCallback(
    (next: ProspectViewMode) => setProspectView(next),
    [],
  );
  return [mode, set];
}
