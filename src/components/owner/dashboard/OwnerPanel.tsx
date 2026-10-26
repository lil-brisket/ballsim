"use client";

import { useState } from "react";
import { resolveBoardDirectiveAction } from "@/application/actions";
import { buttonClass } from "@/components/ui/Button";
import { formatMoney } from "@/components/owner/MoneyDisplay";
import type { OwnerDashboardOwner } from "@/state/owner-dashboard";
import { ObjectiveCard } from "@/components/game/ObjectiveCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Section } from "@/components/ui/Section";

export function OwnerPanel(props: {
  owner: OwnerDashboardOwner;
  saveId: string;
}) {
  const { owner, saveId } = props;
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
          <div className="rounded-xl border border-line bg-surface-raised/50 px-4 py-4">
            <p className="text-sm text-muted">Owner patience</p>
            <p className="mt-1 text-lg text-ink">{owner.patience}</p>
          </div>
          <div className="rounded-xl border border-line bg-surface-raised/50 px-4 py-4">
            <p className="text-sm text-muted">Franchise reputation</p>
            <p className="mt-1 text-2xl tabular-nums text-ink">
              {owner.franchiseReputation}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-surface-raised/40 px-4 py-3">
          <p className="text-sm text-muted">Current expectation</p>
          <p className="mt-1 text-sm text-ink">{ownership.mandateSummary}</p>
          {ownership.priorityBullets.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {ownership.priorityBullets.map((bullet) => (
                <li key={bullet} className="text-sm text-muted">
                  · {bullet}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {ownership.board.stage !== "none" ? (
          <BoardPressureCard board={ownership.board} saveId={saveId} />
        ) : null}

        <div className="rounded-xl border border-line bg-surface-raised/40 px-4 py-3">
          <p className="text-sm text-muted">Ownership mood</p>
          <p className="mt-1 text-sm text-ink">{ownership.moodLabel}</p>
        </div>

        {ownership.recentDecisions.length > 0 ? (
          <div className="rounded-xl border border-line bg-surface-raised/40 px-4 py-3">
            <p className="text-sm text-muted">Recent decisions</p>
            <ul className="mt-2 space-y-1">
              {ownership.recentDecisions.map((decision, index) => (
                <li
                  key={`${decision.summary}-${index}`}
                  className="text-sm text-soft"
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

        <div className="rounded-xl border border-line bg-surface-raised/40 px-4 py-3">
          <p className="text-sm text-muted">Ownership concern</p>
          <p className="mt-1 text-sm text-soft">
            {ownership.concern ?? "None"}
          </p>
        </div>

        <div className="rounded-xl border border-line bg-surface-raised/40 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted">Strategic alignment</p>
            <button
              type="button"
              className="text-sm text-muted underline-offset-2 hover:text-ink hover:underline"
              onClick={() => setShowWhy((value) => !value)}
            >
              {showWhy ? "Hide why" : "Why?"}
            </button>
          </div>
          <p className="mt-1 text-sm tabular-nums text-ink">
            {alignmentBar} {ownership.alignmentScore}%
          </p>
          {showWhy ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-soft">
                  Helping alignment
                </p>
                {ownership.whyHelping.length === 0 ? (
                  <p className="mt-1 text-sm text-faint">No recent helpers.</p>
                ) : (
                  <ul className="mt-1 space-y-1">
                    {ownership.whyHelping.map((line) => (
                      <li key={line} className="text-sm text-soft">
                        · {line}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-soft">
                  Hurting alignment
                </p>
                {ownership.whyHurting.length === 0 ? (
                  <p className="mt-1 text-sm text-faint">No recent concerns.</p>
                ) : (
                  <ul className="mt-1 space-y-1">
                    {ownership.whyHurting.map((line) => (
                      <li key={line} className="text-sm text-soft">
                        · {line}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-line bg-surface-raised/40 px-4 py-3">
          <p className="text-sm text-muted">Ownership evaluation</p>
          <p className="mt-1 text-sm text-ink">{owner.career.headline}</p>
          <p className="mt-1 text-sm text-faint">
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

function BoardPressureCard(props: {
  board: OwnerDashboardOwner["ownership"]["board"];
  saveId: string;
}) {
  const { board, saveId } = props;
  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        board.stage === "warning"
          ? "border-warning/40 bg-warning/10"
          : "border-rose-900/60 bg-rose-950/20"
      }`}
      role={board.decisionPending ? "alert" : undefined}
    >
      <p className="text-sm text-muted">The board</p>
      <p className="mt-1 text-sm font-medium text-ink">{board.label}</p>
      <p className="mt-1 text-sm text-soft">{board.detail}</p>
      {board.decisionPending ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <form action={resolveBoardDirectiveAction}>
            <input type="hidden" name="saveId" value={saveId} />
            <input type="hidden" name="choice" value="accept_plan" />
            <button type="submit" className={buttonClass()}>
              Accept the turnaround plan
            </button>
          </form>
          <form action={resolveBoardDirectiveAction}>
            <input type="hidden" name="saveId" value={saveId} />
            <input type="hidden" name="choice" value="settle" />
            <button
              type="submit"
              className={buttonClass({ variant: "primary" })}
            >
              Settle with the board ({formatMoney(board.settlementCost)})
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function ObjectiveGroup(props: {
  title: string;
  objectives: OwnerDashboardOwner["objectives"];
  empty: string;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-soft">{props.title}</p>
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
