"use client";

import { useEffect, useId, useRef } from "react";
import { fantasyDraftPickAction } from "@/application/actions";

export function DraftConfirmDialog(props: {
  saveId: string;
  player: {
    playerId: string;
    name: string;
    position: string;
    overall: number;
    potential: number;
  };
  pending: boolean;
  onCancel: () => void;
  onSubmitStart: () => void;
}) {
  const titleId = useId();
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        props.onCancel();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-6"
      >
        <h3 id={titleId} className="text-lg font-semibold">
          Draft {props.player.name}?
        </h3>
        <p className="mt-2 text-sm text-zinc-300">
          {props.player.position} · {props.player.overall} OVR ·{" "}
          {props.player.potential} POT
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={props.onCancel}
            className="rounded-md border border-zinc-700 px-3 py-2 text-sm"
          >
            Cancel
          </button>
          <form
            action={fantasyDraftPickAction}
            onSubmit={() => props.onSubmitStart()}
          >
            <input type="hidden" name="saveId" value={props.saveId} />
            <input
              type="hidden"
              name="playerId"
              value={props.player.playerId}
            />
            <button
              ref={confirmRef}
              type="submit"
              disabled={props.pending}
              className="rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-zinc-950 disabled:opacity-50"
            >
              Draft Player
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
