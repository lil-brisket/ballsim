"use client";

import { useSyncExternalStore } from "react";
import type { CourtCameraView } from "./court-camera";

const STORAGE_KEY = "ballsim:courtView";

const listeners = new Set<() => void>();
/** Last choice this page load, used when storage is unavailable. */
let memoryView: CourtCameraView | null = null;

function readView(): CourtCameraView {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "top-down" || stored === "broadcast") {
      return stored;
    }
  } catch {
    // Storage blocked (private mode, sandbox): fall back to memory.
  }
  return memoryView ?? "broadcast";
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function writeView(next: CourtCameraView): void {
  memoryView = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Storage blocked: the choice lasts until reload.
  }
  for (const listener of listeners) {
    listener();
  }
}

/** The viewer's court camera view (per browser), defaulting to Broadcast. */
export function useCourtView(): [
  CourtCameraView,
  (next: CourtCameraView) => void,
] {
  const view = useSyncExternalStore<CourtCameraView>(
    subscribe,
    readView,
    () => "broadcast",
  );
  return [view, writeView];
}

const COMPACT_QUERY = "(max-width: 639px)";

function subscribeCompact(onStoreChange: () => void): () => void {
  const query = window.matchMedia?.(COMPACT_QUERY);
  query?.addEventListener?.("change", onStoreChange);
  return () => query?.removeEventListener?.("change", onStoreChange);
}

function readCompact(): boolean {
  return window.matchMedia?.(COMPACT_QUERY).matches ?? false;
}

/** True at phone widths, where the follow camera frames tighter. */
export function useCompactCourt(): boolean {
  return useSyncExternalStore(subscribeCompact, readCompact, () => false);
}
