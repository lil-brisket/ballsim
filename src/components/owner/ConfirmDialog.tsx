"use client";

import { Button } from "@/components/ui/Button";
import { useState } from "react";
import { Overlay } from "@/components/ui/Overlay";
import {
  focusRingClass,
  cn,
  linkClass,
  touchTargetTextClass,
} from "@/components/ui/styles";
import { SectionHeading } from "@/components/ui/SectionHeading";

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
        className={cn(
          linkClass,
          touchTargetTextClass,
          "px-0 text-sm",
          focusRingClass,
        )}
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
            className="relative z-10 w-full max-w-md rounded-xl border border-line-strong bg-surface-raised p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <SectionHeading
              as="h3"
              id="confirm-dialog-title"
              title={props.title}
            />
            <p className="mt-2 text-sm text-muted">{props.description}</p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              {props.children}
            </div>
          </div>
        </Overlay>
      ) : null}
    </>
  );
}
