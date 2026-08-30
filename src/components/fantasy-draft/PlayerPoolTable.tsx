"use client";

import { useMemo, useState } from "react";
import type {
  FantasyDraftPoolPlayerView,
  FantasyDraftView,
} from "@/state/selectors";

function formatHeight(inches: number): string {
  const feet = Math.floor(inches / 12);
  const rem = inches % 12;
  return `${feet}'${rem}"`;
}

export function PlayerPoolTable(props: {
  draft: FantasyDraftView;
  pending: boolean;
  onOpenPlayer: (playerId: string) => void;
  onRequestDraft: (player: {
    playerId: string;
    name: string;
    position: string;
    overall: number;
    potential: number;
  }) => void;
}) {
  const { draft, pending, onOpenPlayer, onRequestDraft } = props;
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState("ALL");
  const [sort, setSort] = useState<
    "overall" | "potential" | "age" | "height" | "name"
  >("overall");
  const [availableOnly, setAvailableOnly] = useState(true);
  const [myQueueOnly, setMyQueueOnly] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 100;

  const queueIds = useMemo(
    () => new Set(draft.queue.map((q) => q.playerId)),
    [draft.queue],
  );

  const filtered = useMemo(() => {
    let rows: FantasyDraftPoolPlayerView[] = draft.poolPlayers;
    if (availableOnly) {
      rows = rows.filter((p) => !p.isDrafted);
    }
    if (myQueueOnly) {
      rows = rows.filter((p) => queueIds.has(p.playerId));
    }
    if (position !== "ALL") {
      rows = rows.filter((p) => p.position === position);
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      rows = rows.filter(
        (p) =>
          `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
          p.position.toLowerCase().includes(q) ||
          p.archetypeLabel.toLowerCase().includes(q),
      );
    }
    rows = [...rows].sort((a, b) => {
      if (sort === "potential") return b.potential - a.potential;
      if (sort === "age") return a.age - b.age;
      if (sort === "height") return b.heightInches - a.heightInches;
      if (sort === "name") {
        return `${a.lastName}${a.firstName}`.localeCompare(
          `${b.lastName}${b.firstName}`,
        );
      }
      return b.overall - a.overall;
    });
    return rows;
  }, [
    draft.poolPlayers,
    availableOnly,
    myQueueOnly,
    position,
    query,
    queueIds,
    sort,
  ]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const canDraft =
    draft.userOnClock &&
    !draft.paused &&
    draft.onClockTeamId === draft.activeOwnerTeamId;

  return (
    <section className="rounded-xl border border-zinc-800 p-4">
      <div className="mb-3 flex flex-wrap gap-2">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
          placeholder="Search players"
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
          aria-label="Search players"
        />
        <select
          value={position}
          onChange={(e) => {
            setPosition(e.target.value);
            setPage(0);
          }}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
          aria-label="Filter by position"
        >
          <option value="ALL">All positions</option>
          {["PG", "SG", "SF", "PF", "C"].map((pos) => (
            <option key={pos} value={pos}>
              {pos}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) =>
            setSort(
              e.target.value as
                | "overall"
                | "potential"
                | "age"
                | "height"
                | "name",
            )
          }
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
          aria-label="Sort players"
        >
          <option value="overall">Overall</option>
          <option value="potential">Potential</option>
          <option value="age">Age</option>
          <option value="height">Height</option>
          <option value="name">Name</option>
        </select>
        <label className="flex items-center gap-1.5 text-xs text-zinc-400">
          <input
            type="checkbox"
            checked={availableOnly}
            onChange={(e) => {
              setAvailableOnly(e.target.checked);
              setPage(0);
            }}
          />
          Available only
        </label>
        <label className="flex items-center gap-1.5 text-xs text-zinc-400">
          <input
            type="checkbox"
            checked={myQueueOnly}
            onChange={(e) => {
              setMyQueueOnly(e.target.checked);
              setPage(0);
            }}
          />
          My Queue
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-zinc-500">
            <tr>
              <th className="py-2 pr-2">Player</th>
              <th className="pr-2">Pos</th>
              <th className="pr-2">OVR</th>
              <th className="pr-2">POT</th>
              <th className="pr-2">Age</th>
              <th className="pr-2">Ht</th>
              <th className="pr-2">Archetype</th>
              <th className="pr-2">Tier</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {pageRows.map((player) => (
              <tr
                key={player.playerId}
                className={`border-t border-zinc-800 ${
                  player.isDrafted ? "opacity-50" : ""
                }`}
              >
                <td className="py-2 pr-2">
                  <button
                    type="button"
                    onClick={() => onOpenPlayer(player.playerId)}
                    className="text-left font-medium text-amber-200 underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-amber-600"
                  >
                    {player.firstName} {player.lastName}
                  </button>
                  {player.isDrafted ? (
                    <div className="text-[10px] text-zinc-500">
                      {player.draftedByAbbreviation}
                      {player.pickNumber != null
                        ? ` · #${player.pickNumber}`
                        : ""}
                    </div>
                  ) : null}
                </td>
                <td className="pr-2">{player.position}</td>
                <td className="pr-2">{player.overall}</td>
                <td className="pr-2">{player.potential}</td>
                <td className="pr-2">{player.age}</td>
                <td className="pr-2">{formatHeight(player.heightInches)}</td>
                <td className="pr-2 text-zinc-400">{player.archetypeLabel}</td>
                <td className="pr-2 capitalize text-zinc-400">{player.tier}</td>
                <td>
                  {canDraft && !player.isDrafted ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        onRequestDraft({
                          playerId: player.playerId,
                          name: `${player.firstName} ${player.lastName}`,
                          position: player.position,
                          overall: player.overall,
                          potential: player.potential,
                        })
                      }
                      className="rounded bg-amber-700/80 px-2 py-1 text-xs text-amber-50 disabled:opacity-50"
                    >
                      Draft
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
        <span>
          Showing {pageRows.length} of {filtered.length} players
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="rounded border border-zinc-700 px-2 py-1 disabled:opacity-30"
          >
            Prev
          </button>
          <span>
            {page + 1} / {pageCount}
          </span>
          <button
            type="button"
            disabled={page >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            className="rounded border border-zinc-700 px-2 py-1 disabled:opacity-30"
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}
