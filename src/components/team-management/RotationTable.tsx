"use client";

import { useMemo, useState } from "react";
import { DataTable } from "@/components/owner/DataTable";
import { SortableTableControls } from "@/components/owner/SortableTableControls";
import {
  RotationPlayerCard,
  type RotationPlayerCardData,
} from "@/components/team-management/RotationPlayerCard";
import { RotationQuarterVisualization } from "@/components/team-management/RotationQuarterVisualization";
import type { EditableRotationRow } from "@/state/lineup-rotation-editor";
import { rotationGroupLabel } from "@/state/lineup-rotation-editor";

type SortKey =
  | "name"
  | "position"
  | "planned"
  | "role"
  | "priority"
  | "status";

const ROLE_OPTIONS = [
  "starter",
  "sixth_man",
  "rotation",
  "bench",
  "deep_bench",
  "emergency",
] as const;

function rowTone(role: string, groupRole: string): string {
  if (groupRole === "inactive" || role === "inactive") {
    return "opacity-50";
  }
  if (role === "starter") {
    return "bg-amber-950/30";
  }
  if (role === "sixth_man" || role === "rotation") {
    return "bg-zinc-900/80";
  }
  if (role === "deep_bench" || role === "emergency") {
    return "text-zinc-500";
  }
  return "";
}

function statusIndicator(status: string): { emoji: string; label: string } {
  switch (status) {
    case "available":
      return { emoji: "🟢", label: "Available" };
    case "questionable":
      return { emoji: "🟡", label: "Questionable" };
    case "limited":
      return { emoji: "🟠", label: "Limited" };
    case "out":
      return { emoji: "🔴", label: "Out" };
    case "suspended":
      return { emoji: "🔴", label: "Suspended" };
    default:
      return { emoji: "⚪", label: status };
  }
}

function GroupTable(props: {
  title: string;
  rows: EditableRotationRow[];
  onUpdate: (playerId: string, patch: Partial<EditableRotationRow>) => void;
  onSelect: (playerId: string) => void;
}) {
  if (props.rows.length === 0) {
    return null;
  }
  return (
    <div className="space-y-2">
      <h3 className="font-mono text-xs uppercase tracking-wide text-zinc-500">
        {props.title}
      </h3>
      <DataTable
        headers={[
          "Player",
          "Pos",
          "Role",
          "Target MPG",
          "Priority",
          "Play/Usage",
          "Status",
        ]}
      >
        {props.rows.map((row) => {
          const status = statusIndicator(row.availabilityStatus);
          const inactive = row.groupRole === "inactive";
          return (
            <tr
              key={row.playerId}
              className={`border-t border-zinc-800 ${rowTone(row.role, row.groupRole)}`}
            >
              <td className="px-3 py-2">
                <button
                  type="button"
                  onClick={() => props.onSelect(row.playerId)}
                  className="text-left text-zinc-100 hover:text-amber-300 hover:underline"
                >
                  {row.firstName} {row.lastName}
                </button>
                {row.workloadWarning ? (
                  <p className="mt-0.5 text-[10px] text-orange-400">
                    {row.workloadWarning}
                  </p>
                ) : null}
              </td>
              <td className="px-3 py-2 font-mono text-zinc-400">
                {row.position}
              </td>
              <td className="px-3 py-2">
                {inactive ? (
                  <span className="capitalize text-zinc-500">inactive</span>
                ) : (
                  <select
                    value={row.role}
                    onChange={(event) =>
                      props.onUpdate(row.playerId, {
                        role: event.target.value,
                      })
                    }
                    className="rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-xs text-zinc-100"
                  >
                    {ROLE_OPTIONS.map((role) => (
                      <option key={role} value={role}>
                        {role.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                )}
              </td>
              <td className="px-3 py-2">
                {inactive ? (
                  <span className="text-zinc-500">0</span>
                ) : (
                  <input
                    type="number"
                    min={0}
                    max={48}
                    value={row.targetMinutes}
                    onChange={(event) =>
                      props.onUpdate(row.playerId, {
                        targetMinutes: Number(event.target.value),
                        projectedMinutes: Number(event.target.value),
                      })
                    }
                    className="w-14 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-sm text-zinc-100"
                  />
                )}
              </td>
              <td className="px-3 py-2">
                {inactive ? (
                  "—"
                ) : (
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={row.rotationPriority}
                    onChange={(event) =>
                      props.onUpdate(row.playerId, {
                        rotationPriority: Number(event.target.value),
                      })
                    }
                    className="w-10 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-sm text-zinc-100"
                  />
                )}
              </td>
              <td className="px-3 py-2">
                {inactive ? (
                  "—"
                ) : (
                  <select
                    value={row.minutePriorityBias}
                    onChange={(event) =>
                      props.onUpdate(row.playerId, {
                        minutePriorityBias: Number(event.target.value),
                      })
                    }
                    className="rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-xs text-zinc-100"
                  >
                    <option value={-1}>Less</option>
                    <option value={0}>Normal</option>
                    <option value={1}>More</option>
                  </select>
                )}
              </td>
              <td className="px-3 py-2 text-sm text-zinc-300">
                <span title={row.availabilityLabel}>
                  {status.emoji} {status.label}
                </span>
              </td>
            </tr>
          );
        })}
      </DataTable>
    </div>
  );
}

export function RotationTable(props: {
  rows: EditableRotationRow[];
  teamName: string;
  onUpdate: (playerId: string, patch: Partial<EditableRotationRow>) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("planned");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(
    null,
  );

  const sorted = useMemo(() => {
    return [...props.rows].sort((a, b) => {
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
        case "planned":
          cmp = a.targetMinutes - b.targetMinutes;
          break;
        case "role":
          cmp = a.role.localeCompare(b.role);
          break;
        case "priority":
          cmp = a.rotationPriority - b.rotationPriority;
          break;
        case "status":
          cmp = a.availabilityLabel.localeCompare(b.availabilityLabel);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [props.rows, sortKey, sortDir]);

  const core = sorted.filter((r) => rotationGroupLabel(r) === "core");
  const depth = sorted.filter((r) => rotationGroupLabel(r) === "depth");
  const inactive = sorted.filter((r) => rotationGroupLabel(r) === "inactive");
  const editableRows = props.rows.filter((r) => r.groupRole !== "inactive");

  const selectedPlayer = useMemo(() => {
    if (selectedPlayerId == null) return null;
    const row = props.rows.find((item) => item.playerId === selectedPlayerId);
    if (row == null) return null;
    const card: RotationPlayerCardData = {
      playerId: row.playerId,
      firstName: row.firstName,
      lastName: row.lastName,
      position: row.position,
      age: row.age,
      overall: row.overall,
      teamName: row.teamName ?? props.teamName,
      role: row.role,
      availabilityStatus: row.availabilityStatus,
      injuryType: row.injuryType,
      injurySeverity: row.injurySeverity,
      recommendedWorkloadMpg: row.recommendedWorkloadMpg,
      maximumWorkloadMpg: row.maximumWorkloadMpg,
      gamesRemaining: row.gamesRemaining,
      isLegacyUndisclosed: row.isLegacyUndisclosed,
      targetMinutes: row.targetMinutes,
      projectedMinutes: row.projectedMinutes,
      actualMinutes: row.actualMinutes,
      priority: row.rotationPriority,
      minutePriorityBias: row.minutePriorityBias,
      seasonStats: row.seasonStats,
    };
    return card;
  }, [props.rows, selectedPlayerId, props.teamName]);

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
        Rotation
      </h2>
      <SortableTableControls
        sortKey={sortKey}
        sortDir={sortDir}
        onSortKeyChange={setSortKey}
        onSortDirChange={setSortDir}
        options={[
          { value: "planned", label: "Target MPG" },
          { value: "priority", label: "Priority" },
          { value: "name", label: "Name" },
          { value: "position", label: "Position" },
          { value: "role", label: "Role" },
          { value: "status", label: "Status" },
        ]}
      />
      <GroupTable
        title="Core rotation"
        rows={core}
        onUpdate={props.onUpdate}
        onSelect={setSelectedPlayerId}
      />
      <GroupTable
        title="Depth"
        rows={depth}
        onUpdate={props.onUpdate}
        onSelect={setSelectedPlayerId}
      />
      <GroupTable
        title="Inactive"
        rows={inactive}
        onUpdate={props.onUpdate}
        onSelect={setSelectedPlayerId}
      />
      <RotationQuarterVisualization
        players={editableRows.map((row) => ({
          playerId: row.playerId,
          firstName: row.firstName,
          lastName: row.lastName,
          role: row.role,
          targetMinutes: row.targetMinutes,
        }))}
      />
      {selectedPlayer ? (
        <RotationPlayerCard
          player={selectedPlayer}
          onClose={() => setSelectedPlayerId(null)}
        />
      ) : null}
    </section>
  );
}
