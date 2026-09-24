"use client";

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
          <select
            value={props.preset}
            onChange={(event) => props.onPresetChange(event.target.value)}
            className="ml-2 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
          >
            {PRESETS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={props.onOptimize}
          disabled={props.optimizing}
          className="rounded-md border border-amber-700 px-3 py-1.5 text-sm text-amber-300 hover:bg-amber-950 disabled:opacity-50"
        >
          {props.optimizing ? "Optimizing…" : "Optimize Rotation"}
        </button>
        {props.canUndo ? (
          <button
            type="button"
            onClick={props.onUndo}
            className="rounded-md border border-zinc-600 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            Undo
          </button>
        ) : null}
      </div>
    </section>
  );
}
