"use client";

import { SectionHeading } from "@/components/ui/SectionHeading";
import { useMemo, useState } from "react";
import { NumberStepper } from "@/components/ui/NumberStepper";
import { Select } from "@/components/ui/Select";
import { AvailabilityDot } from "@/components/team-management/availability-dot";
import { DataTable } from "@/components/ui/DataTable";
import {
  RotationPlayerCard,
  type RotationPlayerCardData,
} from "@/components/team-management/RotationPlayerCard";
import type { EditableRotationRow } from "@/state/lineup-rotation-editor";

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
    return "bg-team/15";
  }
  if (role === "sixth_man" || role === "rotation") {
    return "bg-surface-raised/80";
  }
  if (role === "deep_bench" || role === "emergency") {
    return "text-faint";
  }
  return "";
}

function statusLabel(status: string): string {
  switch (status) {
    case "available":
      return "Available";
    case "questionable":
      return "Questionable";
    case "limited":
      return "Limited";
    case "out":
      return "Out";
    case "suspended":
      return "Suspended";
    default:
      return status;
  }
}

function RotationRows(props: {
  rows: EditableRotationRow[];
  onUpdate: (playerId: string, patch: Partial<EditableRotationRow>) => void;
  onSelect: (playerId: string) => void;
}) {
  if (props.rows.length === 0) {
    return null;
  }
  return (
    <DataTable headers={["Player", "Pos", "Role", "Target MPG", "Status"]}>
      {props.rows.map((row) => {
        const status = statusLabel(row.availabilityStatus);
        const inactive = row.groupRole === "inactive";
        return (
          <tr
            key={row.playerId}
            className={`border-t border-line ${rowTone(row.role, row.groupRole)}`}
          >
            <td className="px-3 py-2">
              <button
                type="button"
                onClick={() => props.onSelect(row.playerId)}
                className="text-left text-ink hover:text-team-ink hover:underline"
              >
                {row.firstName} {row.lastName}
              </button>
              {row.workloadWarning ? (
                <p className="mt-0.5 text-sm text-caution">
                  {row.workloadWarning}
                </p>
              ) : null}
            </td>
            <td className="px-3 py-2 font-mono text-muted">{row.position}</td>
            <td className="px-3 py-2">
              {inactive ? (
                <span className="capitalize text-faint">inactive</span>
              ) : (
                <Select
                  value={row.role}
                  onChange={(event) =>
                    props.onUpdate(row.playerId, {
                      role: event.target.value,
                    })
                  }
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {role.replaceAll("_", " ")}
                    </option>
                  ))}
                </Select>
              )}
            </td>
            <td className="px-3 py-2">
              {inactive ? (
                <span className="text-faint">0</span>
              ) : (
                <div className="flex items-center gap-3">
                  <NumberStepper
                    min={0}
                    max={48}
                    value={row.targetMinutes}
                    aria-label={`Target minutes for ${row.firstName} ${row.lastName}`}
                    onValueChange={(minutes) =>
                      props.onUpdate(row.playerId, {
                        targetMinutes: minutes,
                        projectedMinutes: minutes,
                      })
                    }
                  />
                  <div
                    aria-hidden="true"
                    title={`${Math.round((row.targetMinutes / 48) * 100)}% of 48 minutes`}
                    className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-surface-high sm:block"
                  >
                    <div
                      className="h-full rounded-full bg-team"
                      style={{
                        width: `${Math.min(100, (row.targetMinutes / 48) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </td>
            <td className="px-3 py-2 text-sm text-soft">
              <span
                title={row.availabilityLabel}
                className="inline-flex items-center gap-2"
              >
                <AvailabilityDot status={row.availabilityStatus} />
                {status}
              </span>
            </td>
          </tr>
        );
      })}
    </DataTable>
  );
}

/** Active players by target minutes, inactive players last. */
function compareRows(a: EditableRotationRow, b: EditableRotationRow): number {
  const aInactive = a.groupRole === "inactive" ? 1 : 0;
  const bInactive = b.groupRole === "inactive" ? 1 : 0;
  return (
    aInactive - bInactive ||
    b.targetMinutes - a.targetMinutes ||
    `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`)
  );
}

export function RotationTable(props: {
  rows: EditableRotationRow[];
  teamName: string;
  onUpdate: (playerId: string, patch: Partial<EditableRotationRow>) => void;
}) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  const sorted = useMemo(() => [...props.rows].sort(compareRows), [props.rows]);

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
      seasonStats: row.seasonStats,
    };
    return card;
  }, [props.rows, selectedPlayerId, props.teamName]);

  return (
    <section className="space-y-4">
      <SectionHeading title="Rotation" />
      <RotationRows
        rows={sorted}
        onUpdate={props.onUpdate}
        onSelect={setSelectedPlayerId}
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
