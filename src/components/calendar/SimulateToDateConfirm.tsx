"use client";

import { Overlay } from "@/components/ui/Overlay";
import { cn, focusRingClass } from "@/components/ui/styles";

export function SimulateToDateConfirm(props: {
  date: string;
  disabled?: boolean;
  onConfirm: (date: string) => void;
  onCancel: () => void;
}) {
  return (
    <Overlay
      className="flex items-end justify-center p-4 sm:items-center"
      onClick={props.onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="simulate-to-date-title"
        className="relative z-10 w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h3
          id="simulate-to-date-title"
          className="text-lg font-medium text-zinc-50"
        >
          Simulate through {props.date}?
        </h3>
        <p className="mt-2 text-sm text-zinc-400">
          This plays all games, including yours, up to that day.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={props.onCancel}
            className={cn(
              "rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:border-zinc-500",
              focusRingClass,
            )}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={props.disabled}
            onClick={() => {
              if (!props.disabled) {
                props.onConfirm(props.date);
              }
            }}
            className={cn(
              "rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-500 disabled:opacity-40",
              focusRingClass,
            )}
          >
            Simulate to date
          </button>
        </div>
      </div>
    </Overlay>
  );
}
