"use client";

import { useState } from "react";
import type { PlayerStatLine } from "@/domain/player-stat-aggregation";
import { cn, focusRingClass } from "@/components/ui/styles";
import {
  seasonColumns,
  sortSeasonRows,
  type SeasonRow,
  type StatMode,
} from "./stat-view";

export function CareerSeasonsTable(props: {
  rows: SeasonRow[];
  career: PlayerStatLine;
  mode: StatMode;
}) {
  const columns = seasonColumns(props.mode);
  const [sort, setSort] = useState<{ key: string; direction: "asc" | "desc" }>({
    key: "season",
    direction: "asc",
  });
  // Column sets differ per mode; fall back to Season when the key is gone.
  const active = columns.find((c) => c.key === sort.key) ?? columns[0];
  const direction = active.key === sort.key ? sort.direction : "asc";
  const sorted = sortSeasonRows(props.rows, active, direction, props.mode);
  const careerRow: SeasonRow = {
    seasonId: "career",
    seasonYear: 0,
    current: false,
    age: null,
    line: props.career,
  };
  const hasCurrent = props.rows.some((row) => row.current);

  function toggle(key: string) {
    setSort((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === "desc" ? "asc" : "desc" }
        : { key, direction: "desc" },
    );
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full min-w-[36rem] text-sm">
          <caption className="sr-only">Career statistics by season</caption>
          <thead>
            <tr className="border-b border-zinc-800 text-left font-mono text-[0.65rem] uppercase tracking-[0.14em] text-zinc-400">
              {columns.map((column) => {
                const isActive = column.key === active.key;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={
                      isActive
                        ? direction === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                    className="px-1 py-1 font-normal"
                  >
                    <button
                      type="button"
                      onClick={() => toggle(column.key)}
                      className={cn(
                        "inline-flex min-h-9 items-center gap-1 rounded px-1.5 uppercase tracking-[0.14em] hover:text-zinc-100",
                        isActive && "text-amber-300",
                        focusRingClass,
                      )}
                    >
                      {column.label}
                      {isActive ? (
                        <span aria-hidden>
                          {direction === "asc" ? "▲" : "▼"}
                        </span>
                      ) : null}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr
                key={row.seasonId}
                className="border-b border-zinc-800/60 font-mono tabular-nums text-zinc-100"
              >
                {columns.map((column) => (
                  <td key={column.key} className="px-2.5 py-2">
                    {column.display(row, props.mode)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-amber-700/60 bg-zinc-900/60 font-mono font-semibold tabular-nums text-amber-200">
              {columns.map((column) => (
                <td key={column.key} className="px-2.5 py-2">
                  {column.key === "season"
                    ? "Career"
                    : column.key === "age"
                      ? "—"
                      : column.display(careerRow, props.mode)}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
      {hasCurrent ? (
        <p className="text-xs text-zinc-400">* Season in progress</p>
      ) : null}
    </div>
  );
}
