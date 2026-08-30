"use client";

import { useMemo } from "react";
import type {
  RotationEntry,
  RotationRole,
} from "@/domain/entities/team-roster-management";
import type { PlayerId } from "@/domain/ids";
import { projectRotationByQuarter } from "@/systems/rotation/rotation-quarter-projection";

export type RotationQuarterPlayer = {
  playerId: string;
  lastName: string;
  firstName: string;
  role: string;
  targetMinutes: number;
};

const ROLE_BAR: Record<string, string> = {
  starter: "bg-amber-600",
  sixth_man: "bg-amber-700/80",
  rotation: "bg-zinc-500",
  bench: "bg-zinc-600",
  deep_bench: "bg-zinc-700",
  emergency: "bg-zinc-800",
};

function asRotationRole(role: string): RotationRole {
  switch (role) {
    case "starter":
    case "sixth_man":
    case "rotation":
    case "bench":
    case "deep_bench":
    case "emergency":
      return role;
    default:
      return "bench";
  }
}

export function RotationQuarterVisualization(props: {
  players: RotationQuarterPlayer[];
}) {
  const quarters = useMemo(() => {
    const entries: RotationEntry[] = props.players
      .filter((player) => player.targetMinutes > 0)
      .map((player) => ({
        playerId: player.playerId as PlayerId,
        targetMinutes: player.targetMinutes,
        minimumMinutes: 0,
        normalMaximumMinutes: player.targetMinutes + 6,
        absoluteMaximumMinutes: player.targetMinutes + 12,
        rotationPriority: 3,
        rotationStatus: "active",
        role: asRotationRole(player.role),
        preferredPositions: ["PG"],
        secondaryPositions: [],
        minutePriorityBias: 0,
      }));
    return projectRotationByQuarter(entries);
  }, [props.players]);

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const player of props.players) {
      map.set(player.playerId, player.lastName || player.firstName);
    }
    return map;
  }, [props.players]);

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <h3 className="text-sm font-medium text-zinc-200">Projected Rotation</h3>
      <p className="mt-1 text-xs text-zinc-500">
        Projected from Target MPG. Actual minutes may change based on game
        situation.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {quarters.map((quarter) => (
          <div key={quarter.quarter} className="space-y-2">
            <div className="text-center text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Q{quarter.quarter}
            </div>
            <ul className="space-y-1.5">
              {quarter.players.slice(0, 8).map((entry) => (
                <li key={`${quarter.quarter}-${entry.playerId}`}>
                  <div className="flex items-center justify-between gap-1 text-[10px] text-zinc-400">
                    <span className="truncate">
                      {nameById.get(entry.playerId) ?? entry.playerId}
                    </span>
                    <span className="font-mono text-zinc-500">
                      {entry.quarterMinutes}&apos;
                    </span>
                  </div>
                  <div className="mt-0.5 h-1.5 overflow-hidden rounded bg-zinc-800">
                    <div
                      className={`h-full rounded ${ROLE_BAR[entry.role] ?? "bg-zinc-600"}`}
                      style={{
                        width: `${Math.round(entry.courtShare * 100)}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
              {quarter.players.length === 0 ? (
                <li className="text-[10px] text-zinc-600">No projection</li>
              ) : null}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
