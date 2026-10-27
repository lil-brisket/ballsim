"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Keyboard behaviour for a hand-rolled modal panel: focus moves into it when
 * it opens (and returns to the opener on close), Tab and Shift+Tab wrap
 * inside it, and Escape calls `onEscape`.
 */
export function useModalKeys(
  panelRef: RefObject<HTMLElement | null>,
  active: boolean,
  onEscape: () => void,
) {
  const escapeRef = useRef(onEscape);
  useEffect(() => {
    escapeRef.current = onEscape;
  });

  useEffect(() => {
    if (!active) return;
    const opener = document.activeElement;
    const panel = panelRef.current;
    const first =
      panel?.querySelector<HTMLElement>(FOCUSABLE) ?? panel ?? undefined;
    first?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        escapeRef.current();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const nodes = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      );
      if (nodes.length === 0) {
        event.preventDefault();
        return;
      }
      const firstNode = nodes[0]!;
      const lastNode = nodes[nodes.length - 1]!;
      const current = document.activeElement;
      if (event.shiftKey && current === firstNode) {
        event.preventDefault();
        lastNode.focus();
      } else if (!event.shiftKey && current === lastNode) {
        event.preventDefault();
        firstNode.focus();
      } else if (!panelRef.current.contains(current)) {
        event.preventDefault();
        firstNode.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, [active, panelRef]);
}
