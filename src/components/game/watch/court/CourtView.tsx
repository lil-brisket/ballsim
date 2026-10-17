"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { HalfCourtLines } from "@/components/game/court/HalfCourtLines";
import { Button } from "@/components/ui/Button";
import { prefersReducedMotion } from "@/components/ui/CountUp";
import { cn, focusRingClass } from "@/components/ui/styles";
import {
  contrastRatio,
  readableTextOnBackground,
} from "@/domain/color-contrast";
import type { PlayerId } from "@/domain/ids";
import {
  COURT_FEET,
  type CourtFrame,
  type CourtLastPlay,
  type CourtPlayer,
  type CourtPoint,
  type CourtSubstitution,
} from "@/state/watch-court-frame";
import type {
  LiveBoxScore,
  WatchPlayer,
  WatchSide,
  WatchTeam,
} from "@/state/watch-game-view";

/** Away tokens switch to their secondary colour below this contrast ratio. */
const MIN_TEAM_CONTRAST = 1.5;

export type CourtStatus = "playing" | "paused" | "complete";

// "Replay complete", not "Final": the scoreboard already says Final.
const STATUS_LABEL: Record<CourtStatus, string> = {
  playing: "Live",
  paused: "Paused",
  complete: "Replay complete",
};

/** Tokens this close to a sideline (normalized x) anchor their label inward. */
const EDGE_LABEL_X = 0.15;

const pct = (value: number): string => `${Math.round(value * 10000) / 100}%`;

function lerpPoint(a: CourtPoint, b: CourtPoint, t: number): CourtPoint {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/**
 * Web Animations keyframes for the ball's latest play, or null when it did
 * not move. Shots and free throws arc over the final leg (a scale and lift
 * bump fakes height), rebounds drop from the rim, everything else is a
 * straight leg per waypoint pair.
 */
function ballMotion(
  play: CourtLastPlay,
): { keyframes: Keyframe[]; duration: number } | null {
  const path = play.path;
  if (path.length < 2) {
    return null;
  }
  const legs = path.length - 1;
  type Sample = { at: CourtPoint; lift: number; scale: number };
  const samples: Sample[] = [{ at: path[0]!, lift: 0, scale: 1 }];
  const arc = play.motion === "shot" || play.motion === "free_throw";
  const drop = play.motion === "rebound";
  for (let leg = 0; leg < legs; leg += 1) {
    const from = path[leg]!;
    const to = path[leg + 1]!;
    const curved = arc && leg === legs - 1;
    const steps = curved || drop ? 8 : 1;
    for (let step = 1; step <= steps; step += 1) {
      const t = step / steps;
      const bump = Math.sin(Math.PI * t);
      samples.push({
        at: lerpPoint(from, to, t),
        lift: curved ? 16 * bump : drop ? 14 * (1 - t) : 0,
        scale: curved ? 1 + 0.9 * bump : drop ? 1 + 0.8 * (1 - t) : 1,
      });
    }
  }
  const keyframes: Keyframe[] = samples.map((sample, i) => ({
    left: pct(sample.at.x),
    top: pct(sample.at.y),
    transform: `translateY(${-sample.lift}px) scale(${sample.scale})`,
    offset: i / (samples.length - 1),
  }));
  const duration = arc ? 200 * (legs - 1) + 700 : drop ? 500 : 250 * legs + 150;
  return { keyframes, duration };
}

function calloutText(
  play: CourtLastPlay,
  labelOf: (id: PlayerId | null) => string | null,
): string | null {
  const withName = (prefix: string, id: PlayerId | null) => {
    const name = labelOf(id);
    return name ? `${prefix} · ${name}` : prefix;
  };
  if (play.motion === "turnover") {
    return play.outcome === "stolen"
      ? withName("Steal", play.player2Id)
      : "Turnover";
  }
  if (play.outcome === "blocked") {
    return withName("Block", play.player2Id);
  }
  if (play.motion === "foul") {
    return play.kind === "offensive_foul"
      ? "Offensive foul"
      : withName("Foul", play.playerId);
  }
  return null;
}

function initialOf(label: string): string {
  const word = label.trim().split(/\s+/).pop() ?? "";
  return word.slice(0, 1).toUpperCase();
}

/**
 * Half-court replay: hand-built hardwood and lines (SVG), player tokens as
 * buttons positioned by percentage, and a ball animated with the Web
 * Animations API. Pure presentation of a `CourtFrame`; there is no per-frame
 * React state. Basket at the top, so frame (x, y) maps straight to (left, top).
 */
export function CourtView(props: {
  frame: CourtFrame;
  home: WatchTeam;
  away: WatchTeam;
  live: LiveBoxScore;
  showShotChart?: boolean;
  onShowShotChartChange?: (value: boolean) => void;
  selectedPlayerId?: PlayerId | null;
  onSelectPlayer?: (id: PlayerId) => void;
  /** Playback state shown above the court; omitted on the dev page. */
  status?: CourtStatus;
  /** Playback speed multiplier; motion durations are divided by it. */
  speed?: number;
  /** Period-end card text shown over the lower court; null or omitted hides it. */
  periodBreak?: string | null;
  /** Roster, used to name the outgoing player of a substitution. */
  players?: WatchPlayer[];
  className?: string;
}) {
  const { frame, home, away, live } = props;
  const speed = props.speed && props.speed > 0 ? props.speed : 1;
  const [localShotChart, setLocalShotChart] = useState(false);
  const showShotChart = props.showShotChart ?? localShotChart;

  const awayUsesSecondary =
    (contrastRatio(home.branding.primaryColor, away.branding.primaryColor) ??
      Infinity) < MIN_TEAM_CONTRAST;
  const colorOf = (side: WatchSide): string =>
    side === 0
      ? home.branding.primaryColor
      : awayUsesSecondary
        ? away.branding.secondaryColor
        : away.branding.primaryColor;
  const teamOf = (side: WatchSide) => (side === 0 ? home : away);

  const points = new Map<PlayerId, number>();
  for (const row of [...live.home.rows, ...live.away.rows]) {
    points.set(row.playerId, row.points);
  }
  const labels = new Map(frame.players.map((p) => [p.playerId, p.label]));
  const labelOf = (id: PlayerId | null): string | null =>
    id === null ? null : (labels.get(id) ?? null);

  const lastPlay = frame.lastPlay;
  const playIndex = lastPlay?.index ?? null;

  // Ball flight: animate only when the latest play changes, never on mount.
  const ballRef = useRef<HTMLDivElement>(null);
  const lastPlayRef = useRef(lastPlay);
  // Read at flight start, so a speed change never cancels a ball mid-air.
  const speedRef = useRef(speed);
  const shownIndex = useRef(playIndex);
  useLayoutEffect(() => {
    lastPlayRef.current = lastPlay;
    speedRef.current = speed;
  });
  useLayoutEffect(() => {
    if (shownIndex.current === playIndex) {
      return;
    }
    shownIndex.current = playIndex;
    const play = lastPlayRef.current;
    const el = ballRef.current;
    if (!play || !el || typeof el.animate !== "function") {
      return;
    }
    if (prefersReducedMotion()) {
      return;
    }
    const motion = ballMotion(play);
    if (!motion) {
      return;
    }
    const animation = el.animate(motion.keyframes, {
      duration: motion.duration / speedRef.current,
      easing: "linear",
    });
    return () => animation.cancel();
  }, [playIndex]);

  const rosterById = new Map((props.players ?? []).map((p) => [p.playerId, p]));
  const incoming = new Map<PlayerId, CourtSubstitution>(
    frame.substitutions.map((sub) => [sub.inId, sub]),
  );
  const ghosts = prefersReducedMotion()
    ? []
    : frame.substitutions.flatMap((sub) => {
        const outgoing = rosterById.get(sub.outId);
        const spot = frame.players.find((p) => p.playerId === sub.inId)?.spot;
        return outgoing && spot ? [{ sub, outgoing, spot }] : [];
      });

  const callout = lastPlay ? calloutText(lastPlay, labelOf) : null;
  const flashRim =
    lastPlay !== null &&
    lastPlay.outcome === "made" &&
    (lastPlay.motion === "shot" || lastPlay.motion === "free_throw");

  const toggleShotChart = () => {
    const next = !showShotChart;
    if (props.showShotChart === undefined) {
      setLocalShotChart(next);
    }
    props.onShowShotChartChange?.(next);
  };

  return (
    <div className={cn("space-y-2", props.className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
          {props.status ? (
            <p
              className="inline-flex items-center gap-2 text-sm text-zinc-300"
              data-testid="court-status"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "h-2 w-2 rounded-full",
                  props.status === "playing"
                    ? "team-pulse bg-team-ink"
                    : props.status === "paused"
                      ? "bg-zinc-500"
                      : "bg-zinc-300",
                )}
              />
              {STATUS_LABEL[props.status]}
            </p>
          ) : null}
          {frame.ballSide !== null ? (
            <p
              className="inline-flex items-center gap-1.5 text-sm text-zinc-300"
              data-testid="court-possession"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 8 10"
                className="h-2.5 w-2 fill-current"
              >
                <path d="M0 0 L8 5 L0 10 Z" />
              </svg>
              <span aria-hidden="true">
                {teamOf(frame.ballSide).abbreviation} ball
              </span>
              <span className="sr-only">
                Possession: {teamOf(frame.ballSide).city}{" "}
                {teamOf(frame.ballSide).name}
              </span>
            </p>
          ) : null}
        </div>
        <Button
          variant="secondary"
          aria-pressed={showShotChart}
          onClick={toggleShotChart}
        >
          Shot chart
        </Button>
      </div>
      <div
        role="group"
        aria-label="Court"
        className="court-floor relative mx-auto aspect-[50/47] w-full max-w-xl overflow-x-clip rounded-lg"
        data-testid="court-view"
        style={{ "--court-speed": speed } as CSSProperties}
      >
        <svg
          viewBox={`0 0 ${COURT_FEET.width} ${COURT_FEET.length}`}
          aria-hidden="true"
          className="absolute inset-0 h-full w-full rounded-lg text-team-ink"
        >
          <HalfCourtLines orientation="basket-top" />
          {flashRim ? (
            <circle
              key={`flash-${playIndex}`}
              className="court-rim-flash"
              cx={COURT_FEET.hoopX}
              cy={COURT_FEET.hoopY}
              r={COURT_FEET.rimRadius}
              fill="none"
              stroke="currentColor"
              strokeWidth="0.5"
              data-testid="court-rim-flash"
            />
          ) : null}
          {showShotChart
            ? frame.shots.map((shot) => {
                const cx = shot.at.x * COURT_FEET.width;
                const cy = shot.at.y * COURT_FEET.length;
                const color = colorOf(shot.side);
                return (
                  <g key={shot.index} data-testid="court-shot-marker">
                    {shot.made ? (
                      <circle
                        cx={cx}
                        cy={cy}
                        r="0.9"
                        fill={color}
                        stroke="#e4e4e7"
                        strokeWidth="0.3"
                      />
                    ) : (
                      <>
                        <circle
                          cx={cx}
                          cy={cy}
                          r="0.9"
                          fill="none"
                          stroke="#e4e4e7"
                          strokeWidth="0.7"
                        />
                        <circle
                          cx={cx}
                          cy={cy}
                          r="0.9"
                          fill="none"
                          stroke={color}
                          strokeWidth="0.3"
                        />
                      </>
                    )}
                  </g>
                );
              })
            : null}
        </svg>

        {frame.players.map((player) => (
          <Token
            key={player.playerId}
            player={player}
            team={teamOf(player.side)}
            color={colorOf(player.side)}
            points={points.get(player.playerId) ?? 0}
            checkedIn={incoming.get(player.playerId)?.index ?? null}
            selected={props.selectedPlayerId === player.playerId}
            onSelect={props.onSelectPlayer}
          />
        ))}

        {ghosts.map(({ sub, outgoing, spot }) => (
          <Ghost
            key={`ghost-${sub.index}`}
            initial={initialOf(outgoing.lastName)}
            color={colorOf(sub.side)}
            spot={spot}
          />
        ))}

        <div
          ref={ballRef}
          aria-hidden="true"
          data-testid="court-ball"
          className="pointer-events-none absolute z-20 -ml-1.5 -mt-1.5 h-3 w-3 rounded-full border border-black/50 bg-orange-500 shadow"
          style={{
            left: pct(frame.ball.at.x),
            top: pct(frame.ball.at.y),
          }}
        />

        {callout && lastPlay ? (
          <div
            key={lastPlay.index}
            className="court-callout pointer-events-none absolute z-30 -translate-x-1/2 whitespace-nowrap rounded-md bg-black/80 px-2 py-1 text-sm font-medium text-zinc-50"
            style={{
              left: `clamp(20%, ${pct(frame.ball.at.x)}, 80%)`,
              top: `calc(${pct(frame.ball.at.y)} + 12px)`,
            }}
            data-testid="court-callout"
          >
            {callout}
          </div>
        ) : null}

        {props.periodBreak ? (
          <div
            key={props.periodBreak}
            className="court-period-card pointer-events-none absolute bottom-3 left-1/2 z-30 max-w-[90%] -translate-x-1/2 whitespace-nowrap rounded-md bg-black/80 px-3 py-1.5 text-sm font-medium text-zinc-50"
            data-testid="court-period-card"
          >
            {props.periodBreak}
          </div>
        ) : null}
      </div>
    </div>
  );
}

const SUB_CHIP_CLASS =
  "pointer-events-none absolute bottom-[calc(50%+1.1rem)] left-1/2 -translate-x-1/2 rounded bg-black/80 px-1 text-sm font-medium leading-tight sm:bottom-[calc(50%+1.3rem)]";

/** Fading, non-interactive stand-in for the player who just left the floor. */
function Ghost(props: { initial: string; color: string; spot: CourtPoint }) {
  const ink = readableTextOnBackground(props.color);
  return (
    <div
      aria-hidden="true"
      data-testid="court-sub-ghost"
      className="court-ghost pointer-events-none absolute z-[5] flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
      style={{ left: pct(props.spot.x), top: pct(props.spot.y) }}
    >
      <span
        className="flex h-7 w-7 items-center justify-center rounded-full border-2 font-display text-sm font-semibold leading-none sm:h-8 sm:w-8"
        style={{
          backgroundColor: props.color,
          borderColor: ink,
          color: ink,
        }}
      >
        {props.initial}
      </span>
      <span className={cn(SUB_CHIP_CLASS, "text-zinc-300")}>Out</span>
    </div>
  );
}

function Token(props: {
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
