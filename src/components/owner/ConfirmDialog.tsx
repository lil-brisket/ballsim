"use client";

import { useState } from "react";
import { Overlay } from "@/components/ui/Overlay";
import { focusRingClass, cn } from "@/components/ui/styles";

/**
 * Presentation-only confirmation. Mutation must happen via form/server action
 * after the user confirms — this component never mutates GameState.
 */
export function ConfirmDialog(props: {
  title: string;
  description: string;
  confirmLabel?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn("text-xs text-amber-400 hover:underline", focusRingClass)}
      >
        {props.confirmLabel ?? "Confirm"}
      </button>
      {open ? (
        <Overlay
          className="flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            className="relative z-10 w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3
              id="confirm-dialog-title"
              className="text-lg font-medium text-zinc-50"
            >
              {props.title}
            </h3>
            <p className="mt-2 text-sm text-zinc-400">{props.description}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className={cn(
                  "rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:border-zinc-500",
                  focusRingClass,
                )}
              >
                Cancel
              </button>
              {props.children}
            </div>
          </div>
        </Overlay>
      ) : null}
    </>
  );
}
