"use client";

import { InfoTip } from "@/components/ui/InfoTip";
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
    <div
      className={[
        "flex items-center gap-2 rounded-md border pr-2 transition-colors",
        delegated
          ? "border-team-ink/60 bg-team/20 hover:border-team-ink/80"
          : "border-zinc-700 bg-zinc-950/60 hover:border-zinc-500",
      ].join(" ")}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={delegated}
        aria-label={`${meta.label}: ${delegated ? "AI handles" : "You handle"}`}
        onClick={onToggle}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-md px-3 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-team-ink"
      >
        <span
          aria-hidden="true"
          className={[
            "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border text-[10px] leading-none",
            delegated
              ? "border-team-ink bg-team-ink text-zinc-950"
              : "border-zinc-500",
          ].join(" ")}
        >
          {delegated ? "✓" : null}
        </span>
        <span className="min-w-0 flex-1 text-sm font-medium text-zinc-100">
          {meta.label}
        </span>
        <span
          aria-hidden="true"
          className={[
            "shrink-0 rounded px-1.5 py-0.5 text-xs font-medium",
            delegated
              ? "bg-team/30 text-team-ink"
              : "bg-zinc-800 text-zinc-400",
          ].join(" ")}
        >
          {delegated ? "AI" : "You"}
        </span>
      </button>
      <InfoTip label={meta.label}>{meta.description}</InfoTip>
    </div>
  );
}
