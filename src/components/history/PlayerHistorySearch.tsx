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
      <label className="block text-sm text-muted">
        Search players
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search player..."
          className="mt-1 block w-full max-w-md rounded-md border border-line-strong bg-surface-raised px-3 py-1.5 text-ink"
        />
      </label>
      {visible.length === 0 ? (
        <p className="text-sm text-faint">No players match “{query}”.</p>
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
                  "flex items-baseline justify-between gap-2 rounded-md px-2 py-1 text-sm hover:bg-surface-raised",
                  focusRingClass,
                  entry.playerId === props.selectedPlayerId &&
                    "bg-team/15 text-team-ink",
                )}
              >
                <span className="text-ink">{entry.displayName}</span>
                <span className="text-sm text-faint">
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
        <p className="text-sm text-faint">
          Showing {RESULT_LIMIT} of {matches.length}. Refine your search.
        </p>
      ) : null}
    </div>
  );
}
