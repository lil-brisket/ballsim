"use client";

import { cn, focusRingClass } from "@/components/ui/styles";
import { readableTextOnBackground } from "@/domain/color-contrast";
import type { PlayerId } from "@/domain/ids";
import type { CourtPlayer } from "@/state/watch-court-frame";
import type { WatchTeam } from "@/state/watch-game-view";
import { initialOf, pct } from "./court-motion";

/** Tokens this close to a sideline (normalized x) anchor their label inward. */
const EDGE_LABEL_X = 0.15;

export const SUB_CHIP_CLASS =
  "pointer-events-none absolute bottom-[calc(50%+1.1rem)] left-1/2 -translate-x-1/2 rounded bg-black/80 px-1 text-sm font-medium leading-tight sm:bottom-[calc(50%+1.3rem)]";

export function CourtToken(props: {
  player: CourtPlayer;
  team: WatchTeam;
  color: string;
  points: number;
  /** Index of the substitution that brought this player in, if current. */
  checkedIn: number | null;
  selected: boolean;
  onSelect?: (id: PlayerId) => void;
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
        "court-token absolute z-10 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 touch-manipulation items-center justify-center rounded-full",
        focusRingClass,
      )}
      style={{ left: pct(player.spot.x), top: pct(player.spot.y) }}
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
          borderColor: ink,
          color: ink,
          boxShadow: shooter
            ? "0 0 10px 2px rgb(var(--team-ink-rgb) / 0.6)"
            : undefined,
        }}
      >
        {initialOf(player.label)}
        {handler ? (
          <span className="absolute -inset-1 rounded-full border-2 border-team-ink" />
        ) : null}
        {props.selected ? (
          <span className="absolute -inset-1.5 rounded-full border-2 border-white bg-white/15" />
        ) : null}
      </span>
      {props.checkedIn !== null ? (
        <span aria-hidden="true" className={cn(SUB_CHIP_CLASS, "text-zinc-50")}>
          In
        </span>
      ) : null}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute top-[calc(50%+1rem)] max-w-[4.5rem] truncate text-sm font-medium leading-tight text-zinc-50 sm:top-[calc(50%+1.25rem)] sm:max-w-24",
          labelAlign,
        )}
        style={{ textShadow: "0 1px 2px rgb(0 0 0 / 0.9)" }}
      >
        {player.label}
      </span>
    </button>
  );
}
