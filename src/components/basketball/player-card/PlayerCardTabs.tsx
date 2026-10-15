"use client";

import { useRef } from "react";
import { cn, focusRingClass } from "@/components/ui/styles";

export const PLAYER_CARD_TABS = [
  { id: "overview", label: "Overview" },
  { id: "attributes", label: "Attributes" },
  { id: "statistics", label: "Statistics" },
  { id: "development", label: "Development" },
] as const;

export type PlayerCardTabId = (typeof PLAYER_CARD_TABS)[number]["id"];

export function tabDomId(baseId: string, tab: PlayerCardTabId): string {
  return `${baseId}-tab-${tab}`;
}

export function panelDomId(baseId: string, tab: PlayerCardTabId): string {
  return `${baseId}-panel-${tab}`;
}

export function PlayerCardTabList(props: {
  baseId: string;
  active: PlayerCardTabId;
  onChange: (tab: PlayerCardTabId) => void;
  className?: string;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function select(index: number, focus: boolean) {
    const count = PLAYER_CARD_TABS.length;
    const next = PLAYER_CARD_TABS[(index + count) % count];
    props.onChange(next.id);
    if (focus) refs.current[next.id]?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent, index: number) {
    switch (event.key) {
      case "ArrowRight":
        event.preventDefault();
        select(index + 1, true);
        break;
      case "ArrowLeft":
        event.preventDefault();
        select(index - 1, true);
        break;
      case "Home":
        event.preventDefault();
        select(0, true);
        break;
      case "End":
        event.preventDefault();
        select(PLAYER_CARD_TABS.length - 1, true);
        break;
    }
  }

  return (
    <div
      role="tablist"
      aria-label="Player card sections"
      className={cn("flex gap-1 overflow-x-auto", props.className)}
    >
      {PLAYER_CARD_TABS.map((tab, index) => {
        const selected = tab.id === props.active;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              refs.current[tab.id] = el;
            }}
            type="button"
            role="tab"
            id={tabDomId(props.baseId, tab.id)}
            aria-selected={selected}
            // Only the active panel is rendered, so only it can be controlled.
            aria-controls={
              selected ? panelDomId(props.baseId, tab.id) : undefined
            }
            tabIndex={selected ? 0 : -1}
            onClick={() => props.onChange(tab.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              "min-h-11 shrink-0 flex-1 whitespace-nowrap border-b-2 px-3 font-mono text-xs uppercase tracking-[0.14em] transition-colors",
              selected
                ? "border-amber-500 text-amber-300"
                : "border-transparent text-zinc-400 hover:text-zinc-100",
              focusRingClass,
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export function PlayerCardTabPanel(props: {
  baseId: string;
  tab: PlayerCardTabId;
  children: React.ReactNode;
}) {
  return (
    <div
      role="tabpanel"
      id={panelDomId(props.baseId, props.tab)}
      aria-labelledby={tabDomId(props.baseId, props.tab)}
      className="space-y-6 pt-4"
    >
      {props.children}
    </div>
  );
}
