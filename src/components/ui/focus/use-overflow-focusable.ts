"use client";

import { useEffect, type RefObject } from "react";

/**
 * Makes a horizontally scrolling region keyboard reachable only while it
 * actually overflows (tabIndex 0), so arrow keys can scroll it; otherwise it
 * stays out of the Tab order. Keeps the region accessible on phones without
 * adding a tab stop to every strip on wide screens.
 */
export function useOverflowFocusable(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const update = () => {
      if (node.scrollWidth > node.clientWidth + 1) {
        node.tabIndex = 0;
      } else {
        node.removeAttribute("tabindex");
      }
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);
}
