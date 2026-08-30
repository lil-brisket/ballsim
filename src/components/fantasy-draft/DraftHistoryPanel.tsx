"use client";

import { useState } from "react";
import type { FantasyDraftView } from "@/state/selectors";

export function DraftHistoryPanel(props: { draft: FantasyDraftView }) {
  const [showAll, setShowAll] = useState(false);
  const recent = props.draft.selections.slice(-8).reverse();

  return (
    <>
      <section className="rounded-xl border border-zinc-800 p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase text-zinc-400">
            Recent picks
          </h2>
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="text-xs text-amber-400 hover:underline"
          >
            View all
          </button>
        </div>
        <ul className="space-y-1 text-sm">
          {recent.length === 0 ? (
            <li className="text-zinc-500">No picks yet</li>
          ) : (
            recent.map((sel) => (
              <li key={sel.pickNumber}>
                {sel.pickNumber}. {sel.teamAbbreviation} — {sel.playerName}
                <span className="text-zinc-500"> ({sel.position})</span>
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
            className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-zinc-700 bg-zinc-900"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
              <h3 className="font-semibold text-zinc-50">Draft history</h3>
              <button
                type="button"
                onClick={() => setShowAll(false)}
                className="rounded border border-zinc-700 px-2 py-1 text-xs"
              >
                Close
              </button>
            </div>
            <div className="overflow-y-auto px-4 py-3">
              <table className="w-full text-left text-sm">
                <thead className="text-zinc-500">
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
                    <tr key={sel.pickNumber} className="border-t border-zinc-800">
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
