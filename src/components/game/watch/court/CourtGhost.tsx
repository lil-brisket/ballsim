"use client";

import { cn } from "@/components/ui/styles";
import { readableTextOnBackground } from "@/domain/color-contrast";
import type { CourtPoint } from "@/state/watch-court-frame";
import { pct } from "./court-motion";
import { SUB_CHIP_CLASS } from "./CourtToken";

/** Fading, non-interactive stand-in for the player who just left the floor. */
export function CourtGhost(props: {
  initial: string;
  color: string;
  spot: CourtPoint;
}) {
  const ink = readableTextOnBackground(props.color);
  return (
    <div
      aria-hidden="true"
      data-testid="court-sub-ghost"
      className="court-ghost pointer-events-none absolute z-[5] flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
      style={{ left: pct(props.spot.x), top: pct(props.spot.y) }}
    >
      <span
        className="flex h-7 w-7 items-center justify-center rounded-full border-2 font-display text-sm font-semibold leading-none tracking-tight sm:h-8 sm:w-8"
        style={{
          backgroundColor: props.color,
          borderColor: ink,
          color: ink,
        }}
      >
        {props.initial}
      </span>
      <span className={cn(SUB_CHIP_CLASS, "text-zinc-300")}>Out</span>
    </div>
  );
}
