"use client";

import { SectionHeading } from "@/components/ui/SectionHeading";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
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
        <SectionHeading title="Bench" className="mb-3" />
        <DataTable
          headers={["Player", "Pos", "Role", "Target MPG", "Status", ""]}
        >
          {props.bench.map((playerId) => {
            const player = props.allPlayers.find(
              (p) => p.playerId === playerId,
            );
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
                  <Button
                    type="button"
                    variant="quiet"
                    onClick={() => props.onMoveToInactive(playerId)}
                  >
                    Make inactive
                  </Button>
                </td>
              </tr>
            );
          })}
        </DataTable>
      </section>

      <section>
        <SectionHeading title="Inactive" className="mb-3" />
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
                  <Button
                    type="button"
                    variant="quiet"
                    onClick={() => props.onMoveToBench(playerId)}
                  >
                    Move to bench
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
