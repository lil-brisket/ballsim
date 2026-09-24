"use client";

import type { EditableRotationRow } from "@/state/lineup-rotation-editor";

export function ClosingLineupEditor(props: {
  closingPolicy: string;
  closingIds: string[];
  editableRows: EditableRotationRow[];
  onPolicyChange: (policy: string) => void;
  onTogglePlayer: (playerId: string) => void;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
        Closing Lineup
      </h2>
      <label className="text-xs text-zinc-400">
        Policy
        <select
          value={props.closingPolicy}
          onChange={(event) => props.onPolicyChange(event.target.value)}
          className="ml-2 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
        >
          <option value="auto">Auto</option>
          <option value="best_five">Best Five</option>
          <option value="starters">Starters</option>
          <option value="custom">Custom</option>
        </select>
      </label>
      {props.closingPolicy === "custom" ? (
        <div className="rounded-lg border border-zinc-800 p-3 text-sm text-zinc-300">
          <p className="mb-2 text-xs text-zinc-500">
            Select up to 5 closing players
          </p>
          <div className="flex flex-wrap gap-2">
            {props.editableRows.map((row) => {
              const selected = props.closingIds.includes(row.playerId);
              return (
                <button
                  key={row.playerId}
                  type="button"
                  onClick={() => props.onTogglePlayer(row.playerId)}
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
    </section>
  );
}
