"use client";

import { useEffect, useState } from "react";

/** True when the user asked for reduced motion. False during SSR. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Counts from 0 up to `value` after mount. The first render (and SSR) shows the
 * final value so there is no hydration mismatch; under reduced motion, or
 * without `matchMedia`, it never animates.
 */
export function CountUp(props: {
  value: number;
  durationMs?: number;
  className?: string;
}) {
  const { value, durationMs = 900 } = props;
  const [anim, setAnim] = useState<{ target: number; shown: number } | null>(
    null,
  );

  useEffect(() => {
    if (
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
      setAnim({ target: value, shown: Math.round(value * eased) });
      if (t < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [value, durationMs]);

  const shown = anim && anim.target === value ? anim.shown : value;

  return (
    <span className={props.className}>
      <span aria-hidden>{shown}</span>
      <span className="sr-only">{value}</span>
    </span>
  );
}
