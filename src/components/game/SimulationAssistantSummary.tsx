"use client";

import {
  countDelegatedVisiblePhases,
  visibleDelegationPhaseCount,
} from "@/domain/ai-management-delegation";
import type { AiAssistancePhases } from "@/domain/ai-management-presets";
import { DelegationSummary } from "@/components/owner/ai-management/DelegationSummary";

export type SimulationAssistantSummaryProps = {
  assistance: AiAssistancePhases;
  compact?: boolean;
  /** @deprecated Preset is legacy; ignored. Kept for call-site compatibility. */
  preset?: string;
};

/**
 * Pre-simulation summary of what AI will / will not handle under current delegation.
 */
export function SimulationAssistantSummary({
  assistance,
  compact = false,
}: SimulationAssistantSummaryProps) {
  const delegatedCount = countDelegatedVisiblePhases(assistance);
  const total = visibleDelegationPhaseCount();

  if (compact) {
    return (
      <DelegationSummary assistance={assistance} compact />
    );
  }

  return (
    <div className="space-y-1">
      <DelegationSummary assistance={assistance} />
      <p className="sr-only">
        {delegatedCount} of {total} responsibilities delegated to AI
      </p>
    </div>
  );
}
