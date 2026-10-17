"use client";

import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";

const PRESETS = [
  { id: "auto", label: "Optimize" },
  { id: "balanced", label: "Balanced" },
  { id: "star_heavy", label: "Star Heavy" },
  { id: "deep", label: "Deep Rotation" },
  { id: "development", label: "Development" },
  { id: "custom", label: "Custom" },
] as const;

export function RotationSettings(props: {
  preset: string;
  optimizing: boolean;
  onPresetChange: (preset: string) => void;
  onOptimize: () => void;
  onUndo: () => void;
  canUndo: boolean;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
        Rotation Settings
      </h2>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-zinc-400">
          Preset
          <Select
            value={props.preset}
            onChange={(event) => props.onPresetChange(event.target.value)}
            wrapperClassName="ml-2"
          >
            {PRESETS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </Select>
        </label>
        <Button
          type="button"
          variant="secondary"
          onClick={props.onOptimize}
          disabled={props.optimizing}
        >
          {props.optimizing ? "Optimizing…" : "Optimize Rotation"}
        </Button>
        {props.canUndo ? (
          <Button type="button" variant="quiet" onClick={props.onUndo}>
            Undo
          </Button>
        ) : null}
      </div>
    </section>
  );
}
