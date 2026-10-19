"use client";

import type { CourtPoint } from "@/state/watch-court-frame";
import { cn } from "@/components/ui/styles";
import { pct } from "./court-motion";

/** Steal/block/foul label under the ball. Key it by play index so the fade replays. */
export function CourtCallout(props: {
  text: string;
  at: CourtPoint;
  /** Wait (ms, already scaled by speed) before it shows. */
  delayMs?: number;
  paused?: boolean;
  /**
   * Blocks and steals: bolder text with a ring in the acting team's colour.
   */
  accent?: string;
}) {
  return (
    <div
      className={cn(
        "court-callout pointer-events-none absolute z-30 -translate-x-1/2 whitespace-nowrap rounded-md bg-black/80 px-2 py-1 text-sm font-medium text-zinc-50",
        props.accent && "px-3 py-1.5 font-bold uppercase tracking-wide",
      )}
      style={{
        left: `clamp(20%, ${pct(props.at.x)}, 80%)`,
        top: `calc(${pct(props.at.y)} + 12px)`,
        animationDelay: `${Math.round(props.delayMs ?? 0)}ms`,
        animationPlayState: props.paused ? "paused" : undefined,
        boxShadow: props.accent ? `0 0 0 2px ${props.accent}` : undefined,
      }}
      data-testid="court-callout"
      data-emphasis={props.accent ? "strong" : undefined}
    >
      {props.text}
    </div>
  );
}

/**
 * Dead-ball marker at a foul: a whistle that appears when the whistle blows
 * (`delayMs`, already scaled by speed) and stays until the next play is
 * revealed. Key it by play index. Decorative: the callout carries the text.
 */
export function CourtWhistle(props: {
  at: CourtPoint;
  delayMs?: number;
  paused?: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className="court-whistle pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-full rounded-full bg-black/80 px-1.5 py-0.5 text-sm leading-none text-zinc-50"
      style={{
        left: pct(props.at.x),
        top: `calc(${pct(props.at.y)} - 10px)`,
        animationDelay: `${Math.round(props.delayMs ?? 0)}ms`,
        animationPlayState: props.paused ? "paused" : undefined,
      }}
      data-testid="court-whistle"
    >
      <svg viewBox="0 0 16 12" className="h-3 w-4 fill-current">
        <circle cx="5" cy="7" r="4.5" />
        <rect x="5" y="2" width="11" height="3" rx="1" />
      </svg>
    </div>
  );
}

/** Period-end or final card, centred over the camera view. */
export function CourtPeriodCard(props: { text: string }) {
  return (
    <div
      className="court-period-card pointer-events-none absolute left-1/2 top-1/2 z-40 max-w-[90%] -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-md bg-black/80 px-3 py-1.5 text-sm font-medium text-zinc-50"
      data-testid="court-period-card"
    >
      {props.text}
    </div>
  );
}
