"use client";

import { Select } from "@/components/ui/Select";
import { useMemo, useState } from "react";
import { cn, focusRingClass } from "@/components/ui/styles";
import type { RosterPlayerView } from "@/state/selectors";
import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { ContractSummary } from "@/components/owner/ContractSummary";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";

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
        <label className="flex flex-col gap-1 text-sm text-faint">
          Filter
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, position, status…"
            className={cn(
              "rounded-md border border-line-strong bg-surface-raised px-3 py-2 text-sm text-ink",
              focusRingClass,
            )}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-faint">
          Sort by
          <Select
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value as SortKey)}
          >
            <option value="overall">Overall</option>
            <option value="name">Name</option>
            <option value="position">Position</option>
            <option value="age">Age</option>
            <option value="status">Status</option>
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-faint">
          Direction
          <Select
            value={sortDir}
            onChange={(event) =>
              setSortDir(event.target.value as "asc" | "desc")
            }
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </Select>
        </label>
      </div>

      <DataTable
        headers={["Player", "Pos", "Age", "OVR", "Contract", "Status", "Dev"]}
      >
        {filtered.map((player) => (
          <tr key={player.playerId} className="border-t border-line">
            <td className="px-3 py-2">
              <PlayerEntityLink
                saveId={props.saveId}
                playerId={player.playerId}
              >
                {player.firstName} {player.lastName}
              </PlayerEntityLink>
            </td>
            <td className="px-3 py-2 text-muted">{player.position}</td>
            <td className="px-3 py-2 text-muted">{player.age}</td>
            <td className="px-3 py-2 text-ink">{player.overall}</td>
            <td className="px-3 py-2">
              <ContractSummary
                salary={player.contractSalary}
                endYear={player.contractEndYear}
                yearsRemaining={player.contractYearsRemaining}
              />
            </td>
            <td className="px-3 py-2">
              <StatusBadge label={player.injuryKind} tone={player.injuryKind} />
            </td>
            <td className="px-3 py-2 text-muted">{player.developmentStage}</td>
          </tr>
        ))}
      </DataTable>
    </div>
  );
}
