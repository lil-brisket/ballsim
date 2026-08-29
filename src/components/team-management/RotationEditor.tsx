"use client";

import { useMemo, useState } from "react";
import {
  optimizeRotationAction,
  updateRotationAction,
} from "@/application/actions";
import type { RotationView } from "@/state/team-management-selectors";
import { DataTable } from "@/components/owner/DataTable";
import { StatusBadge } from "@/components/owner/StatusBadge";
import { SortableTableControls } from "@/components/owner/SortableTableControls";

type SortKey =
  | "name"
  | "position"
  | "planned"
  | "actual"
  | "role"
  | "priority"
  | "status";

const PRESETS = [
  { id: "auto", label: "Auto" },
  { id: "balanced", label: "Balanced" },
  { id: "star_heavy", label: "Star Heavy" },
  { id: "deep", label: "Deep Rotation" },
  { id: "development", label: "Development" },
  { id: "custom", label: "Custom" },
] as const;

const ROLE_OPTIONS = [
  "starter",
  "sixth_man",
  "rotation",
  "bench",
  "deep_bench",
  "emergency",
] as const;

function rowTone(role: string, status: string): string {
  if (status === "inactive" || role === "inactive") {
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

export function RotationEditor(props: {
  saveId: string;
  rotation: RotationView;
}) {
  const returnPath = `/dashboard/${props.saveId}/team-management/rotations`;
  const [rows, setRows] = useState(
    props.rotation.rows.map((row) => ({
      playerId: row.playerId,
      targetMinutes: row.targetMinutes,
      minimumMinutes: row.minimumMinutes,
      normalMaximumMinutes: row.normalMaximumMinutes,
      absoluteMaximumMinutes: row.absoluteMaximumMinutes,
      rotationPriority: row.rotationPriority,
      rotationStatus: row.rotationStatus,
      role: row.rotationRole,
      preferredPositions: row.preferredPositions,
      secondaryPositions: row.secondaryPositions,
      minutePriorityBias: row.minutePriorityBias,
      groupRole: row.role,
      firstName: row.firstName,
      lastName: row.lastName,
      position: row.position,
      actualMinutes: row.actualMinutes,
      availabilityLabel: row.availabilityLabel,
    })),
  );
  const [preset, setPreset] = useState(props.rotation.rotationPreset);
  const [closingPolicy, setClosingPolicy] = useState(
    props.rotation.closingLineupPolicy,
  );
  const [closingIds, setClosingIds] = useState<string[]>(
    props.rotation.closingLineupIds,
  );
  const [sortKey, setSortKey] = useState<SortKey>("planned");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const editableRows = rows.filter((row) => row.groupRole !== "inactive");
  const totalPlanned = editableRows.reduce(
    (sum, row) => sum + row.targetMinutes,
    0,
  );
  const delta = totalPlanned - props.rotation.target;

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
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
        case "actual":
          cmp = a.actualMinutes - b.actualMinutes;
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
  }, [rows, sortKey, sortDir]);

  const rotationPayload = editableRows.map((row) => ({
    playerId: row.playerId,
    targetMinutes: row.targetMinutes,
    minimumMinutes: row.minimumMinutes,
    normalMaximumMinutes: row.normalMaximumMinutes,
    absoluteMaximumMinutes: row.absoluteMaximumMinutes,
    rotationPriority: row.rotationPriority,
    rotationStatus: row.rotationStatus,
    role: row.role,
    preferredPositions: row.preferredPositions,
    secondaryPositions: row.secondaryPositions,
    minutePriorityBias: row.minutePriorityBias,
  }));

  const updateRow = (
    playerId: string,
    patch: Partial<(typeof rows)[number]>,
  ) => {
    setRows((current) =>
      current.map((row) =>
        row.playerId === playerId ? { ...row, ...patch } : row,
      ),
    );
    setPreset("custom");
  };

  return (
    <div className="space-y-4">
      {props.rotation.feasibilityBanner ? (
        <div className="rounded-lg border border-rose-700 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
          {props.rotation.feasibilityBanner}
        </div>
      ) : null}

      <div className="sticky top-0 z-10 space-y-3 rounded-lg border border-zinc-700 bg-zinc-950/95 px-4 py-3 backdrop-blur">
        <p className="text-sm text-zinc-200">
          Target minutes:{" "}
          <span className="font-semibold text-amber-400">
            {totalPlanned} / {props.rotation.target}
          </span>{" "}
          <span className={delta === 0 ? "text-emerald-400" : "text-rose-400"}>
            (Δ {delta > 0 ? `+${delta}` : delta})
          </span>
          <span className="ml-3 text-zinc-500">
            Depth {props.rotation.rotationDepth} ·{" "}
            {props.rotation.rotationPhilosophy}
          </span>
        </p>
        <ul className="text-xs text-zinc-500">
          {props.rotation.feedback.map((item) => (
            <li key={`${item.kind}-${item.message}`}>{item.message}</li>
          ))}
        </ul>

        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-zinc-400">
            Preset
            <select
              value={preset}
              onChange={(event) => setPreset(event.target.value)}
              className="ml-2 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
            >
              {PRESETS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <form action={optimizeRotationAction}>
            <input type="hidden" name="saveId" value={props.saveId} />
            <input type="hidden" name="teamId" value={props.rotation.teamId} />
            <input type="hidden" name="returnPath" value={returnPath} />
            <input type="hidden" name="rotationPreset" value={preset} />
            <button
              type="submit"
              className="rounded-md border border-amber-700 px-3 py-1.5 text-sm text-amber-300 hover:bg-amber-950"
            >
              Auto Optimize
            </button>
          </form>
          <label className="text-xs text-zinc-400">
            Closing lineup
            <select
              value={closingPolicy}
              onChange={(event) => setClosingPolicy(event.target.value)}
              className="ml-2 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
            >
              <option value="auto">Auto</option>
              <option value="starters">Use starters</option>
              <option value="custom">Custom</option>
            </select>
          </label>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
        <h3 className="text-sm font-medium text-zinc-200">Projected Rotation</h3>
        <ul className="mt-2 grid gap-1 text-sm text-zinc-400 sm:grid-cols-2">
          {props.rotation.previewBands.map((band) => (
            <li key={band.label}>
              {band.label} — {band.minMinutes}–{band.maxMinutes} MIN
            </li>
          ))}
        </ul>
        <div className="mt-3 grid grid-cols-4 gap-2 text-center text-[10px] uppercase tracking-wide text-zinc-500">
          {["Q1", "Q2", "Q3", "Q4"].map((quarter) => (
            <div key={quarter}>
              <div>{quarter}</div>
              <div className="mt-1 h-2 rounded bg-gradient-to-r from-amber-700 via-zinc-600 to-amber-800" />
            </div>
          ))}
        </div>
      </div>

      <SortableTableControls
        sortKey={sortKey}
        sortDir={sortDir}
        onSortKeyChange={setSortKey}
        onSortDirChange={setSortDir}
        options={[
          { value: "planned", label: "Target" },
          { value: "priority", label: "Priority" },
          { value: "actual", label: "Actual" },
          { value: "name", label: "Name" },
          { value: "position", label: "Position" },
          { value: "role", label: "Role" },
          { value: "status", label: "Status" },
        ]}
      />

      <DataTable
        headers={[
          "Player",
          "Pos",
          "Role",
          "Target",
          "Min",
          "NMax",
          "AMax",
          "Pri",
          "Play",
          "Actual",
          "Status",
        ]}
      >
        {sorted.map((row) => (
          <tr
            key={row.playerId}
            className={`border-t border-zinc-800 ${rowTone(row.role, row.groupRole)}`}
          >
            <td className="px-3 py-2 text-zinc-100">
              {row.firstName} {row.lastName}
            </td>
            <td className="px-3 py-2 font-mono text-zinc-400">{row.position}</td>
            <td className="px-3 py-2">
              {row.groupRole === "inactive" ? (
                <span className="capitalize text-zinc-500">inactive</span>
              ) : (
                <select
                  value={row.role}
                  onChange={(event) =>
                    updateRow(row.playerId, { role: event.target.value })
                  }
                  className="rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-xs text-zinc-100"
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              )}
            </td>
            <td className="px-3 py-2">
              {row.groupRole === "inactive" ? (
                <span className="text-zinc-500">0</span>
              ) : (
                <input
                  type="number"
                  min={0}
                  max={48}
                  value={row.targetMinutes}
                  onChange={(event) =>
                    updateRow(row.playerId, {
                      targetMinutes: Number(event.target.value),
                    })
                  }
                  className="w-14 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-sm text-zinc-100"
                />
              )}
            </td>
            <td className="px-3 py-2">
              {row.groupRole === "inactive" ? (
                "—"
              ) : (
                <input
                  type="number"
                  min={0}
                  max={48}
                  value={row.minimumMinutes}
                  onChange={(event) =>
                    updateRow(row.playerId, {
                      minimumMinutes: Number(event.target.value),
                    })
                  }
                  className="w-12 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-sm text-zinc-100"
                />
              )}
            </td>
            <td className="px-3 py-2">
              {row.groupRole === "inactive" ? (
                "—"
              ) : (
                <input
                  type="number"
                  min={0}
                  max={48}
                  value={row.normalMaximumMinutes}
                  onChange={(event) =>
                    updateRow(row.playerId, {
                      normalMaximumMinutes: Number(event.target.value),
                    })
                  }
                  className="w-12 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-sm text-zinc-100"
                />
              )}
            </td>
            <td className="px-3 py-2">
              {row.groupRole === "inactive" ? (
                "—"
              ) : (
                <input
                  type="number"
                  min={0}
                  max={48}
                  value={row.absoluteMaximumMinutes}
                  onChange={(event) =>
                    updateRow(row.playerId, {
                      absoluteMaximumMinutes: Number(event.target.value),
                    })
                  }
                  className="w-12 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-sm text-zinc-100"
                />
              )}
            </td>
            <td className="px-3 py-2">
              {row.groupRole === "inactive" ? (
                "—"
              ) : (
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={row.rotationPriority}
                  onChange={(event) =>
                    updateRow(row.playerId, {
                      rotationPriority: Number(event.target.value),
                    })
                  }
                  className="w-10 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-sm text-zinc-100"
                />
              )}
            </td>
            <td className="px-3 py-2">
              {row.groupRole === "inactive" ? (
                "—"
              ) : (
                <select
                  value={row.minutePriorityBias}
                  onChange={(event) =>
                    updateRow(row.playerId, {
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
            <td className="px-3 py-2 text-zinc-400">{row.actualMinutes}</td>
            <td className="px-3 py-2">
              <StatusBadge label={row.availabilityLabel} />
            </td>
          </tr>
        ))}
      </DataTable>

      {closingPolicy === "custom" ? (
        <div className="rounded-lg border border-zinc-800 p-3 text-sm text-zinc-300">
          <p className="mb-2 text-xs text-zinc-500">
            Select up to 5 closing players
          </p>
          <div className="flex flex-wrap gap-2">
            {editableRows.map((row) => {
              const selected = closingIds.includes(row.playerId);
              return (
                <button
                  key={row.playerId}
                  type="button"
                  onClick={() => {
                    setClosingIds((current) => {
                      if (current.includes(row.playerId)) {
                        return current.filter((id) => id !== row.playerId);
                      }
                      if (current.length >= 5) {
                        return current;
                      }
                      return [...current, row.playerId];
                    });
                  }}
                  className={`rounded px-2 py-1 text-xs ${
                    selected
                      ? "bg-amber-700 text-zinc-950"
                      : "bg-zinc-800 text-zinc-300"
                  }`}
                >
                  {row.lastName}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <form action={updateRotationAction}>
        <input type="hidden" name="saveId" value={props.saveId} />
        <input type="hidden" name="teamId" value={props.rotation.teamId} />
        <input type="hidden" name="returnPath" value={returnPath} />
        <input
          type="hidden"
          name="rotationStyle"
          value={props.rotation.rotationStyle}
        />
        <input
          type="hidden"
          name="rotationPhilosophy"
          value={props.rotation.rotationPhilosophy}
        />
        <input
          type="hidden"
          name="rotationDepth"
          value={String(props.rotation.rotationDepth)}
        />
        <input type="hidden" name="rotationPreset" value={preset} />
        <input type="hidden" name="closingLineupPolicy" value={closingPolicy} />
        <input
          type="hidden"
          name="closingLineupJson"
          value={JSON.stringify(closingIds)}
        />
        <input
          type="hidden"
          name="rotationJson"
          value={JSON.stringify(rotationPayload)}
        />
        <button
          type="submit"
          className="rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-500"
        >
          Save rotation
        </button>
      </form>
    </div>
  );
}
