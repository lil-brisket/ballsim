"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchPlayerProfileViewAction } from "@/application/actions";
import type { PlayerProfileDrawerData } from "@/state/player-profile-selectors";

export type ProfileEntry =
  | { status: "loading" }
  | { status: "ready"; data: PlayerProfileDrawerData }
  /** The profile exists only for players in the owner's scope. */
  | { status: "unavailable" }
  | { status: "error" };

/**
 * Lazily loads the full player profile for the drawer's profile tabs. Loads at
 * most once per player per drawer session; `reload` refetches after an action.
 */
export function usePlayerProfileData(args: { saveId: string; open: boolean }) {
  const { saveId, open } = args;
  const [entries, setEntries] = useState<Record<string, ProfileEntry>>({});
  const requested = useRef(new Set<string>());
  const generation = useRef(0);

  useEffect(() => {
    if (!open) return;
    const requestedNow = requested.current;
    return () => {
      // Drawer closed: drop the session cache and ignore in-flight results.
      generation.current += 1;
      requestedNow.clear();
      setEntries({});
    };
  }, [open]);

  const fetchProfile = useCallback(
    async (playerId: string, silent: boolean) => {
      const token = generation.current;
      requested.current.add(playerId);
      if (!silent) {
        setEntries((prev) => ({ ...prev, [playerId]: { status: "loading" } }));
      }
      let next: ProfileEntry;
      try {
        const data = await fetchPlayerProfileViewAction(saveId, playerId);
        next = data ? { status: "ready", data } : { status: "unavailable" };
      } catch {
        next = { status: "error" };
      }
      if (token !== generation.current) return;
      if (next.status === "error") {
        if (silent) return; // keep the stale data
        requested.current.delete(playerId);
      }
      setEntries((prev) => ({ ...prev, [playerId]: next }));
    },
    [saveId],
  );

  const ensure = useCallback(
    (playerId: string) => {
      if (requested.current.has(playerId)) return;
      void fetchProfile(playerId, false);
    },
    [fetchProfile],
  );

  /** Refetch without the skeleton, e.g. after a trade or assignment. */
  const refresh = useCallback(
    (playerId: string) => {
      if (!requested.current.has(playerId)) return;
      void fetchProfile(playerId, true);
    },
    [fetchProfile],
  );

  const retry = useCallback(
    (playerId: string) => {
      void fetchProfile(playerId, false);
    },
    [fetchProfile],
  );

  return { entries, ensure, refresh, retry };
}
