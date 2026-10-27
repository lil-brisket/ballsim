"use client";

import { useState } from "react";
import type { FantasyDraftView } from "@/state/selectors";
import { cn, focusRingClass, linkClass } from "@/components/ui/styles";
import { buttonClass } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";

export function DraftHistoryPanel(props: { draft: FantasyDraftView }) {
  const [showAll, setShowAll] = useState(false);
  const recent = props.draft.selections.slice(-8).reverse();

  return (
    <>
      <section className="rounded-xl border border-line p-4">
        <SectionHeading
          title="Recent picks"
          className="mb-2"
          action={
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className={cn(
                linkClass,
                "inline-flex min-h-11 items-center text-sm",
                focusRingClass,
              )}
            >
              View all
            </button>
          }
        />
        <ul className="space-y-1 text-sm">
          {recent.length === 0 ? (
            <li className="text-faint">No picks yet</li>
          ) : (
            recent.map((sel) => (
              <li key={sel.pickNumber}>
                {sel.pickNumber}. {sel.teamAbbreviation} — {sel.playerName}
                <span className="text-faint"> ({sel.position})</span>
              </li>
            ))
          )}
        </ul>
      </section>

      {showAll ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Complete draft history"
            className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-line-strong bg-surface-raised"
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <SectionHeading as="h3" title="Draft history" />
              <button
                type="button"
                onClick={() => setShowAll(false)}
                className={buttonClass({ variant: "secondary" })}
              >
                Close
              </button>
            </div>
            <div className="overflow-y-auto px-4 py-3">
              <table className="w-full text-left text-sm">
                <thead className="text-faint">
                  <tr>
                    <th className="py-1">Pick</th>
                    <th>Rnd</th>
                    <th>Team</th>
                    <th>Player</th>
                    <th>Pos</th>
                  </tr>
                </thead>
                <tbody>
                  {[...props.draft.selections].reverse().map((sel) => (
                    <tr key={sel.pickNumber} className="border-t border-line">
                      <td className="py-1.5">{sel.pickNumber}</td>
                      <td>{sel.round}</td>
                      <td>{sel.teamAbbreviation}</td>
                      <td>{sel.playerName}</td>
                      <td>{sel.position}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
