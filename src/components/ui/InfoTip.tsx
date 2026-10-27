"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn, focusRingClass } from "@/components/ui/styles";

type InfoTipProps = {
  /** What the tip explains; read as "About {label}". */
  label: string;
  /** Which edge of the button the popover lines up with. */
  align?: "start" | "end";
  children: ReactNode;
};

/** Small "?" button that toggles a short explanation popover. */
export function InfoTip({ label, align = "end", children }: InfoTipProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const tipId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <span ref={rootRef} className="relative inline-flex shrink-0">
      <button
        type="button"
        aria-label={`About ${label}`}
        aria-expanded={open}
        aria-describedby={open ? tipId : undefined}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        className={cn(
          "inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
          // 24px circle, 44px hit area (an invisible ring around it).
          "relative after:absolute after:-inset-2.5 after:content-['']",
          open
            ? "border-team-ink text-team-ink"
            : "border-disabled text-muted hover:border-muted hover:text-ink",
          focusRingClass,
        )}
      >
        ?
      </button>
      {open ? (
        <span
          id={tipId}
          role="tooltip"
          className={cn(
            "absolute top-full z-20 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-md border border-line-strong bg-surface-raised px-3 py-2 text-left text-sm font-normal leading-relaxed text-soft shadow-lg",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {children}
        </span>
      ) : null}
    </span>
  );
}
