"use client";

import { useRef } from "react";
import {
  directionForKey,
  nearestInDirection,
} from "@/components/ui/focus/geometry";
import { playUiSound } from "@/components/ui/sound/ui-sound";

const ITEM_SELECTOR = "[data-focus-item]";

/**
 * Arrow-key cursor over a board of focusable items (`data-focus-item`, e.g.
 * HubTile). Arrows move by on-screen position; Tab order is untouched and
 * Enter is the item's own link/button behaviour.
 */
export function FocusGrid(props: {
  children: React.ReactNode;
  className?: string;
  "aria-label"?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function items(): HTMLElement[] {
    return Array.from(
      ref.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? [],
    ).filter(
      (item) => item.offsetParent !== null || item === document.activeElement,
    );
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const direction = directionForKey(event.key);
    if (!direction || event.altKey || event.ctrlKey || event.metaKey) return;
    const list = items();
    const from = list.indexOf(document.activeElement as HTMLElement);
    if (from === -1) return;
    const rects = list.map((item) => item.getBoundingClientRect());
    const next = nearestInDirection(rects, from, direction);
    if (next === undefined) return;
    event.preventDefault();
    list[next]!.focus();
    if (document.activeElement === list[next]) playUiSound("move");
  }

  return (
    <div
      ref={ref}
      role={props["aria-label"] ? "group" : undefined}
      aria-label={props["aria-label"]}
      className={props.className}
      onKeyDown={onKeyDown}
    >
      {props.children}
    </div>
  );
}
