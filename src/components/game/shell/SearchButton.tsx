"use client";

import { OPEN_COMMAND_PALETTE } from "@/components/game/shell/hub-keys";
import { cn, focusRingClass, touchTargetClass } from "@/components/ui/styles";

/** Header button that opens the command palette (the only way on touch). */
export function SearchButton() {
  return (
    <button
      type="button"
      aria-label="Search"
      aria-haspopup="dialog"
      onClick={() => window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE))}
      className={cn(
        touchTargetClass,
        "shrink-0 rounded-lg border border-surface-line bg-surface-deep/60 text-soft hover:border-team-ink hover:text-team-ink",
        focusRingClass,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
    </button>
  );
}
