"use client";

import { useState } from "react";
import type { OwnerDashboardOwner } from "@/state/owner-dashboard";
import { ObjectiveCard } from "@/components/game/ObjectiveCard";
import { EmptyState } from "@/components/owner/EmptyState";
import { Section } from "@/components/owner/Section";

const PHILOSOPHY_LABELS: Record<string, string> = {
  win_now: "Win Now",
  build_for_the_future: "Build for the Future",
  financially_conservative: "Financially Conservative",
  market_expansion: "Market Expansion",
  balanced: "Balanced",
};

export function OwnerPanel(props: { owner: OwnerDashboardOwner }) {
  const { owner } = props;
  const philosophyLabel =
    PHILOSOPHY_LABELS[owner.philosophy] ?? owner.philosophy;
  const ownership = owner.ownership;
  const [showWhy, setShowWhy] = useState(false);

  const alignmentFilled = Math.max(
    0,
    Math.min(10, Math.round(ownership.alignmentScore / 10)),
  );
  const alignmentBar =
    "█".repeat(alignmentFilled) + "░".repeat(10 - alignmentFilled);

  return (
    <Section title="Owner">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-4">
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-zinc-500">
              Owner philosophy
            </p>
            <p className="mt-1 text-lg text-zinc-50">{philosophyLabel}</p>
            <p className="mt-1 text-xs text-zinc-500">
              Patience {owner.patience}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-4">
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-zinc-500">
              Franchise reputation
            </p>
            <p className="mt-1 text-2xl font-mono text-zinc-50">
              {owner.franchiseReputation}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-zinc-500">
            Current expectation
          </p>
          <p className="mt-1 text-sm text-zinc-200">{ownership.mandateSummary}</p>
          {ownership.priorityBullets.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {ownership.priorityBullets.map((bullet) => (
                <li key={bullet} className="text-sm text-zinc-400">
                  · {bullet}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-zinc-500">
            Ownership mood
          </p>
          <p className="mt-1 text-sm text-zinc-200">{ownership.moodLabel}</p>
        </div>

        {ownership.recentDecisions.length > 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-zinc-500">
              Recent decisions
            </p>
            <ul className="mt-2 space-y-1">
              {ownership.recentDecisions.map((decision, index) => (
                <li
                  key={`${decision.summary}-${index}`}
                  className="text-sm text-zinc-300"
                >
                  {decision.direction === "aligned"
                    ? "🟢"
                    : decision.direction === "conflicting"
                      ? "🔴"
                      : "⚪"}{" "}
                  {decision.summary}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-zinc-500">
            Ownership concern
          </p>
          <p className="mt-1 text-sm text-zinc-300">
            {ownership.concern ?? "None"}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-zinc-500">
              Strategic alignment
            </p>
            <button
              type="button"
              className="text-xs text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline"
              onClick={() => setShowWhy((value) => !value)}
            >
              {showWhy ? "Hide why" : "Why?"}
            </button>
          </div>
          <p className="mt-1 font-mono text-sm text-zinc-200">
            {alignmentBar} {ownership.alignmentScore}%
          </p>
          {showWhy ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  Helping alignment
                </p>
                {ownership.whyHelping.length === 0 ? (
                  <p className="mt-1 text-sm text-zinc-500">No recent helpers.</p>
                ) : (
                  <ul className="mt-1 space-y-1">
                    {ownership.whyHelping.map((line) => (
                      <li key={line} className="text-sm text-zinc-300">
                        · {line}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  Hurting alignment
                </p>
                {ownership.whyHurting.length === 0 ? (
                  <p className="mt-1 text-sm text-zinc-500">No recent concerns.</p>
                ) : (
                  <ul className="mt-1 space-y-1">
                    {ownership.whyHurting.map((line) => (
                      <li key={line} className="text-sm text-zinc-300">
                        · {line}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-zinc-500">
            Ownership evaluation
          </p>
          <p className="mt-1 text-sm text-zinc-200">{owner.career.headline}</p>
          <p className="mt-1 text-xs text-zinc-500">
            {owner.career.band} · alignment {owner.career.alignmentScore} ·{" "}
            {owner.career.championships} titles ·{" "}
            {owner.career.playoffAppearances} playoff years
          </p>
        </div>

        <ObjectiveGroup
          title="Primary objectives"
          objectives={owner.primaryObjectives}
          empty="No primary objectives yet. Advance the season to generate them."
        />
        <ObjectiveGroup
          title="Secondary objectives"
          objectives={owner.secondaryObjectives}
          empty="No secondary objectives."
        />
        <ObjectiveGroup
          title="Long-term objectives"
          objectives={owner.longTermObjectives}
          empty="No long-term mandate yet."
        />
      </div>
    </Section>
  );
}

function ObjectiveGroup(props: {
  title: string;
  objectives: OwnerDashboardOwner["objectives"];
  empty: string;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-zinc-300">{props.title}</p>
      {props.objectives.length === 0 ? (
        <EmptyState message={props.empty} />
      ) : (
        <ul className="space-y-2">
          {props.objectives.map((objective) => (
            <ObjectiveCard
              key={objective.id}
              description={objective.description}
              seasonYear={objective.seasonYear}
              status={objective.status}
              role={objective.role}
              lifecycle={objective.lifecycle}
              target={objective.target}
              progress={objective.progress}
              consequenceApplied={objective.consequenceApplied}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
