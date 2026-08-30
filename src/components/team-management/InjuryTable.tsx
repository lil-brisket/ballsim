"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { InjuryReportView } from "@/state/team-management-selectors";
import { DataTable } from "@/components/owner/DataTable";
import { EmptyState } from "@/components/owner/EmptyState";
import { StatusBadge } from "@/components/owner/StatusBadge";
import { SortableTableControls } from "@/components/owner/SortableTableControls";

type SortKey = "player" | "status" | "position";

function isUnavailableStatus(status: string): boolean {
  return (
    status === "out" ||
    status === "limited" ||
    status === "questionable" ||
    status === "suspended"
  );
}

function formatGamesRemaining(
  games: { min: number; max: number } | null,
): string | null {
  if (games == null) return null;
  if (games.min === games.max) {
    return `${games.min}g`;
  }
  return `${games.min}–${games.max}g`;
}

export function InjuryTable(props: {
  saveId: string;
  report: InjuryReportView;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("status");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    let filtered = props.report.rows;
    const q = query.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter((row) =>
        `${row.firstName} ${row.lastName} ${row.position} ${row.statusLabel} ${row.injuryType ?? ""}`
          .toLowerCase()
          .includes(q),
      );
    }
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "player") {
        cmp = `${a.lastName}${a.firstName}`.localeCompare(
          `${b.lastName}${b.firstName}`,
        );
      } else if (sortKey === "position") {
        cmp = a.position.localeCompare(b.position);
      } else {
        cmp = a.status.localeCompare(b.status);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [props.report.rows, query, sortDir, sortKey]);

  if (props.report.injuredCount === 0 && query === "") {
    return <EmptyState message="No injuries on the roster." />;
  }

  return (
    <div className="space-y-4">
      <SortableTableControls
        sortKey={sortKey}
        sortDir={sortDir}
        onSortKeyChange={setSortKey}
        onSortDirChange={setSortDir}
        query={query}
        onQueryChange={setQuery}
        queryPlaceholder="Player, position, status…"
        options={[
          { value: "status", label: "Status" },
          { value: "player", label: "Player" },
          { value: "position", label: "Position" },
        ]}
      />
      <DataTable
        headers={["Player", "Pos", "Status", "Detail", "Workload", ""]}
      >
        {rows.map((row) => {
          const gamesText = formatGamesRemaining(row.gamesRemaining);
          const detailParts = [
            row.isLegacyUndisclosed
              ? "Undisclosed"
              : row.injuryType,
            row.severity,
            gamesText,
          ].filter(Boolean);
          const workload =
            row.recommendedWorkloadMpg != null ||
            row.maximumWorkloadMpg != null
              ? `Rec ${row.recommendedWorkloadMpg ?? "—"} / Max ${row.maximumWorkloadMpg ?? "—"}`
              : "—";
          return (
            <tr key={row.playerId} className="border-t border-zinc-800">
              <td className="px-3 py-2 text-zinc-100">
                {row.firstName} {row.lastName}
              </td>
              <td className="px-3 py-2 font-mono text-zinc-400">
                {row.position}
              </td>
              <td className="px-3 py-2">
                <StatusBadge label={row.statusLabel} tone={row.status} />
              </td>
              <td className="px-3 py-2 text-xs text-zinc-400">
                {detailParts.length > 0 ? detailParts.join(" · ") : "—"}
              </td>
              <td className="px-3 py-2 font-mono text-xs text-zinc-400">
                {workload}
              </td>
              <td className="px-3 py-2 text-right">
                {isUnavailableStatus(row.status) ? (
                  <Link
                    href={`/dashboard/${props.saveId}/team-management/lineups`}
                    className="text-xs text-amber-400 hover:underline"
                  >
                    Fix lineup →
                  </Link>
                ) : null}
              </td>
            </tr>
          );
        })}
      </DataTable>
    </div>
  );
}
