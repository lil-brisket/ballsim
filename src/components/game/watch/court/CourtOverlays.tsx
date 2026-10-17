"use client";

import type { CourtPoint } from "@/state/watch-court-frame";
import { pct } from "./court-motion";

/** Steal/block/foul label under the ball. Key it by play index so the fade replays. */
export function CourtCallout(props: { text: string; at: CourtPoint }) {
  return (
    <div
      className="court-callout pointer-events-none absolute z-30 -translate-x-1/2 whitespace-nowrap rounded-md bg-black/80 px-2 py-1 text-sm font-medium text-zinc-50"
      style={{
        left: `clamp(20%, ${pct(props.at.x)}, 80%)`,
        top: `calc(${pct(props.at.y)} + 12px)`,
      }}
      data-testid="court-callout"
    >
      {props.text}
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
