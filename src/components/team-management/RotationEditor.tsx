"use client";

import { useState } from "react";
import { updateRotationAction } from "@/application/actions";
import type { RotationView } from "@/state/team-management-selectors";
import { DataTable } from "@/components/owner/DataTable";
import { StatusBadge } from "@/components/owner/StatusBadge";
import { SortableTableControls } from "@/components/owner/SortableTableControls";

type SortKey = "name" | "position" | "planned" | "actual" | "role" | "status";

export function RotationEditor(props: {
  saveId: string;
  rotation: RotationView;
}) {
  const returnPath = `/dashboard/${props.saveId}/team-management/rotations`;
  const [minutes, setMinutes] = useState(
    Object.fromEntries(
      props.rotation.rows.map((row) => [row.playerId, row.plannedMinutes]),
    ),
  );
  const [sortKey, setSortKey] = useState<SortKey>("planned");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const editableRows = props.rotation.rows.filter(
    (row) => row.role !== "inactive",
  );
  const totalPlanned = editableRows.reduce(
    (sum, row) => sum + (minutes[row.playerId] ?? 0),
    0,
  );
  const delta = totalPlanned - props.rotation.target;

  const sorted = [...props.rotation.rows].sort((a, b) => {
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
        cmp = (minutes[a.playerId] ?? 0) - (minutes[b.playerId] ?? 0);
        break;
      case "actual":
        cmp = a.actualMinutes - b.actualMinutes;
        break;
      case "role":
        cmp = a.role.localeCompare(b.role);
        break;
      case "status":
        cmp = a.availabilityLabel.localeCompare(b.availabilityLabel);
        break;
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  const rotationPayload = editableRows.map((row) => ({
    playerId: row.playerId,
    plannedMinutes: minutes[row.playerId] ?? 0,
    eligiblePositions: row.eligiblePositions,
    role: row.role === "starter" ? "starter" : "bench",
  }));

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 rounded-lg border border-zinc-700 bg-zinc-950/95 px-4 py-3 backdrop-blur">
        <p className="text-sm text-zinc-200">
          Planned minutes:{" "}
          <span className="font-semibold text-amber-400">
            {totalPlanned} / {props.rotation.target}
          </span>{" "}
          <span className={delta === 0 ? "text-emerald-400" : "text-rose-400"}>
            (Δ {delta > 0 ? `+${delta}` : delta})
          </span>
        </p>
        <ul className="mt-1 text-xs text-zinc-500">
          {props.rotation.feedback.map((item) => (
            <li key={`${item.kind}-${item.message}`}>{item.message}</li>
          ))}
        </ul>
      </div>

      <SortableTableControls
        sortKey={sortKey}
        sortDir={sortDir}
        onSortKeyChange={setSortKey}
        onSortDirChange={setSortDir}
        options={[
          { value: "planned", label: "Planned" },
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
          "Planned",
          "Actual",
          "Eligible",
          "Status",
        ]}
      >
        {sorted.map((row) => (
          <tr key={row.playerId} className="border-t border-zinc-800">
            <td className="px-3 py-2 text-zinc-100">
              {row.firstName} {row.lastName}
            </td>
            <td className="px-3 py-2 font-mono text-zinc-400">{row.position}</td>
            <td className="px-3 py-2 capitalize text-zinc-400">{row.role}</td>
            <td className="px-3 py-2">
              {row.role === "inactive" ? (
                <span className="text-zinc-500">0</span>
              ) : (
                <input
                  type="number"
                  min={0}
                  max={48}
                  value={minutes[row.playerId] ?? 0}
                  onChange={(event) =>
                    setMinutes((current) => ({
                      ...current,
                      [row.playerId]: Number(event.target.value),
                    }))
                  }
                  className="w-16 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
                />
              )}
            </td>
            <td className="px-3 py-2 text-zinc-400">{row.actualMinutes}</td>
            <td className="px-3 py-2 font-mono text-xs text-zinc-500">
              {row.eligiblePositions.join(", ")}
            </td>
            <td className="px-3 py-2">
              <StatusBadge label={row.availabilityLabel} />
            </td>
          </tr>
        ))}
      </DataTable>

      <form action={updateRotationAction}>
        <input type="hidden" name="saveId" value={props.saveId} />
        <input type="hidden" name="teamId" value={props.rotation.teamId} />
        <input type="hidden" name="returnPath" value={returnPath} />
        <input type="hidden" name="rotationStyle" value={props.rotation.rotationStyle} />
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
