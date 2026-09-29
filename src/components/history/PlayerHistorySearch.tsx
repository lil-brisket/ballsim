"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { cn, focusRingClass } from "@/components/ui/styles";
import { historyHubHref } from "@/components/history/history-hub-links";
import type { HistoryHubRoute } from "@/state/history-hub-selectors";
import {
  filterPlayerHistoryIndex,
  type PlayerHistoryIndexEntry,
} from "@/state/player-history-selectors";

const RESULT_LIMIT = 50;

export function PlayerHistorySearch(props: {
  saveId: string;
  route: HistoryHubRoute;
  index: PlayerHistoryIndexEntry[];
  selectedPlayerId: string | null;
}) {
  const [query, setQuery] = useState("");
  const matches = useMemo(
    () => filterPlayerHistoryIndex(props.index, query),
    [props.index, query],
  );
  const visible = matches.slice(0, RESULT_LIMIT);

  return (
    <div className="space-y-3">
      <label className="block text-sm text-zinc-400">
        Search players
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search player..."
          className="mt-1 block w-full max-w-md rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-zinc-100"
        />
      </label>
      {visible.length === 0 ? (
        <p className="text-sm text-zinc-500">No players match “{query}”.</p>
      ) : (
        <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((entry) => (
            <li key={entry.playerId}>
              <Link
                href={historyHubHref(props.saveId, props.route, {
                  tab: "players",
                  player: entry.playerId,
                })}
                className={cn(
                  "flex items-baseline justify-between gap-2 rounded-md px-2 py-1 text-sm hover:bg-zinc-900",
                  focusRingClass,
                  entry.playerId === props.selectedPlayerId &&
                    "bg-amber-600/10 text-amber-300",
                )}
              >
                <span className="text-zinc-100">{entry.displayName}</span>
                <span className="text-xs text-zinc-500">
                  {entry.retired ? "Retired · " : ""}
                  {entry.seasonsPlayed}{" "}
                  {entry.seasonsPlayed === 1 ? "season" : "seasons"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {matches.length > RESULT_LIMIT ? (
        <p className="text-xs text-zinc-500">
          Showing {RESULT_LIMIT} of {matches.length}. Refine your search.
        </p>
      ) : null}
    </div>
  );
}
