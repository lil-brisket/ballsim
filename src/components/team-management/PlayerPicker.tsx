"use client";

import { useRef } from "react";
import { AvailabilityDot } from "@/components/team-management/availability-dot";
import { Drawer } from "@/components/ui/Drawer";
import { cn, focusRingClass } from "@/components/ui/styles";

export type PickerPlayer = {
  playerId: string;
  firstName: string;
  lastName: string;
  position: string;
  overall: number;
  availabilityLabel: string;
};

/**
 * Player picker dialog (full-height sheet on mobile, centred dialog on
 * desktop) built on Drawer, which moves focus into the dialog, traps Tab,
 * closes on Escape and returns focus to the chip that opened it. The list is
 * keyboard selectable: Arrow keys / Home / End move, Enter or Space selects.
 */
export function PlayerPicker(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  players: PickerPlayer[];
  currentPlayerId: string;
  onSelect: (playerId: string) => void;
}) {
  const listRef = useRef<HTMLUListElement>(null);

  function moveFocus(from: HTMLElement, key: string) {
    const items = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>("button") ?? [],
    );
    const index = items.indexOf(from);
    let next = index;
    if (key === "ArrowDown") next = Math.min(items.length - 1, index + 1);
    else if (key === "ArrowUp") next = Math.max(0, index - 1);
    else if (key === "Home") next = 0;
    else if (key === "End") next = items.length - 1;
    items[next]?.focus();
  }

  return (
    <Drawer
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={props.title}
      description={props.description}
      size="sm"
    >
      {props.players.length === 0 ? (
        <p className="text-sm text-muted">No eligible players.</p>
      ) : (
        <ul ref={listRef} className="space-y-1">
          {props.players.map((player) => {
            const current = player.playerId === props.currentPlayerId;
            return (
              <li key={player.playerId}>
                <button
                  type="button"
                  aria-current={current ? "true" : undefined}
                  onClick={() => {
                    props.onSelect(player.playerId);
                    props.onOpenChange(false);
                  }}
                  onKeyDown={(event) => {
                    if (
                      ["ArrowDown", "ArrowUp", "Home", "End"].includes(
                        event.key,
                      )
                    ) {
                      event.preventDefault();
                      moveFocus(event.currentTarget, event.key);
                    }
                  }}
                  className={cn(
                    "flex min-h-11 w-full touch-manipulation items-center gap-3 rounded-md border px-3 py-2 text-left text-sm hover:border-team-ink",
                    current
                      ? "border-team-ink bg-team/15 text-ink"
                      : "border-line text-ink",
                    focusRingClass,
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">
                    {player.firstName} {player.lastName}
                    {current ? " (current)" : ""}
                  </span>
                  <span className="w-8 text-muted">{player.position}</span>
                  <span className="w-8 text-right tabular-nums">
                    {player.overall}
                  </span>
                  <span className="flex w-28 items-center gap-1.5 text-muted">
                    <AvailabilityDot status={player.availabilityLabel} />
                    <span className="truncate">{player.availabilityLabel}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Drawer>
  );
}
