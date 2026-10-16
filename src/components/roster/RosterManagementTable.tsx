"use client";

import { useMemo, useState } from "react";
import type { PlayerPosition } from "@/domain/entities/player";
import { PLAYER_POSITIONS } from "@/domain/entities/player";
import type { RosterPagePlayerView } from "@/state/roster-page-selectors";
import { rotationRoleSortKey } from "@/state/roster-page-selectors";
import { PlayerPortrait } from "@/components/basketball/PlayerPortrait";
import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { ContractSummary } from "@/components/owner/ContractSummary";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PlayerActionMenu } from "@/components/roster/PlayerActionMenu";
import { RosterCard } from "@/components/roster/RosterCard";
import { MobileListCard } from "@/components/ui/MobileListCard";
import {
  cn,
  focusRingClass,
  touchTargetClass,
  touchTargetTextClass,
} from "@/components/ui/styles";
import { ratingTier } from "@/presentation/rating-tier";

type SortKey =
  "overall" | "age" | "salary" | "years" | "position" | "role" | "name";

type FilterChip = "all" | PlayerPosition | "starters" | "injured" | "on_block";

type RosterView = "cards" | "table";

const POSITION_ORDER = Object.fromEntries(
  PLAYER_POSITIONS.map((position, index) => [position, index]),
) as Record<string, number>;

const controlClass = cn(
  "min-h-11 rounded-md border border-surface-line bg-surface-arena px-3 text-sm text-zinc-100",
  focusRingClass,
);

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
  // Phones always get the compact list; the toggle only appears from md up.
  const [view, setView] = useState<RosterView>("cards");

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

  const viewOptions: { id: RosterView; label: string }[] = [
    { id: "cards", label: "Cards" },
    { id: "table", label: "Table" },
  ];

  return (
    <div className="space-y-4">
      {/* One compact toolbar: position chips, then search / sort / view. */}
      <div className="space-y-3 rounded-xl border border-surface-line bg-surface-arena p-3">
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Roster filters"
        >
          {chips.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setChip(entry.id)}
              aria-pressed={chip === entry.id}
              className={cn(
                touchTargetClass,
                "rounded-md px-2.5 text-xs",
                focusRingClass,
                chip === entry.id
                  ? "bg-team text-on-team font-semibold"
                  : "border border-surface-line text-zinc-300 hover:border-team-ink",
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="min-w-40 flex-1">
            <span className="sr-only">Filter</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter by name, role, status…"
              className={cn(controlClass, "w-full")}
            />
          </label>
          <label>
            <span className="sr-only">Sort by</span>
            <select
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as SortKey)}
              className={controlClass}
            >
              <option value="overall">Sort: Overall</option>
              <option value="name">Sort: Name</option>
              <option value="position">Sort: Position</option>
              <option value="age">Sort: Age</option>
              <option value="salary">Sort: Salary</option>
              <option value="years">Sort: Years remaining</option>
              <option value="role">Sort: Role</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() =>
              setSortDir((value) => (value === "desc" ? "asc" : "desc"))
            }
            aria-label={
              sortDir === "desc"
                ? "Sort direction: descending"
                : "Sort direction: ascending"
            }
            className={cn(controlClass, "min-w-11 text-center")}
          >
            <span aria-hidden>{sortDir === "desc" ? "↓" : "↑"}</span>
          </button>

          <div
            role="group"
            aria-label="Roster view"
            className="ml-auto hidden overflow-hidden rounded-md border border-surface-line md:flex"
          >
            {viewOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={view === option.id}
                onClick={() => setView(option.id)}
                className={cn(
                  touchTargetClass,
                  "px-3 text-xs",
                  focusRingClass,
                  view === option.id
                    ? "bg-team text-on-team font-semibold"
                    : "text-zinc-300 hover:text-team-ink",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Phones: compact list in both views. */}
      <ul className="flex flex-col gap-2 md:hidden">
        {filtered.map((player) => {
          const name = `${player.firstName} ${player.lastName}`;
          return (
            <li key={player.playerId} data-tier={ratingTier(player.overall).id}>
              <MobileListCard
                title={
                  <span className="flex items-center gap-2">
                    <PlayerPortrait
                      playerId={player.playerId}
                      portrait={player.portrait}
                      firstName={player.firstName}
                      lastName={player.lastName}
                      size="sm"
                    />
                    <PlayerEntityLink
                      saveId={props.saveId}
                      playerId={player.playerId}
                      className={cn(
                        touchTargetTextClass,
                        "px-0 text-team-ink",
                        focusRingClass,
                      )}
                    >
                      {name}
                    </PlayerEntityLink>
                  </span>
                }
                subtitle={`${player.position} · ${player.roleDisplayLabel} · Age ${player.age}`}
                meta={
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-xl font-bold tabular-nums text-tier">
                      {player.overall}
                    </span>
                    <StatusBadge
                      label={player.availabilityLabel}
                      tone={player.canPlay ? "available" : player.injuryKind}
                    />
                    {player.onTradeBlock ? (
                      <span className="font-mono text-[0.6rem] uppercase text-team-ink">
                        Block
                      </span>
                    ) : null}
                  </div>
                }
                action={
                  <PlayerActionMenu
                    saveId={props.saveId}
                    playerId={player.playerId}
                    playerName={name}
                    onTradeBlock={player.onTradeBlock}
                    returnPath={props.returnPath}
                  />
                }
              />
            </li>
          );
        })}
      </ul>

      {view === "cards" ? (
        <ul className="hidden gap-3 md:grid md:grid-cols-2 2xl:grid-cols-3">
          {filtered.map((player, index) => (
            <li
              key={player.playerId}
              className="enter-up"
              style={{ "--i": Math.min(index, 8) } as React.CSSProperties}
            >
              <RosterCard
                saveId={props.saveId}
                player={player}
                returnPath={props.returnPath}
              />
            </li>
          ))}
        </ul>
      ) : (
        <div className="hidden overflow-x-auto md:block">
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
              const name = `${player.firstName} ${player.lastName}`;
              return (
                <tr
                  key={player.playerId}
                  data-tier={ratingTier(player.overall).id}
                  className="border-t border-zinc-800"
                >
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-2">
                      <PlayerPortrait
                        playerId={player.playerId}
                        portrait={player.portrait}
                        firstName={player.firstName}
                        lastName={player.lastName}
                        size="sm"
                      />
                      <PlayerEntityLink
                        saveId={props.saveId}
                        playerId={player.playerId}
                      >
                        {name}
                      </PlayerEntityLink>
                    </span>
                    {player.onTradeBlock ? (
                      <span className="ml-2 font-mono text-[0.6rem] uppercase text-team-ink">
                        Block
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-zinc-400">{player.position}</td>
                  <td className="px-3 py-2 font-display text-lg font-bold tabular-nums text-tier">
                    {player.overall}
                  </td>
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
                      <span className="mt-0.5 block font-mono text-[0.6rem] uppercase text-warning">
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
                    <PlayerActionMenu
                      saveId={props.saveId}
                      playerId={player.playerId}
                      playerName={name}
                      onTradeBlock={player.onTradeBlock}
                      returnPath={props.returnPath}
                    />
                  </td>
                </tr>
              );
            })}
          </DataTable>
        </div>
      )}
    </div>
  );
}
