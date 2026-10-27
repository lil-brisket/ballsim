"use client";

import { useEffect, useState, ViewTransition } from "react";
import { usePathname } from "next/navigation";

/**
 * Animates the in-save content column when the route changes.
 *
 * Browsers with the View Transitions API get React's `<ViewTransition>`: the
 * page content is its own snapshot (`page-content`), so the sticky header and
 * bottom bars, which carry their own transition names, stay still while it
 * slides (hub change; `hub-forward` / `hub-back` types from the hub links and
 * keys) or crossfades (any other path change). A snapshot is animated by the
 * browser, so it never makes the wrapper a containing block for
 * `position: fixed` overlays inside pages the way a CSS transform on it would.
 * The CSS lives in the "Page transitions" section of globals.css.
 *
 * Browsers without the API fall back to an opacity-only Web Animation on the
 * existing node (never both). That one stays opacity-only for the same
 * containing-block reason. Neither path remounts nested layouts or client
 * state, and both are skipped under prefers-reduced-motion.
 */
export function RouteTransition(props: {
  children: React.ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  const [settledPathname, setSettledPathname] = useState(pathname);
  // True only in the render that carries a path change, so refreshes and
  // in-place updates (same path) never trigger the content crossfade.
  const navigated = settledPathname !== pathname;

  const [node, setNode] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    // Settle after the commit that carried the path change, so `navigated`
    // is true for exactly that render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettledPathname(pathname);
  }, [pathname]);

  useEffect(() => {
    if (!navigated || !node) return;
    if (typeof document.startViewTransition === "function") return;
    if (typeof node.animate !== "function") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    node.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 220,
      easing: "cubic-bezier(0.2, 0.7, 0.2, 1)",
    });
  }, [navigated, node]);

  return (
    <ViewTransition
      name="page-content"
      default="none"
      enter="none"
      exit="none"
      share="none"
      update={
        navigated
          ? {
              "hub-forward": "hub-forward",
              "hub-back": "hub-back",
              default: "page-fade",
            }
          : "none"
      }
    >
      <div ref={setNode} className={props.className}>
        {props.children}
      </div>
    </ViewTransition>
  );
}
