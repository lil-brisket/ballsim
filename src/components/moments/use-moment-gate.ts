"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  beginMoment,
  endMoment,
  momentStatus,
  subscribeMoments,
  type MomentStatus,
} from "@/components/moments/moment-seen";

export type MomentGate = {
  open: boolean;
  /** Reopen the moment on demand (the replay button). */
  replay: () => void;
  close: () => void;
};

function serverStatus(): MomentStatus {
  return "seen";
}

/**
 * Whether a moment is open: it auto-opens once per viewer when `eligible`
 * (the facts it shows exist) and was not seen before, and reopens on
 * `replay`. `key` should come from `momentKey(kind, teamId, seasonYear)`.
 * Nothing opens during server rendering or hydration. Give one gate per key
 * `eligible` (the auto-opening host); others for the same key are replay-only.
 */
export function useMomentGate(
  saveId: string,
  key: string,
  options: { eligible?: boolean } = {},
): MomentGate {
  const eligible = options.eligible ?? true;
  const status = useSyncExternalStore(
    subscribeMoments,
    () => momentStatus(saveId, key),
    serverStatus,
  );
  // The key being replayed; a new key (next season) starts closed.
  const [replaying, setReplaying] = useState<string | null>(null);

  const autoOpen = eligible && status === "unseen";
  useEffect(() => {
    if (autoOpen) beginMoment(saveId, key);
  }, [autoOpen, saveId, key]);

  const replay = useCallback(() => setReplaying(key), [key]);
  const close = useCallback(() => {
    endMoment(saveId, key);
    setReplaying(null);
  }, [saveId, key]);

  return {
    // Only an eligible gate holds an auto-opened moment, so a replay-only
    // gate for the same key (the page's replay button) does not open too.
    open: replaying === key || (eligible && status !== "seen"),
    replay,
    close,
  };
}
