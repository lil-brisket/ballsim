"use client";

import { MANAGEMENT_PHASE_METADATA } from "@/domain/ai-management-delegation";
import type { ManagementPhase } from "@/domain/ai-management-presets";

type ResponsibilityCardProps = {
  phase: ManagementPhase;
  delegated: boolean;
  onToggle: () => void;
};

export function ResponsibilityCard({
  phase,
  delegated,
  onToggle,
}: ResponsibilityCardProps) {
  const meta = MANAGEMENT_PHASE_METADATA[phase];

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={delegated}
      aria-label={`${meta.label}: ${delegated ? "AI handles" : "You handle"}`}
      onClick={onToggle}
      className={[
        "flex w-full flex-col gap-1 rounded-md border px-3 py-3 text-left transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-team-ink",
        delegated
          ? "border-team-ink/60 bg-team/20 hover:border-team-ink/80"
          : "border-zinc-700 bg-zinc-950/60 hover:border-zinc-500",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-zinc-100">{meta.label}</span>
        {delegated ? (
          <span className="shrink-0 text-team-ink" aria-hidden="true">
            ✓
          </span>
        ) : null}
      </div>
      <p className="text-sm leading-relaxed text-zinc-400">
        {meta.description}
      </p>
      {delegated ? (
        <span className="mt-1 text-sm font-medium text-zinc-300">
          AI handles
        </span>
      ) : (
        <span className="mt-1 text-sm font-medium text-zinc-300">
          You handle
        </span>
      )}
    </button>
  );
}
