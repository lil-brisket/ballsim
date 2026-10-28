"use client";

import { useEffect, useState } from "react";
import { prefersReducedMotion } from "@/components/ui/CountUp";
import { OvrBadge, type OvrBadgeSize } from "@/components/ui/OvrBadge";

/**
 * OVR badge that steps from `from` to `to` after mount. The first render (and
 * SSR) shows `to`, so there is no hydration mismatch; under reduced motion it
 * never animates. The accessible name is always the final value.
 */
export function AnimatedOvrBadge(props: {
  from: number;
  to: number;
  size?: OvrBadgeSize;
  durationMs?: number;
}) {
  const { from, to, durationMs = 900 } = props;
  const [anim, setAnim] = useState<{ key: string; shown: number } | null>(null);
  const key = `${from}:${to}`;

  useEffect(() => {
    if (
      from === to ||
      prefersReducedMotion() ||
      typeof window.requestAnimationFrame !== "function"
    ) {
      return;
    }
    let frame = 0;
    let start: number | null = null;
    const tick = (now: number) => {
      start ??= now;
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setAnim({ key, shown: Math.round(from + (to - from) * eased) });
      if (t < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [from, to, durationMs, key]);

  const shown = anim && anim.key === key ? anim.shown : to;

  return (
    <span className="inline-block">
      <span aria-hidden="true">
        <OvrBadge overall={shown} size={props.size} />
      </span>
      <span className="sr-only">Overall {to}</span>
    </span>
  );
}
