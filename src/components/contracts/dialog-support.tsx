"use client";

import { useEffect, useRef, type RefObject } from "react";
import { createPortal, useFormStatus } from "react-dom";

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]):not([type="hidden"]), [href], [tabindex]:not([tabindex="-1"])';

/**
 * Focus trap + Escape for the contract dialogs. The key listener runs in the
 * capture phase and stops propagation so Escape closes only the dialog when it
 * is stacked over another modal (the player drawer).
 */
export function useDialogKeys(args: {
  open: boolean;
  dialogRef: RefObject<HTMLDivElement | null>;
  triggerRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}) {
  const { open, dialogRef, triggerRef } = args;
  const onCloseRef = useRef(args.onClose);
  useEffect(() => {
    onCloseRef.current = args.onClose;
  });

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const trigger = triggerRef.current;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    dialog?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      (trigger ?? previous)?.focus();
    };
  }, [open, dialogRef, triggerRef]);
}

/** Renders the dialog in document.body so it stacks above the drawer. */
export function DialogPortal(props: {
  portal: boolean;
  children: React.ReactNode;
}) {
  if (!props.portal || typeof document === "undefined") {
    return <>{props.children}</>;
  }
  return createPortal(props.children, document.body);
}

/** Place inside a <form>; calls onDone when the submitted action settles. */
export function FormDoneWatcher(props: { onDone?: () => void }) {
  const { pending } = useFormStatus();
  const wasPending = useRef(false);
  const onDoneRef = useRef(props.onDone);
  useEffect(() => {
    onDoneRef.current = props.onDone;
  });
  useEffect(() => {
    if (pending) {
      wasPending.current = true;
    } else if (wasPending.current) {
      wasPending.current = false;
      onDoneRef.current?.();
    }
  }, [pending]);
  return null;
}
