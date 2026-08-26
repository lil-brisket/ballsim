"use client";

import {
  categoryById,
  categoryDelegationState,
  MANAGEMENT_PHASE_METADATA,
  type DelegationCategoryId,
} from "@/domain/ai-management-delegation";
import type { AiAssistancePhases, ManagementPhase } from "@/domain/ai-management-presets";
import { ResponsibilityCard } from "@/components/owner/ai-management/ResponsibilityCard";

type DelegationCategorySectionProps = {
  categoryId: DelegationCategoryId;
  assistance: AiAssistancePhases;
  onTogglePhase: (phase: ManagementPhase) => void;
  onSelectAllCategory: () => void;
};

export function DelegationCategorySection({
  categoryId,
  assistance,
  onTogglePhase,
  onSelectAllCategory,
}: DelegationCategorySectionProps) {
  const category = categoryById(categoryId);
  if (!category) {
    return null;
  }

  const { delegated, total, state } = categoryDelegationState(
    assistance,
    categoryId,
  );
  const phases = Object.values(MANAGEMENT_PHASE_METADATA)
    .filter(
      (meta) =>
        meta.categoryId === categoryId && meta.delegationSupported,
    )
    .map((meta) => meta.phase);

  if (phases.length === 0) {
    return null;
  }

  const stateLabel =
    state === "all"
      ? "All delegated"
      : state === "partial"
        ? "Partially delegated"
        : "None delegated";

  return (
    <details open className="group space-y-3 rounded-md border border-zinc-800 bg-zinc-950/40 p-3">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base" aria-hidden="true">
              {category.icon}
            </span>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-200">
              {category.title}
            </h3>
            <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-400">
              {delegated} / {total} AI
            </span>
            <span className="text-xs text-zinc-500">{stateLabel}</span>
          </div>
          <p className="text-xs text-zinc-500">{category.description}</p>
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onSelectAllCategory();
          }}
          className="shrink-0 rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
        >
          Select All
        </button>
      </summary>

      <div className="grid gap-3 sm:grid-cols-2">
        {phases.map((phase) => (
          <ResponsibilityCard
            key={phase}
            phase={phase}
            delegated={assistance[phase] !== "off"}
            onToggle={() => onTogglePhase(phase)}
          />
        ))}
      </div>
    </details>
  );
}
