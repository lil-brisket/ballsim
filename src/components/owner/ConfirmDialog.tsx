"use client";

import { Button } from "@/components/ui/Button";
import { useRef, useState } from "react";
import {
  DialogPortal,
  useDialogKeys,
} from "@/components/contracts/dialog-support";
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
  /** Render above a modal drawer: portal to body, trap focus, Escape closes. */
  portal?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  useDialogKeys({
    open: open && props.portal === true,
    dialogRef,
    triggerRef,
    onClose: () => setOpen(false),
  });

  return (
    <>
      <button
        ref={triggerRef}
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
        <DialogPortal portal={props.portal === true}>
          <Overlay
            className="flex items-center justify-center p-4"
            onClick={() => setOpen(false)}
          >
            <div
              ref={dialogRef}
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
        </DialogPortal>
      ) : null}
    </>
  );
}
