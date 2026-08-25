"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/owner/EmptyState";
import { Section } from "@/components/owner/Section";
import type {
  PlayerGameLogRowView,
  PlayerProfileView,
} from "@/state/player-profile-selectors";

const PAGE_SIZE = 25;

type SortKey = keyof PlayerGameLogRowView;

export function PlayerGameLog(props: {
  player: PlayerProfileView;
  saveId: string;
}) {
  const [seasonFilter, setSeasonFilter] = useState<string>("all");
  const [competitionFilter, setCompetitionFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(0);

  const seasons = useMemo(() => {
    const years = new Set(props.player.gameLog.map((row) => row.seasonYear));
    return [...years].sort((a, b) => b - a);
  }, [props.player.gameLog]);

  const filtered = useMemo(() => {
    let rows = [...props.player.gameLog];
    if (seasonFilter !== "all") {
      rows = rows.filter((row) => String(row.seasonYear) === seasonFilter);
    }
    if (competitionFilter !== "all") {
      rows = rows.filter((row) => row.competitionType === competitionFilter);
    }
    rows.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av === bv) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return sortAsc ? -1 : 1;
      return sortAsc ? 1 : -1;
    });
    return rows;
  }, [
    props.player.gameLog,
    seasonFilter,
    competitionFilter,
    sortKey,
    sortAsc,
  ]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(key === "date" ? false : true);
    }
    setPage(0);
  }

  if (props.player.gameLog.length === 0) {
    return (
      <Section title="Game log">
        <EmptyState message="No game log entries for this player." />
      </Section>
    );
  }

  return (
    <Section
      title="Game log"
      action={
        <div className="flex flex-wrap gap-2">
          <select
            className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200"
            value={seasonFilter}
            onChange={(event) => {
              setSeasonFilter(event.target.value);
              setPage(0);
            }}
          >
            <option value="all">All seasons</option>
            {seasons.map((year) => (
              <option key={year} value={String(year)}>
                {year}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200"
            value={competitionFilter}
            onChange={(event) => {
              setCompetitionFilter(event.target.value);
              setPage(0);
            }}
          >
            <option value="all">RS + Playoffs</option>
            <option value="regular_season">Regular season</option>
            <option value="playoffs">Playoffs</option>
          </select>
        </div>
      }
    >
      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-zinc-900 text-zinc-400">
            <tr>
              {(
                [
                  ["date", "Date"],
                  ["opponentAbbreviation", "Opp"],
                  ["won", "Result"],
                  ["minutes", "MIN"],
                  ["points", "PTS"],
                  ["rebounds", "REB"],
                  ["assists", "AST"],
                  ["steals", "STL"],
                  ["blocks", "BLK"],
                  ["turnovers", "TO"],
                  ["fgMade", "FG"],
                  ["threeMade", "3PT"],
                  ["ftMade", "FT"],
                ] as Array<[SortKey, string]>
              ).map(([key, label]) => (
                <th key={key} className="px-3 py-2 font-medium">
                  <button
                    type="button"
                    className="hover:text-amber-400"
                    onClick={() => toggleSort(key)}
                  >
                    {label}
                    {sortKey === key ? (sortAsc ? " ↑" : " ↓") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr key={row.gameId} className="border-t border-zinc-800">
                <td className="px-3 py-2">
                  <Link
                    href={`/dashboard/${props.saveId}/games/${row.gameId}`}
                    className="font-mono text-amber-400 hover:underline"
                  >
                    {row.date}
                  </Link>
                </td>
                <td className="px-3 py-2 text-zinc-400">
                  {row.home ? "vs" : "@"} {row.opponentAbbreviation}
                </td>
                <td className="px-3 py-2 font-mono text-zinc-400">
                  {row.won === null
                    ? "—"
                    : `${row.won ? "W" : "L"} ${row.teamScore}-${row.opponentScore}`}
                </td>
                <td className="px-3 py-2 font-mono text-zinc-400">
                  {row.minutes}
                </td>
                <td className="px-3 py-2 font-mono text-zinc-100">
                  {row.points}
                </td>
                <td className="px-3 py-2 font-mono text-zinc-400">
                  {row.rebounds}
                </td>
                <td className="px-3 py-2 font-mono text-zinc-400">
                  {row.assists}
                </td>
                <td className="px-3 py-2 font-mono text-zinc-400">
                  {row.steals}
                </td>
                <td className="px-3 py-2 font-mono text-zinc-400">
                  {row.blocks}
                </td>
                <td className="px-3 py-2 font-mono text-zinc-400">
                  {row.turnovers}
                </td>
                <td className="px-3 py-2 font-mono text-zinc-400">
                  {row.fgMade}/{row.fgAttempted}
                </td>
                <td className="px-3 py-2 font-mono text-zinc-400">
                  {row.threeMade}/{row.threeAttempted}
                </td>
                <td className="px-3 py-2 font-mono text-zinc-400">
                  {row.ftMade}/{row.ftAttempted}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pageCount > 1 ? (
        <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
          <span>
            Page {page + 1} of {pageCount} ({filtered.length} games)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page === 0}
              className="rounded border border-zinc-700 px-2 py-1 disabled:opacity-40"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= pageCount - 1}
              className="rounded border border-zinc-700 px-2 py-1 disabled:opacity-40"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </Section>
  );
}
