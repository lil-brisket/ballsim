"use client";

import {
  clearAllVisiblePhases,
  countDelegatedVisiblePhases,
  DELEGATION_CATEGORIES,
  isPhaseDelegated,
  selectAllCategoryPhases,
  selectAllVisiblePhases,
  setPhaseDelegated,
  visibleDelegationPhaseCount,
} from "@/domain/ai-management-delegation";
import type { AiAssistancePhases, ManagementPhase } from "@/domain/ai-management-presets";
import { AiAssistanceHelpPanel } from "@/components/owner/ai-management/AiAssistanceHelpPanel";
import { DelegationCategorySection } from "@/components/owner/ai-management/DelegationCategorySection";
import { DelegationSummary } from "@/components/owner/ai-management/DelegationSummary";

type AiTeamManagementSectionProps = {
  assistance: AiAssistancePhases;
  onAssistanceChange: (assistance: AiAssistancePhases) => void;
};

export function AiTeamManagementSection({
  assistance,
  onAssistanceChange,
}: AiTeamManagementSectionProps) {
  const delegatedCount = countDelegatedVisiblePhases(assistance);
  const total = visibleDelegationPhaseCount();

  function togglePhase(phase: ManagementPhase) {
    onAssistanceChange(
      setPhaseDelegated(assistance, phase, !isPhaseDelegated(assistance, phase)),
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="text-base font-semibold text-zinc-100">
          AI Team Management
        </h3>
        <p className="text-sm text-zinc-300">
          What would you like the AI to handle for you?
        </p>
        <p className="text-xs text-zinc-500">
          Select the areas you want the AI to manage during simulation. When
          enabled, the AI will fully handle that responsibility. Anything you
          leave disabled remains under your control.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-zinc-200">
          {delegatedCount} of {total} delegated
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() =>
              onAssistanceChange(selectAllVisiblePhases(assistance))
            }
            className="rounded-md border border-amber-700/60 bg-amber-950/40 px-3 py-1.5 text-xs font-medium text-amber-200 hover:border-amber-500"
          >
            Select All
          </button>
          <button
            type="button"
            onClick={() =>
              onAssistanceChange(clearAllVisiblePhases(assistance))
            }
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
          >
            Clear All
          </button>
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[1fr_minmax(240px,320px)] lg:items-start lg:gap-6">
        <div className="space-y-4">
          {DELEGATION_CATEGORIES.map((category) => (
            <DelegationCategorySection
              key={category.id}
              categoryId={category.id}
              assistance={assistance}
              onTogglePhase={togglePhase}
              onSelectAllCategory={() =>
                onAssistanceChange(
                  selectAllCategoryPhases(assistance, category.id),
                )
              }
            />
          ))}
        </div>
        <div className="mt-4 space-y-3 lg:sticky lg:top-4 lg:mt-0">
          <DelegationSummary assistance={assistance} />
          <AiAssistanceHelpPanel />
        </div>
      </div>
    </div>
  );
}
