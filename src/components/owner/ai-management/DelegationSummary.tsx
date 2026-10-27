"use client";

import { useState } from "react";
import {
  categoryById,
  countDelegatedVisiblePhases,
  delegatedCategoryIds,
  delegatedVisiblePhases,
  MANAGEMENT_PHASE_METADATA,
  playerRetainedCategoryIds,
  playerRetainedVisiblePhases,
  visibleDelegationPhaseCount,
} from "@/domain/ai-management-delegation";
import type { AiAssistancePhases } from "@/domain/ai-management-presets";

type DelegationSummaryProps = {
  assistance: AiAssistancePhases;
  compact?: boolean;
  /** When true, omit expand control and show condensed categories only. */
  readOnly?: boolean;
};

export function DelegationSummary({
  assistance,
  compact = false,
  readOnly = false,
}: DelegationSummaryProps) {
  const [expanded, setExpanded] = useState(false);
  const delegatedCount = countDelegatedVisiblePhases(assistance);
  const total = visibleDelegationPhaseCount();
  const aiCategories = delegatedCategoryIds(assistance);
  const youCategories = playerRetainedCategoryIds(assistance);
  const aiPhases = delegatedVisiblePhases(assistance);
  const youPhases = playerRetainedVisiblePhases(assistance);

  if (delegatedCount === 0) {
    return (
      <div className="rounded-md border border-line-strong bg-surface-base/60 px-3 py-2 text-sm text-soft">
        <p className="font-medium text-ink">Your AI Assistant</p>
        <p className="mt-1 text-muted">
          No responsibilities delegated. You handle all franchise decisions
          during simulation.
        </p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="rounded-md border border-line-strong bg-surface-base/60 px-3 py-2 text-sm text-soft">
        <p className="font-medium text-ink">Your AI Assistant</p>
        <p className="mt-1 text-muted">
          {delegatedCount} of {total} responsibilities delegated
          {aiCategories.length > 0
            ? ` · ${aiCategories
                .map((id) => categoryById(id)?.title ?? id)
                .join(", ")}`
            : ""}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-line-strong bg-surface-base/60 px-3 py-3 text-sm text-soft">
      <p className="font-medium text-ink">Your AI Assistant</p>
      <p className="mt-1 text-muted">
        {delegatedCount} of {total} responsibilities delegated
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-sm text-muted">AI handles</p>
          {aiCategories.length === 0 ? (
            <p className="mt-1 text-faint">Nothing</p>
          ) : (
            <ul className="mt-1 list-inside list-disc text-muted">
              {aiCategories.map((id) => (
                <li key={id}>{categoryById(id)?.title ?? id}</li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="text-sm text-muted">You handle</p>
          {youCategories.length === 0 ? (
            <p className="mt-1 text-faint">
              All areas delegated during simulation — you can still override any
              AI move manually
            </p>
          ) : (
            <ul className="mt-1 list-inside list-disc text-muted">
              {youCategories.map((id) => (
                <li key={id}>{categoryById(id)?.title ?? id}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {!readOnly ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="text-sm text-faint hover:text-team-ink"
          >
            {expanded ? "Hide details ▴" : "Show details ▾"}
          </button>
          {expanded ? (
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-sm text-muted">
                  Delegated during simulation
                </p>
                <ul className="mt-1 list-inside list-disc text-muted">
                  {aiPhases.map((phase) => (
                    <li key={phase}>
                      {MANAGEMENT_PHASE_METADATA[phase].label}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-sm text-muted">You remain responsible for</p>
                <ul className="mt-1 list-inside list-disc text-muted">
                  {youPhases.length === 0 ? (
                    <li>
                      Manual overrides anytime — AI only acts during simulation
                    </li>
                  ) : (
                    youPhases.map((phase) => (
                      <li key={phase}>
                        {MANAGEMENT_PHASE_METADATA[phase].label}
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
