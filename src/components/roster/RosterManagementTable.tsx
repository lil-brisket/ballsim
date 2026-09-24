"use client";

import { useMemo, useState } from "react";
import type { PlayerPosition } from "@/domain/entities/player";
import { PLAYER_POSITIONS } from "@/domain/entities/player";
import type { RosterPagePlayerView } from "@/state/roster-page-selectors";
import { rotationRoleSortKey } from "@/state/roster-page-selectors";
import { toggleTradeBlockAction } from "@/application/actions";
import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { ContractSummary } from "@/components/owner/ContractSummary";
import { DataTable } from "@/components/owner/DataTable";
import { StatusBadge } from "@/components/owner/StatusBadge";
import { cn, focusRingClass } from "@/components/ui/styles";

type SortKey =
  | "overall"
  | "age"
  | "salary"
  | "years"
  | "position"
  | "role"
  | "name";

type FilterChip =
  | "all"
  | PlayerPosition
  | "starters"
  | "injured"
  | "on_block";

const POSITION_ORDER = Object.fromEntries(
  PLAYER_POSITIONS.map((position, index) => [position, index]),
) as Record<string, number>;

function defaultCompare(
  a: RosterPagePlayerView,
  b: RosterPagePlayerView,
): number {
  if (b.overall !== a.overall) {
    return b.overall - a.overall;
  }
  const roleCmp =
    rotationRoleSortKey(a.rotationRole) - rotationRoleSortKey(b.rotationRole);
  if (roleCmp !== 0) {
    return roleCmp;
  }
  const posCmp =
    (POSITION_ORDER[a.primaryPosition] ?? 99) -
    (POSITION_ORDER[b.primaryPosition] ?? 99);
  if (posCmp !== 0) {
    return posCmp;
  }
  return a.lastName.localeCompare(b.lastName);
}

export function RosterManagementTable(props: {
  saveId: string;
  players: RosterPagePlayerView[];
  returnPath: string;
}) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("overall");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [chip, setChip] = useState<FilterChip>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = props.players;

    if (chip === "starters") {
      rows = rows.filter((player) => player.rotationRole === "starter");
    } else if (chip === "injured") {
      rows = rows.filter((player) => !player.canPlay);
    } else if (chip === "on_block") {
      rows = rows.filter((player) => player.onTradeBlock);
    } else if (chip !== "all") {
      rows = rows.filter((player) => player.primaryPosition === chip);
    }

    if (q) {
      rows = rows.filter((player) => {
        const name = `${player.firstName} ${player.lastName}`.toLowerCase();
        return (
          name.includes(q) ||
          player.position.toLowerCase().includes(q) ||
          player.roleDisplayLabel.toLowerCase().includes(q) ||
          player.injuryKind.toLowerCase().includes(q)
        );
      });
    }

    const sorted = [...rows].sort((a, b) => {
      if (sortKey === "overall" && sortDir === "desc") {
        // Preserve full default secondary keys when sorting by OVR desc
        return defaultCompare(a, b);
      }
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = `${a.lastName}${a.firstName}`.localeCompare(
            `${b.lastName}${b.firstName}`,
          );
          break;
        case "position":
          cmp =
            (POSITION_ORDER[a.primaryPosition] ?? 99) -
            (POSITION_ORDER[b.primaryPosition] ?? 99);
          break;
        case "age":
          cmp = a.age - b.age;
          break;
        case "overall":
          cmp = a.overall - b.overall;
          break;
        case "salary":
          cmp = (a.contractSalary ?? 0) - (b.contractSalary ?? 0);
          break;
        case "years":
          cmp =
            (a.contractYearsRemaining ?? 0) - (b.contractYearsRemaining ?? 0);
          break;
        case "role":
          cmp =
            rotationRoleSortKey(a.rotationRole) -
            rotationRoleSortKey(b.rotationRole);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [props.players, query, sortKey, sortDir, chip]);

  const chips: { id: FilterChip; label: string }[] = [
    { id: "all", label: "All" },
    ...PLAYER_POSITIONS.map((position) => ({
      id: position as FilterChip,
      label: position,
    })),
    { id: "starters", label: "Starters" },
    { id: "injured", label: "Injured" },
    { id: "on_block", label: "On Block" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Roster filters">
        {chips.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setChip(entry.id)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs",
              focusRingClass,
              chip === entry.id
                ? "bg-amber-600/20 text-amber-300"
                : "border border-zinc-700 text-zinc-400 hover:border-zinc-500",
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Filter
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, role, status…"
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
            <option value="salary">Salary</option>
            <option value="years">Years remaining</option>
            <option value="role">Role</option>
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

      <div className="overflow-x-auto">
        <DataTable
          headers={[
            "Player",
            "Pos",
            "OVR",
            "Age",
            "Role",
            "Contract",
            "Years",
            "Status",
            "Actions",
          ]}
        >
          {filtered.map((player) => {
            const expiring =
              player.contractYearsRemaining != null &&
              player.contractYearsRemaining <= 1;
            return (
              <tr key={player.playerId} className="border-t border-zinc-800">
                <td className="px-3 py-2">
                  <PlayerEntityLink
                    saveId={props.saveId}
                    playerId={player.playerId}
                  >
                    {player.firstName} {player.lastName}
                  </PlayerEntityLink>
                  {player.onTradeBlock ? (
                    <span className="ml-2 font-mono text-[0.6rem] uppercase text-amber-500">
                      Block
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-zinc-400">{player.position}</td>
                <td className="px-3 py-2 text-zinc-200">{player.overall}</td>
                <td className="hidden px-3 py-2 text-zinc-400 sm:table-cell">
                  {player.age}
                </td>
                <td className="hidden px-3 py-2 text-zinc-400 md:table-cell">
                  {player.roleDisplayLabel}
                  {player.depthSlot ? (
                    <span className="ml-1 font-mono text-[0.6rem] text-zinc-600">
                      ({player.depthSlot})
                    </span>
                  ) : null}
                </td>
                <td className="hidden px-3 py-2 lg:table-cell">
                  <ContractSummary
                    salary={player.contractSalary}
                    endYear={player.contractEndYear}
                    yearsRemaining={player.contractYearsRemaining}
                  />
                  {expiring && player.contractEndYear != null ? (
                    <span className="mt-0.5 block font-mono text-[0.6rem] uppercase text-amber-400">
                      {player.contractEndYear} expiring
                    </span>
                  ) : null}
                </td>
                <td className="hidden px-3 py-2 text-zinc-400 xl:table-cell">
                  {player.contractYearsRemaining ?? "—"}
                </td>
                <td className="px-3 py-2">
                  <StatusBadge
                    label={player.availabilityLabel}
                    tone={player.canPlay ? "available" : player.injuryKind}
                  />
                </td>
                <td className="px-3 py-2">
                  <form action={toggleTradeBlockAction}>
                    <input type="hidden" name="saveId" value={props.saveId} />
                    <input
                      type="hidden"
                      name="playerId"
                      value={player.playerId}
                    />
                    <input
                      type="hidden"
                      name="listed"
                      value={player.onTradeBlock ? "false" : "true"}
                    />
                    <input
                      type="hidden"
                      name="returnPath"
                      value={props.returnPath}
                    />
                    <button
                      type="submit"
                      className={cn(
                        "text-xs text-amber-400 hover:text-amber-300",
                        focusRingClass,
                      )}
                    >
                      {player.onTradeBlock ? "Remove block" : "Add to block"}
                    </button>
                  </form>
                </td>
              </tr>
            );
          })}
        </DataTable>
      </div>
    </div>
  );
}
