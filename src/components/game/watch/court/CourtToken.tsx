"use client";

import { cn, focusRingClass } from "@/components/ui/styles";
import { readableTextOnBackground } from "@/domain/color-contrast";
import type { PlayerId } from "@/domain/ids";
import type { CourtPlayer } from "@/state/watch-court-frame";
import type { WatchTeam } from "@/state/watch-game-view";
import { initialOf } from "./court-motion";

/** Tokens this close to a sideline (normalized x) anchor their label inward. */
const EDGE_LABEL_X = 0.15;

const SUB_CHIP_BASE =
  "pointer-events-none absolute left-1/2 -translate-x-1/2 rounded bg-black/80 px-1 text-sm font-medium leading-tight";

export const SUB_CHIP_CLASS = `${SUB_CHIP_BASE} bottom-[calc(50%+1.1rem)] sm:bottom-[calc(50%+1.3rem)]`;

/** Sub chip below the token, for tokens whose name label hangs above. */
const SUB_CHIP_BELOW_CLASS = `${SUB_CHIP_BASE} top-[calc(50%+1.1rem)] sm:top-[calc(50%+1.3rem)]`;

export function CourtToken(props: {
  player: CourtPlayer;
  team: WatchTeam;
  color: string;
  points: number;
  /** Index of the substitution that brought this player in, if current. */
  checkedIn: number | null;
  selected: boolean;
  onSelect?: (id: PlayerId) => void;
  /** Full-court edge colours: ring replaces the readable-ink border, halo sits outside it. */
  outline?: { ring: string; halo: string | null };
  /** Replaces the team-ink colour of the ball-handler ring and shooter glow. */
  accent?: string;
  /** Hang the name label above the token instead of below (near the near sideline). */
  labelAbove?: boolean;
}) {
  const { player, team, color } = props;
  const ink = readableTextOnBackground(color);
  const handler = player.role === "handler";
  const shooter = player.role === "shooter";
  // Near a sideline the label hangs inward so it stays on the court.
  const labelAlign =
    player.spot.x < EDGE_LABEL_X
      ? "left-2"
      : player.spot.x > 1 - EDGE_LABEL_X
        ? "right-2"
        : "left-1/2 -translate-x-1/2";
  const glow = shooter
    ? props.accent
      ? `0 0 10px 2px color-mix(in srgb, ${props.accent} 60%, transparent)`
      : "0 0 10px 2px rgb(var(--team-ink-rgb) / 0.6)"
    : null;
  const halo = props.outline?.halo ? `0 0 0 2px ${props.outline.halo}` : null;
  const boxShadow = [halo, glow].filter(Boolean).join(", ") || undefined;
  const name = `${player.fullName}, ${team.city} ${team.name}, ${props.points} pts${
    handler ? ", has the ball" : ""
  }${props.checkedIn !== null ? ", just checked in" : ""}`;
  return (
    <button
      type="button"
      aria-label={name}
      aria-pressed={props.selected}
      data-testid="court-token"
      data-player-id={player.playerId}
      data-role={player.role}
      onClick={() => props.onSelect?.(player.playerId)}
      className={cn(
        "court-token pointer-events-auto absolute left-0 top-0 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 touch-manipulation items-center justify-center rounded-full",
        focusRingClass,
      )}
    >
      <span
        key={props.checkedIn ?? "steady"}
        aria-hidden="true"
        className={cn(
          props.checkedIn !== null && "court-token-enter",
          "relative flex h-7 w-7 items-center justify-center rounded-full border-2 font-display text-sm font-semibold leading-none sm:h-8 sm:w-8",
        )}
        style={{
          backgroundColor: color,
          borderColor: props.outline?.ring ?? ink,
          color: ink,
          boxShadow,
        }}
      >
        {initialOf(player.label)}
        {handler ? (
          <span
            className={cn(
              "absolute -inset-1 rounded-full border-2",
              !props.accent && "border-team-ink",
            )}
            style={props.accent ? { borderColor: props.accent } : undefined}
          />
        ) : null}
        {props.selected ? (
          <span className="absolute -inset-1.5 rounded-full border-2 border-white bg-white/15" />
        ) : null}
      </span>
      {/* Floor shadow, painted under the disc. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -z-10 h-7 w-7 translate-x-0.5 translate-y-1 rounded-full bg-black/35 blur-[2px] sm:h-8 sm:w-8"
      />
      {props.checkedIn !== null ? (
        <span
          aria-hidden="true"
          className={cn(
            props.labelAbove ? SUB_CHIP_BELOW_CLASS : SUB_CHIP_CLASS,
            "text-zinc-50",
          )}
        >
          In
        </span>
      ) : null}
      <span
        aria-hidden="true"
        className={cn(
          "court-token-label pointer-events-none absolute max-w-[4.5rem] truncate text-sm font-medium leading-tight text-zinc-50 sm:max-w-24 rounded bg-black/70 px-1",
          props.labelAbove
            ? "bottom-[calc(50%+1rem)] sm:bottom-[calc(50%+1.25rem)]"
            : "top-[calc(50%+1rem)] sm:top-[calc(50%+1.25rem)]",
          labelAlign,
        )}
      >
        {player.label}
      </span>
    </button>
  );
}
