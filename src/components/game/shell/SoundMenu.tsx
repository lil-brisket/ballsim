"use client";

import { useEffect, useId, useRef, useState } from "react";
import { SoundToggle, SoundVolume } from "@/components/ui/sound/SoundControls";
import { cn, focusRingClass, touchTargetClass } from "@/components/ui/styles";

/**
 * Desktop header sound control: the on/off toggle, plus a small popover for
 * the volume slider. Phones reach the same controls from the More drawer.
 */
export function SoundMenu(props: { className?: string }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative items-center", props.className)}>
      <SoundToggle />
      <button
        type="button"
        aria-label="Volume settings"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          touchTargetClass,
          "rounded-md text-muted hover:text-ink",
          focusRingClass,
        )}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open ? (
        <div
          id={panelId}
          className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-surface-line bg-surface-raised p-4 shadow-arena"
        >
          <SoundVolume />
        </div>
      ) : null}
    </div>
  );
}
