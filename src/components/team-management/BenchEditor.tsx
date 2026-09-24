"use client";

import { DataTable } from "@/components/owner/DataTable";
import { StatusBadge } from "@/components/owner/StatusBadge";
import type {
  EditableRotationRow,
  PlayerCardLike,
} from "@/state/lineup-rotation-editor";

export function BenchEditor(props: {
  bench: string[];
  inactive: string[];
  allPlayers: PlayerCardLike[];
  rowsById: Map<string, EditableRotationRow>;
  onMoveToInactive: (playerId: string) => void;
  onMoveToBench: (playerId: string) => void;
}) {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Bench
        </h2>
        <DataTable headers={["Player", "Pos", "Role", "Target MPG", "Status", ""]}>
          {props.bench.map((playerId) => {
            const player = props.allPlayers.find((p) => p.playerId === playerId);
            const row = props.rowsById.get(playerId);
            if (!player) {
              return null;
            }
            return (
              <tr key={playerId} className="border-t border-zinc-800">
                <td className="px-3 py-2 text-zinc-100">
                  {player.firstName} {player.lastName}
                </td>
                <td className="px-3 py-2 font-mono text-zinc-400">
                  {player.position}
                </td>
                <td className="px-3 py-2 capitalize text-zinc-400">
                  {(row?.role ?? "bench").replaceAll("_", " ")}
                </td>
                <td className="px-3 py-2 text-zinc-300">
                  {row?.targetMinutes ?? player.plannedMinutes}
                </td>
                <td className="px-3 py-2">
                  <StatusBadge label={player.availabilityLabel} />
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => props.onMoveToInactive(playerId)}
                    className="text-xs text-zinc-400 hover:text-amber-300"
                  >
                    Make inactive
                  </button>
                </td>
              </tr>
            );
          })}
        </DataTable>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Inactive
        </h2>
        {props.inactive.length === 0 ? (
          <p className="text-sm text-zinc-500">No inactive players.</p>
        ) : (
          <ul className="space-y-2 text-sm text-zinc-300">
            {props.inactive.map((playerId) => {
              const player = props.allPlayers.find(
                (p) => p.playerId === playerId,
              );
              if (!player) {
                return null;
              }
              return (
                <li
                  key={playerId}
                  className="flex flex-wrap items-center justify-between gap-2"
                >
                  <span>
                    {player.firstName} {player.lastName} (OVR {player.overall})
                  </span>
                  <button
                    type="button"
                    onClick={() => props.onMoveToBench(playerId)}
                    className="text-xs text-zinc-400 hover:text-amber-300"
                  >
                    Move to bench
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
