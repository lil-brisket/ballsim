"use client";

import { Button } from "@/components/ui/Button";
import { InfoTip } from "@/components/ui/InfoTip";
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
import type {
  AiAssistancePhases,
  ManagementPhase,
} from "@/domain/ai-management-presets";
import { AiAssistanceHelpPanel } from "@/components/owner/ai-management/AiAssistanceHelpPanel";
import { DelegationCategorySection } from "@/components/owner/ai-management/DelegationCategorySection";

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
      setPhaseDelegated(
        assistance,
        phase,
        !isPhaseDelegated(assistance, phase),
      ),
    );
  }

  return (
    <div className="@container space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-soft">
          What would you like the AI to handle for you?
        </span>
        <InfoTip label="AI Team Management" align="start">
          <AiAssistanceHelpPanel />
        </InfoTip>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-ink">
          {delegatedCount} of {total} delegated
        </p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() =>
              onAssistanceChange(selectAllVisiblePhases(assistance))
            }
          >
            Select All
          </Button>
          <Button
            variant="quiet"
            onClick={() =>
              onAssistanceChange(clearAllVisiblePhases(assistance))
            }
          >
            Clear All
          </Button>
        </div>
      </div>

      <div className="grid gap-3 @3xl:grid-cols-2">
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
    </div>
  );
}
