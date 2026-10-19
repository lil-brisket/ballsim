"use client";

import { cn, focusRingClass } from "@/components/ui/styles";
import { readableTextOnBackground } from "@/domain/color-contrast";
import type { PlayerId } from "@/domain/ids";
import type { LabelSide } from "@/state/court-label-layout";
import type { CourtRole } from "@/state/watch-court-frame";
import type { WatchSide, WatchTeam } from "@/state/watch-game-view";

/** Where the name label span sits relative to the 44px button. */
const LABEL_SIDE_CLASS: Record<LabelSide, string> = {
  below:
    "top-[calc(50%+1rem)] left-1/2 -translate-x-1/2 sm:top-[calc(50%+1.25rem)]",
  above:
    "bottom-[calc(50%+1rem)] left-1/2 -translate-x-1/2 sm:bottom-[calc(50%+1.25rem)]",
  right:
    "left-[calc(50%+1.1rem)] top-1/2 -translate-y-1/2 sm:left-[calc(50%+1.35rem)]",
  left: "right-[calc(50%+1.1rem)] top-1/2 -translate-y-1/2 sm:right-[calc(50%+1.35rem)]",
};

const SUB_CHIP_BASE =
  "pointer-events-none absolute left-1/2 -translate-x-1/2 rounded bg-black/80 px-1 text-sm font-medium leading-tight";

const SUB_CHIP_CLASS = `${SUB_CHIP_BASE} bottom-[calc(50%+1.1rem)] sm:bottom-[calc(50%+1.3rem)]`;

/** Sub chip below the token, for tokens whose name label hangs above. */
const SUB_CHIP_BELOW_CLASS = `${SUB_CHIP_BASE} top-[calc(50%+1.1rem)] sm:top-[calc(50%+1.3rem)]`;

export function CourtToken(props: {
  /** A floor player, or a bench player (no role). */
  player: {
    playerId: PlayerId;
    side: WatchSide;
    fullName: string;
    label: string;
    role?: CourtRole;
  };
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
  /** Which side of the token the name label sits on. */
  labelSide: LabelSide;
  /** Label always visible (ball handler, shooter, selected); else on hover/focus. */
  labelShown: boolean;
  /** Jersey number, or the unique two-letter monogram, shown on the disc. */
  badge: string;
  /** Sitting on the bench: smaller and muted, name only on hover or focus. */
  bench?: boolean;
  /** Bench only: out of the game on six fouls. */
  fouledOut?: boolean;
  /**
   * A block or steal made by this player on the latest play: a flash ring and
   * a quick leap once the event happens (`delayMs`, already scaled by speed).
   * `key` is the play index, so the animation replays for every play.
   */
  impact?: { key: number; delayMs: number; paused: boolean };
}) {
  const { player, team, color } = props;
  const ink = readableTextOnBackground(color);
  const handler = player.role === "handler";
  const shooter = player.role === "shooter";
  const glow = shooter
    ? props.accent
      ? `0 0 10px 2px color-mix(in srgb, ${props.accent} 60%, transparent)`
      : "0 0 10px 2px rgb(var(--team-ink-rgb) / 0.6)"
    : null;
  const halo = props.outline?.halo ? `0 0 0 2px ${props.outline.halo}` : null;
  const boxShadow = [halo, glow].filter(Boolean).join(", ") || undefined;
  const bench = props.bench ?? false;
  const name = bench
    ? `${player.fullName}, ${team.city} ${team.name}, bench${
        props.fouledOut ? ", fouled out" : ""
      }`
    : `${player.fullName}, ${team.city} ${team.name}, ${props.points} pts${
        handler ? ", has the ball" : ""
      }${props.checkedIn !== null ? ", just checked in" : ""}`;
  return (
    <button
      type="button"
      aria-label={name}
      aria-pressed={props.selected}
      data-testid="court-token"
      data-player-id={player.playerId}
      data-role={bench ? "bench" : player.role}
      onClick={() => props.onSelect?.(player.playerId)}
      className={cn(
        "court-token pointer-events-auto absolute left-0 top-0 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 touch-manipulation items-center justify-center rounded-full",
        focusRingClass,
      )}
    >
      <span
        key={props.impact ? `impact-${props.impact.key}` : "idle"}
        aria-hidden="true"
        className={cn(
          bench && "scale-[0.85] opacity-75",
          props.impact && "court-leap",
          "relative flex h-7 w-7 items-center justify-center rounded-full font-display text-sm font-semibold leading-none tabular-nums tracking-tight sm:h-8 sm:w-8",
          player.side === 1 ? "border-[3px] border-double" : "border-2",
        )}
        data-ring={player.side === 1 ? "double" : "solid"}
        style={{
          backgroundColor: color,
          borderColor: props.outline?.ring ?? ink,
          color: ink,
          boxShadow,
          ...(props.impact
            ? {
                animationDelay: `${Math.round(props.impact.delayMs)}ms`,
                animationPlayState: props.impact.paused ? "paused" : undefined,
              }
            : null),
        }}
      >
        {props.badge}
        {props.impact ? (
          <span
            className="court-impact-ring absolute -inset-2 rounded-full border-[3px]"
            data-testid="court-impact-ring"
            style={{
              borderColor: props.accent ?? ink,
              animationDelay: `${Math.round(props.impact.delayMs)}ms`,
              animationPlayState: props.impact.paused ? "paused" : undefined,
            }}
          />
        ) : null}
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
      {props.fouledOut ? (
        <span
          aria-hidden="true"
          className={cn(SUB_CHIP_BELOW_CLASS, "whitespace-nowrap text-zinc-50")}
        >
          Fouled out
        </span>
      ) : null}
      {props.checkedIn !== null ? (
        <span
          aria-hidden="true"
          className={cn(
            props.labelSide === "above" ? SUB_CHIP_BELOW_CLASS : SUB_CHIP_CLASS,
            "text-zinc-50",
          )}
        >
          In
        </span>
      ) : null}
      <span
        aria-hidden="true"
        data-label={props.labelShown ? "shown" : "hover"}
        className={cn(
          "court-token-label pointer-events-none absolute max-w-[4.5rem] truncate text-sm font-medium leading-tight text-zinc-50 sm:max-w-24 rounded bg-black/70 px-1",
          LABEL_SIDE_CLASS[props.labelSide],
        )}
      >
        {player.label}
      </span>
    </button>
  );
}
