"use client";

import { SectionHeading } from "@/components/ui/SectionHeading";
import { InfoTip } from "@/components/ui/InfoTip";
import {
  categoryById,
  categoryDelegationState,
  MANAGEMENT_PHASE_METADATA,
  type DelegationCategoryId,
} from "@/domain/ai-management-delegation";
import type {
  AiAssistancePhases,
  ManagementPhase,
} from "@/domain/ai-management-presets";
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

  const { delegated, total } = categoryDelegationState(assistance, categoryId);
  const phases = Object.values(MANAGEMENT_PHASE_METADATA)
    .filter(
      (meta) => meta.categoryId === categoryId && meta.delegationSupported,
    )
    .map((meta) => meta.phase);

  if (phases.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3 rounded-md border border-line bg-surface-base/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-base" aria-hidden="true">
          {category.icon}
        </span>
        <SectionHeading
          as="h3"
          size="sm"
          titleClassName="whitespace-nowrap"
          title={category.title}
        />
        <InfoTip label={category.title} align="start">
          {category.description}
        </InfoTip>
        <span className="whitespace-nowrap rounded bg-surface-high px-1.5 py-0.5 text-sm text-muted">
          {delegated}/{total} AI
        </span>
        <button
          type="button"
          onClick={onSelectAllCategory}
          className="ml-auto shrink-0 whitespace-nowrap rounded px-2 py-1 text-sm font-medium text-muted hover:bg-surface-high/60 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-team-ink"
        >
          Select All
        </button>
      </div>

      <div className="grid gap-2 @xl:grid-cols-2">
        {phases.map((phase) => (
          <ResponsibilityCard
            key={phase}
            phase={phase}
            delegated={assistance[phase] !== "off"}
            onToggle={() => onTogglePhase(phase)}
          />
        ))}
      </div>
    </section>
  );
}
