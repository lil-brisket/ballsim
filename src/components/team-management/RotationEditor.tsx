"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  optimizeRotationAction,
  updateRotationAction,
} from "@/application/actions";
import type { RotationView } from "@/state/team-management-selectors";
import { DataTable } from "@/components/owner/DataTable";
import { SortableTableControls } from "@/components/owner/SortableTableControls";
import {
  RotationPlayerCard,
  type RotationPlayerCardData,
} from "@/components/team-management/RotationPlayerCard";
import { RotationQuarterVisualization } from "@/components/team-management/RotationQuarterVisualization";

type SortKey =
  | "name"
  | "position"
  | "planned"
  | "role"
  | "priority"
  | "status";

type EditableRow = {
  playerId: string;
  targetMinutes: number;
  rotationPriority: number;
  rotationStatus: string;
  role: string;
  preferredPositions: string[];
  secondaryPositions: string[];
  minutePriorityBias: number;
  overrideMedicalRecommendation: boolean;
  groupRole: string;
  firstName: string;
  lastName: string;
  position: string;
  age?: number;
  overall?: number;
  teamName?: string;
  actualMinutes: number;
  projectedMinutes: number;
  availabilityStatus: string;
  availabilityLabel: string;
  injuryType?: string | null;
  injurySeverity?: string | null;
  recommendedWorkloadMpg?: number | null;
  maximumWorkloadMpg?: number | null;
  gamesRemaining?: { min: number; max: number } | null;
  isLegacyUndisclosed?: boolean;
  workloadWarning?: string | null;
  seasonStats?: RotationPlayerCardData["seasonStats"];
};

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

function mapRowsFromView(rotation: RotationView): EditableRow[] {
  return rotation.rows.map((row) => ({
    playerId: row.playerId,
    targetMinutes: row.targetMinutes,
    rotationPriority: row.rotationPriority,
    rotationStatus: row.rotationStatus,
    role: row.rotationRole,
    preferredPositions: row.preferredPositions,
    secondaryPositions: row.secondaryPositions,
    minutePriorityBias: row.minutePriorityBias,
    overrideMedicalRecommendation: row.overrideMedicalRecommendation,
    groupRole: row.role,
    firstName: row.firstName,
    lastName: row.lastName,
    position: row.position,
    age: row.age,
    overall: row.overall,
    teamName: row.teamName,
    actualMinutes: row.actualMinutes,
    projectedMinutes: row.projectedMinutes,
    availabilityStatus: row.availabilityStatus,
    availabilityLabel: row.availabilityLabel,
    injuryType: row.injuryType,
    injurySeverity: row.injurySeverity,
    recommendedWorkloadMpg: row.recommendedWorkloadMpg,
    maximumWorkloadMpg: row.maximumWorkloadMpg,
    gamesRemaining: row.gamesRemaining,
    isLegacyUndisclosed: row.isLegacyUndisclosed,
    workloadWarning: row.workloadWarning,
    seasonStats: row.seasonStats,
  }));
}

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

function balanceLabel(total: number, target: number): string {
  if (total === target) return "Balanced";
  if (total > target) return "Over";
  return "Under";
}

function buildChangelog(
  before: EditableRow[],
  after: EditableRow[],
): string[] {
  const beforeById = new Map(before.map((row) => [row.playerId, row]));
  const lines: string[] = [];
  for (const row of after) {
    const prev = beforeById.get(row.playerId);
    if (prev == null) continue;
    const parts: string[] = [];
    if (prev.targetMinutes !== row.targetMinutes) {
      parts.push(`${prev.targetMinutes} → ${row.targetMinutes} MPG`);
    }
    if (prev.role !== row.role) {
      parts.push(`role ${prev.role} → ${row.role}`);
    }
    if (prev.rotationPriority !== row.rotationPriority) {
      parts.push(`pri ${prev.rotationPriority} → ${row.rotationPriority}`);
    }
    if (parts.length > 0) {
      lines.push(`${row.firstName} ${row.lastName}: ${parts.join(", ")}`);
    }
  }
  return lines;
}

function optimizeSnapshotKey(saveId: string, teamId: string): string {
  return `rotation-pre-optimize:${saveId}:${teamId}`;
}

export function RotationEditor(props: {
  saveId: string;
  rotation: RotationView;
}) {
  const returnPath = `/dashboard/${props.saveId}/team-management/rotations`;
  const initialRef = useRef(mapRowsFromView(props.rotation));
  const preOptimizeRef = useRef<EditableRow[] | null>(null);
  const [rows, setRows] = useState(() => mapRowsFromView(props.rotation));
  const [preset, setPreset] = useState(props.rotation.rotationPreset);
  const [closingPolicy, setClosingPolicy] = useState(
    props.rotation.closingLineupPolicy,
  );
  const [closingIds, setClosingIds] = useState<string[]>(
    props.rotation.closingLineupIds,
  );
  const [sortKey, setSortKey] = useState<SortKey>("planned");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(
    null,
  );
  const [optimizeChangelog, setOptimizeChangelog] = useState<string[] | null>(
    null,
  );

  useEffect(() => {
    const key = optimizeSnapshotKey(props.saveId, props.rotation.teamId);
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return;
      sessionStorage.removeItem(key);
      const before = JSON.parse(raw) as EditableRow[];
      preOptimizeRef.current = before;
      const lines = buildChangelog(before, mapRowsFromView(props.rotation));
      setOptimizeChangelog(
        lines.length > 0
          ? ["Auto Optimize applied — review targets.", ...lines]
          : ["Auto Optimize applied — review targets."],
      );
    } catch {
      sessionStorage.removeItem(key);
    }
  }, [props.saveId, props.rotation]);

  const health = props.rotation.health;
  const editableRows = rows.filter((row) => row.groupRole !== "inactive");
  const totalPlanned = editableRows.reduce(
    (sum, row) => sum + row.targetMinutes,
    0,
  );
  const meaningfulCount = editableRows.filter(
    (row) => row.targetMinutes > 0,
  ).length;
  const balance = balanceLabel(totalPlanned, props.rotation.target);
  const overviewLine =
    health?.summaryLine ??
    `${totalPlanned} / ${props.rotation.target} MIN · ${meaningfulCount} Players · ${balance}`;
  const availabilitySummary =
    health?.availabilitySummary ??
    `${editableRows.filter((r) => r.availabilityStatus === "available").length} available`;

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
    rotationPriority: row.rotationPriority,
    rotationStatus: row.rotationStatus,
    role: row.role,
    preferredPositions: row.preferredPositions,
    secondaryPositions: row.secondaryPositions,
    minutePriorityBias: row.minutePriorityBias,
    overrideMedicalRecommendation: row.overrideMedicalRecommendation,
  }));

  const selectedPlayer = useMemo(() => {
    if (selectedPlayerId == null) return null;
    const row = rows.find((item) => item.playerId === selectedPlayerId);
    if (row == null) return null;
    const card: RotationPlayerCardData = {
      playerId: row.playerId,
      firstName: row.firstName,
      lastName: row.lastName,
      position: row.position,
      age: row.age,
      overall: row.overall,
      teamName: row.teamName ?? props.rotation.teamName,
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
  }, [rows, selectedPlayerId, props.rotation.teamName]);

  const updateRow = (
    playerId: string,
    patch: Partial<EditableRow>,
  ) => {
    setRows((current) =>
      current.map((row) =>
        row.playerId === playerId ? { ...row, ...patch } : row,
      ),
    );
    setPreset("custom");
    setOptimizeChangelog(null);
  };

  const undoChanges = () => {
    const snapshot = preOptimizeRef.current ?? initialRef.current;
    setRows(snapshot.map((row) => ({ ...row })));
    setPreset("custom");
    setClosingPolicy(props.rotation.closingLineupPolicy);
    setClosingIds([...props.rotation.closingLineupIds]);
    setOptimizeChangelog(null);
    preOptimizeRef.current = null;
  };

  const snapshotBeforeOptimize = () => {
    try {
      sessionStorage.setItem(
        optimizeSnapshotKey(props.saveId, props.rotation.teamId),
        JSON.stringify(rows),
      );
    } catch {
      // sessionStorage may be unavailable
    }
  };

  const healthIssues =
    health?.issues ??
    props.rotation.feedback.map((item) => ({
      code: item.kind,
      message: item.message,
      severity:
        item.kind === "unavailable" ||
        item.kind === "too_many" ||
        item.kind === "not_enough" ||
        item.kind === "infeasible"
          ? ("error" as const)
          : ("warning" as const),
    }));

  return (
    <div className="space-y-4">
      {props.rotation.feasibilityBanner ? (
        <div className="rounded-lg border border-rose-700 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
          {props.rotation.feasibilityBanner}
        </div>
      ) : null}

      <div className="sticky top-0 z-10 space-y-3 rounded-lg border border-zinc-700 bg-zinc-950/95 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-medium text-zinc-100">{overviewLine}</p>
          <p className="text-xs text-zinc-400">{availabilitySummary}</p>
        </div>

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
          <form action={optimizeRotationAction} onSubmit={snapshotBeforeOptimize}>
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
          <button
            type="button"
            onClick={undoChanges}
            className="rounded-md border border-zinc-600 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            Undo Changes
          </button>
          <label className="text-xs text-zinc-400">
            Closing lineup
            <select
              value={closingPolicy}
              onChange={(event) => {
                setClosingPolicy(event.target.value);
                setPreset("custom");
              }}
              className="ml-2 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
            >
              <option value="auto">Auto</option>
              <option value="best_five">Best five</option>
              <option value="starters">Use starters</option>
              <option value="custom">Custom</option>
            </select>
          </label>
        </div>
      </div>

      <div
        className={`rounded-lg border p-4 ${
          health?.level === "invalid"
            ? "border-rose-800 bg-rose-950/20"
            : health?.level === "warning"
              ? "border-amber-800 bg-amber-950/20"
              : "border-zinc-800 bg-zinc-900/50"
        }`}
      >
        <h3 className="text-sm font-medium text-zinc-200">Rotation Health</h3>
        <p className="mt-1 text-xs text-zinc-400">{overviewLine}</p>
        {healthIssues.length > 0 ? (
          <ul className="mt-2 space-y-1 text-xs">
            {healthIssues.map((issue) => (
              <li
                key={`${issue.code}-${issue.message}`}
                className={
                  issue.severity === "error"
                    ? "text-rose-300"
                    : "text-amber-300"
                }
              >
                {issue.message}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-emerald-400">
            Rotation looks healthy.
          </p>
        )}
        {health?.workloadWarnings && health.workloadWarnings.length > 0 ? (
          <ul className="mt-2 space-y-1 text-xs text-orange-300">
            {health.workloadWarnings.map((warning) => (
              <li key={warning.playerId}>
                ⚠️ {warning.playerName}: {warning.reason}
                {warning.overridden ? " (overridden)" : ""}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

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
        {sorted.map((row) => {
          const status = statusIndicator(row.availabilityStatus);
          return (
            <tr
              key={row.playerId}
              className={`border-t border-zinc-800 ${rowTone(row.role, row.groupRole)}`}
            >
              <td className="px-3 py-2">
                <button
                  type="button"
                  onClick={() => setSelectedPlayerId(row.playerId)}
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
                        {role.replaceAll("_", " ")}
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
                        projectedMinutes: Number(event.target.value),
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
              <td className="px-3 py-2 text-sm text-zinc-300">
                <span title={row.availabilityLabel}>
                  {status.emoji} {status.label}
                </span>
              </td>
            </tr>
          );
        })}
      </DataTable>

      <RotationQuarterVisualization
        players={editableRows.map((row) => ({
          playerId: row.playerId,
          firstName: row.firstName,
          lastName: row.lastName,
          role: row.role,
          targetMinutes: row.targetMinutes,
        }))}
      />

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
                    setPreset("custom");
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

      {optimizeChangelog != null && optimizeChangelog.length > 0 ? (
        <div className="rounded-lg border border-amber-800/60 bg-amber-950/20 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium text-amber-200">
                Optimize summary
              </h3>
              <ul className="mt-2 space-y-1 text-xs text-zinc-300">
                {optimizeChangelog.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p className="mt-2 text-[10px] text-zinc-500">
                Undo restores local edits — click Save rotation to persist.
              </p>
            </div>
            <button
              type="button"
              onClick={undoChanges}
              className="shrink-0 rounded border border-zinc-600 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
            >
              Undo
            </button>
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

      {selectedPlayer ? (
        <RotationPlayerCard
          player={selectedPlayer}
          onClose={() => setSelectedPlayerId(null)}
        />
      ) : null}
    </div>
  );
}
