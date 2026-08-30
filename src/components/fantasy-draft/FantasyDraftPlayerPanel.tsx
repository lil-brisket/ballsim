"use client";

import { useEffect, useId, useRef } from "react";
import {
  addFantasyDraftQueuePlayerAction,
  fantasyDraftPickAction,
} from "@/application/actions";
import { AttributeBar } from "@/components/player-profile/AttributeBar";
import type { FantasyDraftPlayerDetailView } from "@/state/selectors";

export function FantasyDraftPlayerPanel(props: {
  saveId: string;
  teamId: string;
  detail: FantasyDraftPlayerDetailView;
  canDraft: boolean;
  confirmPicks: boolean;
  pending: boolean;
  onClose: () => void;
  onRequestDraft: (player: {
    playerId: string;
    name: string;
    position: string;
    overall: number;
    potential: number;
  }) => void;
}) {
  const {
    saveId,
    teamId,
    detail,
    canDraft,
    confirmPicks,
    pending,
    onClose,
    onRequestDraft,
  } = props;
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const attributeEntries = Object.entries(detail.attributes).slice(0, 12);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[95vh] w-full max-w-lg flex-col overflow-hidden rounded-t-xl border border-zinc-700 bg-zinc-900 shadow-xl sm:rounded-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-800 px-5 py-4">
          <div>
            <h3 id={titleId} className="text-lg font-semibold text-zinc-50">
              {detail.firstName} {detail.lastName}
            </h3>
            <p className="mt-1 text-sm text-zinc-400">
              {detail.position} · Age {detail.age} · {detail.heightInches}&quot;
              / {detail.weightPounds} lbs
            </p>
            <p className="mt-0.5 text-xs capitalize text-zinc-500">
              {detail.archetypeLabel} · {detail.nationality} · {detail.tier}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300"
            aria-label="Close player card"
          >
            Close
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <div className="flex flex-wrap gap-3">
            <div className="rounded-lg border border-amber-700/50 bg-amber-950/30 px-4 py-2 text-center">
              <p className="text-[10px] uppercase text-amber-500/80">Overall</p>
              <p className="font-mono text-2xl text-amber-400">{detail.overall}</p>
            </div>
            <div className="rounded-lg border border-zinc-800 px-4 py-2 text-center">
              <p className="text-[10px] uppercase text-zinc-500">Potential</p>
              <p className="font-mono text-xl text-zinc-100">{detail.potential}</p>
            </div>
            <div className="space-y-1 text-xs text-zinc-400">
              <div>Dev: {detail.developmentStage}</div>
              <div>Injury: {detail.injuryKind}</div>
            </div>
          </div>

          {detail.isDrafted ? (
            <p className="rounded-md border border-amber-800/50 bg-amber-950/30 px-3 py-2 text-sm text-amber-200">
              Already drafted by {detail.draftedByTeamName ?? "a team"}
              {detail.pickNumber != null
                ? ` (Pick #${detail.pickNumber}, Round ${detail.round})`
                : ""}
            </p>
          ) : null}

          {detail.strengths.length > 0 ? (
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase text-zinc-500">
                Strengths
              </h4>
              <ul className="flex flex-wrap gap-1.5 text-xs text-emerald-300/90">
                {detail.strengths.map((s) => (
                  <li
                    key={s.label}
                    className="rounded border border-emerald-900/50 px-2 py-0.5"
                  >
                    {s.label}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {detail.weaknesses.length > 0 ? (
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase text-zinc-500">
                Weaknesses
              </h4>
              <ul className="flex flex-wrap gap-1.5 text-xs text-zinc-400">
                {detail.weaknesses.map((w) => (
                  <li
                    key={w.label}
                    className="rounded border border-zinc-800 px-2 py-0.5"
                  >
                    {w.label}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase text-zinc-500">
              Key attributes
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {attributeEntries.map(([key, value]) => (
                <AttributeBar
                  key={key}
                  label={key.replace(/([A-Z])/g, " $1")}
                  value={value}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-zinc-800 px-5 py-4">
          {!detail.isDrafted && !detail.inActiveQueue ? (
            <form action={addFantasyDraftQueuePlayerAction}>
              <input type="hidden" name="saveId" value={saveId} />
              <input type="hidden" name="teamId" value={teamId} />
              <input type="hidden" name="playerId" value={detail.playerId} />
              <button
                type="submit"
                className="rounded-md border border-zinc-700 px-3 py-2 text-sm"
              >
                Add to Queue
              </button>
            </form>
          ) : null}
          {detail.inActiveQueue && !detail.isDrafted ? (
            <span className="self-center text-xs text-zinc-500">In queue</span>
          ) : null}
          {canDraft && !detail.isDrafted ? (
            confirmPicks ? (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  onRequestDraft({
                    playerId: detail.playerId,
                    name: `${detail.firstName} ${detail.lastName}`,
                    position: detail.position,
                    overall: detail.overall,
                    potential: detail.potential,
                  })
                }
                className="rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-zinc-950 disabled:opacity-50"
              >
                Draft Player
              </button>
            ) : (
              <form action={fantasyDraftPickAction}>
                <input type="hidden" name="saveId" value={saveId} />
                <input type="hidden" name="playerId" value={detail.playerId} />
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-zinc-950 disabled:opacity-50"
                >
                  Draft Player
                </button>
              </form>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}
