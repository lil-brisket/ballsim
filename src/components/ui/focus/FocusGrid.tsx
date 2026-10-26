"use client";

import { useEffect, useRef } from "react";
import {
  directionForKey,
  nearestInDirection,
} from "@/components/ui/focus/geometry";
import { isKeyboardMode } from "@/components/ui/focus/input-mode";
import { playUiSound } from "@/components/ui/sound/ui-sound";

const ITEM_SELECTOR = "[data-focus-item]";
const STORAGE_PREFIX = "ballsim:focus:";

function readMemory(key: string): string | null {
  try {
    return window.sessionStorage.getItem(STORAGE_PREFIX + key);
  } catch {
    return null;
  }
}

function writeMemory(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(STORAGE_PREFIX + key, value);
  } catch {
    // Storage blocked: focus memory is a convenience only.
  }
}

function itemId(element: HTMLElement): string | null {
  return element.dataset.focusKey ?? element.getAttribute("href");
}

/**
 * Arrow-key cursor over a board of focusable items (`data-focus-item`, e.g.
 * HubTile). Arrows move by on-screen position; Tab order is untouched and
 * Enter is the item's own link/button behaviour. With `memoryKey`, the last
 * focused item is remembered for the session and refocused when the viewer
 * comes back by keyboard.
 */
export function FocusGrid(props: {
  children: React.ReactNode;
  className?: string;
  memoryKey?: string;
  "aria-label"?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { memoryKey } = props;

  useEffect(() => {
    if (!memoryKey || !isKeyboardMode()) return;
    const remembered = readMemory(memoryKey);
    if (!remembered) return;
    const items = ref.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR);
    const match = Array.from(items ?? []).find(
      (item) => itemId(item) === remembered,
    );
    match?.focus({ preventScroll: false });
  }, [memoryKey]);

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

  function onFocus(event: React.FocusEvent<HTMLDivElement>) {
    if (!memoryKey) return;
    const target = (event.target as HTMLElement).closest<HTMLElement>(
      ITEM_SELECTOR,
    );
    const id = target ? itemId(target) : null;
    if (id) writeMemory(memoryKey, id);
  }

  return (
    <div
      ref={ref}
      role={props["aria-label"] ? "group" : undefined}
      aria-label={props["aria-label"]}
      className={props.className}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
    >
      {props.children}
    </div>
  );
}
