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
      <div className="rounded-md border border-zinc-700 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-300">
        <p className="font-medium text-zinc-100">Your AI Assistant</p>
        <p className="mt-1 text-zinc-400">
          No responsibilities delegated. You handle all franchise decisions
          during simulation.
        </p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="rounded-md border border-zinc-700 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-300">
        <p className="font-medium text-zinc-100">Your AI Assistant</p>
        <p className="mt-1 text-zinc-400">
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
    <div className="rounded-md border border-zinc-700 bg-zinc-950/60 px-3 py-3 text-sm text-zinc-300">
      <p className="font-medium text-zinc-100">Your AI Assistant</p>
      <p className="mt-1 text-zinc-400">
        {delegatedCount} of {total} responsibilities delegated
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            AI handles
          </p>
          {aiCategories.length === 0 ? (
            <p className="mt-1 text-zinc-500">Nothing</p>
          ) : (
            <ul className="mt-1 list-inside list-disc text-zinc-400">
              {aiCategories.map((id) => (
                <li key={id}>{categoryById(id)?.title ?? id}</li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            You handle
          </p>
          {youCategories.length === 0 ? (
            <p className="mt-1 text-zinc-500">Nothing (all delegated)</p>
          ) : (
            <ul className="mt-1 list-inside list-disc text-zinc-400">
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
            className="text-xs text-amber-500 hover:text-amber-400"
          >
            {expanded ? "Hide details ▴" : "Show details ▾"}
          </button>
          {expanded ? (
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  Delegated
                </p>
                <ul className="mt-1 list-inside list-disc text-zinc-400">
                  {aiPhases.map((phase) => (
                    <li key={phase}>
                      {MANAGEMENT_PHASE_METADATA[phase].label}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  You remain responsible for
                </p>
                <ul className="mt-1 list-inside list-disc text-zinc-400">
                  {youPhases.length === 0 ? (
                    <li>Nothing</li>
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
