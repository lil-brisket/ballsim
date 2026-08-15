"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { RosterPlayerView } from "@/state/selectors";
import { ContractSummary } from "@/components/owner/ContractSummary";
import { DataTable } from "@/components/owner/DataTable";
import { StatusBadge } from "@/components/owner/StatusBadge";

type SortKey = "name" | "position" | "age" | "overall" | "status";

export function RosterTable(props: {
  saveId: string;
  players: RosterPlayerView[];
}) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("overall");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = props.players;
    if (q) {
      rows = rows.filter((player) => {
        const name = `${player.firstName} ${player.lastName}`.toLowerCase();
        return (
          name.includes(q) ||
          player.position.toLowerCase().includes(q) ||
          player.injuryKind.toLowerCase().includes(q)
        );
      });
    }
    const sorted = [...rows].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = `${a.lastName}${a.firstName}`.localeCompare(
            `${b.lastName}${b.firstName}`,
          );
          break;
        case "position":
          cmp = a.position.localeCompare(b.position);
          break;
        case "age":
          cmp = a.age - b.age;
          break;
        case "overall":
          cmp = a.overall - b.overall;
          break;
        case "status":
          cmp = a.injuryKind.localeCompare(b.injuryKind);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [props.players, query, sortKey, sortDir]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Filter
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, position, status…"
            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Sort by
          <select
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value as SortKey)}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
          >
            <option value="overall">Overall</option>
            <option value="name">Name</option>
            <option value="position">Position</option>
            <option value="age">Age</option>
            <option value="status">Status</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Direction
          <select
            value={sortDir}
            onChange={(event) =>
              setSortDir(event.target.value as "asc" | "desc")
            }
            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </label>
      </div>

      <DataTable
        headers={[
          "Player",
          "Pos",
          "Age",
          "OVR",
          "Contract",
          "Status",
          "Dev",
        ]}
      >
        {filtered.map((player) => (
          <tr key={player.playerId} className="border-t border-zinc-800">
            <td className="px-3 py-2">
              <Link
                href={`/dashboard/${props.saveId}/players/${player.playerId}`}
                className="text-amber-400 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
              >
                {player.firstName} {player.lastName}
              </Link>
            </td>
            <td className="px-3 py-2 text-zinc-400">{player.position}</td>
            <td className="px-3 py-2 text-zinc-400">{player.age}</td>
            <td className="px-3 py-2 text-zinc-200">{player.overall}</td>
            <td className="px-3 py-2">
              <ContractSummary
                salary={player.contractSalary}
                endYear={player.contractEndYear}
                yearsRemaining={player.contractYearsRemaining}
              />
            </td>
            <td className="px-3 py-2">
              <StatusBadge
                label={player.injuryKind}
                tone={player.injuryKind}
              />
            </td>
            <td className="px-3 py-2 text-zinc-400">
              {player.developmentStage}
            </td>
          </tr>
        ))}
      </DataTable>
    </div>
  );
}
