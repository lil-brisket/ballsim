"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Fades the in-save content column in on route change.
 *
 * Replays a Web Animation on the existing node instead of keying on the
 * pathname, so nested layouts and client state are never remounted. Opacity
 * only: a transform would briefly make the wrapper the containing block for
 * `position: fixed` overlays rendered inside pages. Skipped on first render
 * and under prefers-reduced-motion.
 */
export function RouteTransition(props: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const previousPathname = useRef(pathname);

  useEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    const node = ref.current;
    if (!node || typeof node.animate !== "function") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    node.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 220,
      easing: "cubic-bezier(0.2, 0.7, 0.2, 1)",
    });
  }, [pathname]);

  return (
    <div ref={ref} className={props.className}>
      {props.children}
    </div>
  );
}
