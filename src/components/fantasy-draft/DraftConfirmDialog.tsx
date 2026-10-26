"use client";

import { SectionHeading } from "@/components/ui/SectionHeading";
import { useEffect, useId, useRef } from "react";
import { fantasyDraftPickAction } from "@/application/actions";
import { buttonClass } from "@/components/ui/Button";
import { OvrBadge } from "@/components/ui/OvrBadge";

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
        className="w-full max-w-md rounded-xl border border-line-strong bg-surface-raised p-6"
      >
        <SectionHeading
          as="h3"
          size="sm"
          id={titleId}
          titleClassName="text-lg!"
          title={<>Draft {props.player.name}?</>}
        />
        <p className="mt-2 flex items-center gap-1.5 text-sm text-soft">
          <span>{props.player.position}</span>
          <OvrBadge overall={props.player.overall} size="sm" />
          <OvrBadge
            overall={props.player.potential}
            ghost
            label="POT"
            size="sm"
          />
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={props.onCancel}
            className={buttonClass({ variant: "secondary" })}
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
              className={buttonClass({ variant: "primary" })}
            >
              Draft Player
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
