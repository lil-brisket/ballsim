"use client";

import { useState } from "react";
import {
  optimizeRotationAction,
} from "@/application/actions";
import type { OptimizeChange } from "@/systems/roster-management";
import { cn, panelClass } from "@/components/ui/styles";

export type RotationRecommendationPreview = {
  playerCount: number;
  totalMinutes: number;
  targetMinutes: number;
  changelog: OptimizeChange[];
  reasons: string[];
};

/**
 * Prominent AI recommendation preview — never silently applies.
 */
export function RotationRecommendationPanel(props: {
  saveId: string;
  teamId: string;
  returnPath: string;
  preset: string;
  currentPlayerCount: number;
  currentTotalMinutes: number;
  currentTarget: number;
  preview: RotationRecommendationPreview | null;
  onBeforeApply?: () => void;
}) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || !props.preview) {
    return null;
  }

  const { preview } = props;
  const changes = preview.changelog.slice(0, 8);

  return (
    <section
      className={cn(
        panelClass,
        "border-amber-800/50 bg-amber-950/15 px-4 py-4",
      )}
      aria-label="AI rotation recommendation"
    >
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-amber-400">
        AI Recommendation
      </p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Current
          </p>
          <p className="mt-1 text-sm text-zinc-200">
            {props.currentPlayerCount} players · {props.currentTotalMinutes}{" "}
            minutes
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Recommended
          </p>
          <p className="mt-1 text-sm text-amber-100">
            {preview.playerCount} players · {preview.totalMinutes} minutes
          </p>
        </div>
      </div>

      {changes.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Changes
          </p>
          <ul className="mt-1 space-y-1 text-sm text-zinc-300">
            {changes.map((change, index) => (
              <li key={`${change.kind}-${index}`}>
                {change.kind === "added" || change.message.startsWith("Increased")
                  ? "+"
                  : change.kind === "removed" ||
                      change.message.startsWith("Reduced")
                    ? "−"
                    : "·"}{" "}
                {change.message}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-3 text-sm text-zinc-400">
          Recommendation matches your current distribution closely.
        </p>
      )}

      {preview.reasons.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Reason
          </p>
          <ul className="mt-1 space-y-1 text-sm text-zinc-400">
            {preview.reasons.map((reason) => (
              <li key={reason}>• {reason}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <form action={optimizeRotationAction} onSubmit={props.onBeforeApply}>
          <input type="hidden" name="saveId" value={props.saveId} />
          <input type="hidden" name="teamId" value={props.teamId} />
          <input type="hidden" name="returnPath" value={props.returnPath} />
          <input type="hidden" name="rotationPreset" value={props.preset} />
          <button
            type="submit"
            className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-500"
          >
            Apply Recommendation
          </button>
        </form>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:border-zinc-500"
        >
          Dismiss
        </button>
      </div>
    </section>
  );
}
