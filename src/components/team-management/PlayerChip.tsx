"use client";

import { PlayerPortrait } from "@/components/basketball/PlayerPortrait";
import { AvailabilityDot } from "@/components/team-management/availability-dot";
import { cn, focusRingClass } from "@/components/ui/styles";
import type { PlayerPortraitAssignment } from "@/domain/entities/player-portrait";

export type ChipPlayer = {
  playerId: string;
  firstName: string;
  lastName: string;
  position: string;
  overall?: number;
  availabilityLabel: string;
};

/**
 * Player chip: portrait, name, OVR and a status dot. Always a real button so
 * it is focusable and 44px+ tall. Use `slotLabel` for court positions and
 * `pressed` for toggle chips (closing lineup).
 */
export function PlayerChip(props: {
  player: ChipPlayer | null;
  portrait?: PlayerPortraitAssignment | null;
  slotLabel?: string;
  onClick?: () => void;
  /** Set when the chip opens the player picker dialog. */
  opensPicker?: boolean;
  pressed?: boolean;
  disabled?: boolean;
  /** Display only: renders a non-interactive tile instead of a button. */
  readOnly?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  const { player } = props;
  const slot = props.slotLabel;
  const label =
    props["aria-label"] ??
    (player
      ? `${slot ? `${slot}: ` : ""}${player.firstName} ${player.lastName}, overall ${player.overall ?? "unknown"}, ${player.availabilityLabel}${props.opensPicker ? ". Change player" : ""}`
      : `${slot ?? "Slot"}: empty. Choose player`);
  const hidden = props.readOnly ? undefined : true;
  const className = cn(
    "flex min-h-11 w-24 touch-manipulation flex-col items-center gap-1 rounded-lg border px-1.5 py-2 text-center transition active:opacity-80 disabled:opacity-50 sm:w-28",
    props.pressed
      ? "border-team-ink bg-team text-on-team"
      : "border-zinc-700 bg-zinc-900/90 text-zinc-100 hover:border-team-ink",
    props.readOnly ? "" : focusRingClass,
    props.className,
  );
  const content = (
    <>
      {player ? (
        <>
          <PlayerPortrait
            playerId={player.playerId}
            firstName={player.firstName}
            lastName={player.lastName}
            portrait={props.portrait}
            size="sm"
          />
          <span className="w-full truncate text-sm font-medium">
            {player.lastName}
          </span>
          <span className="flex items-center justify-center gap-1.5 text-sm tabular-nums">
            {slot ? <span aria-hidden={hidden}>{slot}</span> : null}
            <span aria-hidden={hidden}>{player.overall ?? "–"}</span>
            <AvailabilityDot status={player.availabilityLabel} />
          </span>
        </>
      ) : (
        <>
          <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-dashed border-zinc-600 text-zinc-400">
            +
          </span>
          <span className="text-sm text-zinc-400">{slot ?? "Empty"}</span>
        </>
      )}
    </>
  );
  if (props.readOnly) {
    return <div className={className}>{content}</div>;
  }
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      aria-label={label}
      aria-haspopup={props.opensPicker ? "dialog" : undefined}
      aria-pressed={props.pressed}
      className={className}
    >
      {content}
    </button>
  );
}
