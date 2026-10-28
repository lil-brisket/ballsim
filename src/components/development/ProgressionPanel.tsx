"use client";

import { useState } from "react";
import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import {
  MomentReplayButton,
  momentKey,
  useMomentGate,
} from "@/components/moments";
import { ProgressionReveal } from "@/components/moments/ProgressionReveal";
import { signed } from "@/components/moments/progression-format";
import { DataTable, numericCellClass } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/components/ui/styles";
import type {
  ProgressionPlayerRow,
  ProgressionRevealView,
} from "@/state/progression-reveal-selectors";

type SortKey = "name" | "age" | "before" | "after" | "delta";
type Direction = "asc" | "desc";

function compare(
  key: SortKey,
  a: ProgressionPlayerRow,
  b: ProgressionPlayerRow,
): number {
  if (key === "name") return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  return a[key] - b[key];
}

export function ProgressionPanel(props: {
  saveId: string;
  view: ProgressionRevealView | null;
}) {
  const { saveId, view } = props;
  const gate = useMomentGate(
    saveId,
    momentKey("progression", view?.teamId ?? "", view?.seasonYear ?? 0),
    { eligible: false },
  );
  const [sort, setSort] = useState<{ key: SortKey; direction: Direction }>({
    key: "delta",
    direction: "desc",
  });

  if (!view) {
    return (
      <EmptyState message="Player progression appears after the first offseason." />
    );
  }

  // Array.prototype.sort is stable, so ties keep the selector's order.
  const rows = [...view.changed, ...view.unchangedPlayers].sort((a, b) => {
    const result = compare(sort.key, a, b);
    return sort.direction === "asc" ? result : -result;
  });

  function header(label: string, key: SortKey, numeric?: boolean) {
    return {
      label,
      numeric,
      sort: {
        direction: sort.key === key ? sort.direction : null,
        onSelect: () =>
          setSort((current) =>
            current.key === key
              ? {
                  key,
                  direction: current.direction === "asc" ? "desc" : "asc",
                }
              : { key, direction: key === "name" ? "asc" : "desc" },
          ),
      },
    };
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-soft">
          {view.seasonYear} offseason · {view.improved} improved ·{" "}
          {view.declined} declined · {view.unchanged} unchanged
          {" · "}Team Avg OVR {view.averageBefore} → {view.averageAfter} (
          {signed(view.averageDelta)})
        </p>
        <MomentReplayButton onReplay={gate.replay} label="Replay progression" />
      </div>
      <DataTable
        caption="Progression"
        headers={[
          header("Player", "name"),
          "Pos",
          header("Age", "age", true),
          header("Before", "before", true),
          header("After", "after", true),
          header("Change", "delta", true),
          "Top moves",
        ]}
      >
        {rows.map((row) => (
          <tr key={row.playerId}>
            <td className="px-3 py-2">
              <PlayerEntityLink saveId={saveId} playerId={row.playerId}>
                {row.name}
              </PlayerEntityLink>
            </td>
            <td className="px-3 py-2">{row.position}</td>
            <td className={cn("px-3 py-2", numericCellClass)}>{row.age}</td>
            <td className={cn("px-3 py-2", numericCellClass)}>{row.before}</td>
            <td className={cn("px-3 py-2", numericCellClass)}>{row.after}</td>
            <td
              className={cn(
                "px-3 py-2",
                numericCellClass,
                row.delta > 0 && "text-win",
                row.delta < 0 && "text-loss",
              )}
            >
              {signed(row.delta)}
            </td>
            <td className="px-3 py-2 text-muted">
              {row.topMoves
                .map((m) => `${m.label} ${m.before} → ${m.after}`)
                .join(", ")}
            </td>
          </tr>
        ))}
      </DataTable>
      <ProgressionReveal view={view} open={gate.open} onClose={gate.close} />
    </div>
  );
}
