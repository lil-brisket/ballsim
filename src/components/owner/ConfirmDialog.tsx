"use client";

import { useState } from "react";

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
        className="text-xs text-amber-400 hover:underline"
      >
        {props.confirmLabel ?? "Confirm"}
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-5 shadow-xl"
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
                className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:border-zinc-500"
              >
                Cancel
              </button>
              {props.children}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
