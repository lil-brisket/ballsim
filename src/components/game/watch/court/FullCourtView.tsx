"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { FullCourtLines } from "@/components/game/court/FullCourtLines";
import { prefersReducedMotion } from "@/components/ui/CountUp";
import { cn } from "@/components/ui/styles";
import { TeamLogoMark } from "@/components/team/logos/TeamLogoMark";
import type { PlayerId } from "@/domain/ids";
import { buildCourtPalette, tokenOutline } from "@/state/court-palette";
import {
  COURT_FEET,
  type CourtPoint,
  type CourtSubstitution,
} from "@/state/watch-court-frame";
import { FULL_COURT_FEET, type FullCourtFrame } from "@/state/watch-full-court";
import type {
  LiveBoxScore,
  WatchPlayer,
  WatchSide,
  WatchTeam,
} from "@/state/watch-game-view";
import { CourtGhost } from "./CourtGhost";
import { CourtHeader, type CourtStatus } from "./CourtHeader";
import { CourtCallout, CourtPeriodCard } from "./CourtOverlays";
import { CourtToken } from "./CourtToken";
import {
  CUT_MS,
  calloutText,
  fullCourtBallMotion,
  initialOf,
  pct,
} from "./court-motion";
import { teamTokenColor } from "./team-token-colors";

const LENGTH = FULL_COURT_FEET.length;
const WIDTH = FULL_COURT_FEET.width;
/** Tokens below this normalized y hang their label above, to stay on the floor. */
const LABEL_ABOVE_Y = 0.85;

/** Centre logo opacity once the game is over. */
const FINAL_LOGO_OPACITY = 0.7;

const WORDMARK_CLASS =
  "pointer-events-none absolute flex items-center justify-center font-display text-sm font-semibold uppercase tracking-wide";

/**
 * Full-court replay: player tokens, ball and callouts on a
 * landscape 94 × 50 ft floor painted in the home team's colours, with the
 * home wordmarks on the apron and its logo at centre court. Baselines are the
 * left and right edges, so frame (x, y) maps straight to (left, top).
 */
export function FullCourtView(props: {
  frame: FullCourtFrame;
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
  /** Scoring run in progress, shown on the courtside ribbon. */
  run?: { side: WatchSide; points: number } | null;
  /** The game is over: the centre logo brightens. */
  final?: boolean;
  className?: string;
}) {
  const { frame, home, away, live } = props;
  const speed = props.speed && props.speed > 0 ? props.speed : 1;
  const [localShotChart, setLocalShotChart] = useState(false);
  const showShotChart = props.showShotChart ?? localShotChart;

  const palette = buildCourtPalette(home.hasBranding ? home.branding : null);
  const colorOf = teamTokenColor(home, away);
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
  const transitionRef = useRef(frame.transition);
  // Read at flight start, so a speed change never cancels a ball mid-air.
  const speedRef = useRef(speed);
  const shownIndex = useRef(playIndex);
  useLayoutEffect(() => {
    lastPlayRef.current = lastPlay;
    transitionRef.current = frame.transition;
    speedRef.current = speed;
  });
  // Where each token was last drawn, so a shooter's cut starts from there.
  const courtRef = useRef<HTMLDivElement>(null);
  const drawnSpots = useRef(new Map<PlayerId, CourtPoint>());
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
    const animations: Animation[] = [];
    const motion = fullCourtBallMotion(play, transitionRef.current);
    if (motion) {
      animations.push(
        el.animate(motion.keyframes, {
          duration: motion.duration / speedRef.current,
          easing: "linear",
        }),
      );
    }
    // Catch-and-shoot: the shooter's token curls through the cut point.
    const from = drawnSpots.current.get(play.playerId);
    const token = courtRef.current?.querySelector<HTMLElement>(
      `[data-player-id="${play.playerId}"]`,
    );
    if (play.cut && from && token && typeof token.animate === "function") {
      const to = {
        left: token.style.left,
        top: token.style.top,
      };
      animations.push(
        token.animate(
          [
            { left: pct(from.x), top: pct(from.y) },
            { left: pct(play.cut.x), top: pct(play.cut.y), offset: 0.5 },
            to,
          ],
          { duration: CUT_MS / speedRef.current, easing: "ease-in-out" },
        ),
      );
    }
    return () => {
      for (const animation of animations) {
        animation.cancel();
      }
    };
  }, [playIndex]);
  useLayoutEffect(() => {
    drawnSpots.current = new Map(
      frame.players.map((player) => [player.playerId, player.spot]),
    );
  });

  const onCourt = new Set(frame.players.map((p) => p.playerId));
  const bench: [WatchPlayer[], WatchPlayer[]] = [[], []];
  for (const player of props.players ?? []) {
    if (!onCourt.has(player.playerId)) {
      bench[player.side].push(player);
    }
  }

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
  const rimX =
    frame.attackingEnd === "left"
      ? COURT_FEET.hoopY
      : LENGTH - COURT_FEET.hoopY;

  const toggleShotChart = () => {
    const next = !showShotChart;
    if (props.showShotChart === undefined) {
      setLocalShotChart(next);
    }
    props.onShowShotChartChange?.(next);
  };

  const arrow = (
    <svg
      aria-hidden="true"
      viewBox="0 0 8 10"
      className={cn(
        "h-2.5 w-2 fill-current",
        frame.ballEnd === "left" && "rotate-180",
      )}
    >
      <path d="M0 0 L8 5 L0 10 Z" />
    </svg>
  );

  return (
    <div className={cn("space-y-2", props.className)}>
      <CourtHeader
        status={props.status}
        showShotChart={showShotChart}
        onToggleShotChart={toggleShotChart}
      />
      <div
        role="group"
        aria-label={`Court, ${home.city} ${home.name} home floor`}
        className="relative w-full rounded-lg px-6 py-5"
        style={
          {
            backgroundColor: palette.apron,
            "--court-speed": speed,
          } as CSSProperties
        }
        data-testid="court-view"
      >
        <span
          aria-hidden="true"
          data-testid="court-wordmark"
          className={cn(WORDMARK_CLASS, "inset-y-0 left-0 w-6")}
          style={{ color: palette.wordmark }}
        >
          <span className="-rotate-90 whitespace-nowrap">{home.name}</span>
        </span>
        <span
          aria-hidden="true"
          data-testid="court-wordmark"
          className={cn(WORDMARK_CLASS, "inset-y-0 right-0 w-6")}
          style={{ color: palette.wordmark }}
        >
          <span className="rotate-90 whitespace-nowrap">{home.name}</span>
        </span>
        <span
          aria-hidden="true"
          data-testid="court-wordmark"
          className={cn(WORDMARK_CLASS, "inset-x-0 bottom-0 h-5")}
          style={{ color: palette.wordmark }}
        >
          <span className="whitespace-nowrap">{home.city}</span>
        </span>

        {/* Courtside LED ribbon on the far-sideline apron. Static: it only
            changes when a play is revealed, never while paused. */}
        <span
          aria-hidden="true"
          data-testid="court-ribbon"
          className="pointer-events-none absolute inset-x-6 top-0 flex h-5 items-center justify-center overflow-hidden rounded-sm font-display text-sm font-semibold uppercase leading-5 tracking-widest"
          style={{ backgroundColor: palette.ribbon, color: palette.ribbonInk }}
        >
          <span className="truncate px-2">
            {props.run
              ? `${teamOf(props.run.side).abbreviation} ${props.run.points}–0 run`
              : `${home.city} ${home.name}`}
          </span>
        </span>

        {/* Benches on the near-sideline apron, either side of the city. */}
        {([0, 1] as const).map((side) =>
          bench[side].length > 0 ? (
            <span
              key={side}
              aria-hidden="true"
              data-testid="court-bench"
              data-side={side}
              className={cn(
                "pointer-events-none absolute bottom-0 hidden h-5 items-center gap-1.5 rounded-sm border px-1.5 text-sm font-medium leading-5 sm:flex",
                side === 0 ? "left-[14%]" : "right-[14%]",
              )}
              style={{
                color: palette.wordmark,
                borderColor: `color-mix(in srgb, ${palette.wordmark} 35%, transparent)`,
              }}
            >
              {bench[side].map((player) => (
                <span key={player.playerId}>
                  {initialOf(player.lastName || player.shortName)}
                </span>
              ))}
            </span>
          ) : null,
        )}

        <div className="court-viewport relative w-full">
          {/* Before the floor so screen readers hear possession before the players. */}
          {frame.ballSide !== null && frame.ballEnd !== null ? (
            <p
              data-testid="court-possession"
              data-end={frame.ballEnd}
              className="pointer-events-none absolute left-1/2 top-2 z-40 inline-flex -translate-x-1/2 items-center gap-1.5 rounded bg-black/70 px-2 py-0.5 text-sm font-medium text-zinc-50"
            >
              {frame.ballEnd === "left" ? arrow : null}
              <span aria-hidden="true">
                {teamOf(frame.ballSide).abbreviation}
              </span>
              {frame.ballEnd === "right" ? arrow : null}
              <span className="sr-only">
                Possession: {teamOf(frame.ballSide).city}{" "}
                {teamOf(frame.ballSide).name}
              </span>
            </p>
          ) : null}
          <div
            ref={courtRef}
            className={cn(
              "court-wood relative aspect-[94/50] w-full overflow-x-clip",
              frame.transition && "court-switching",
            )}
            style={{ backgroundColor: palette.floor }}
          >
            {/* Under the lines: the logo is faded paint, not a layer over the court. */}
            {palette.logo ? (
              <div
                aria-hidden="true"
                data-testid="court-centre-logo"
                data-final={props.final ? "true" : undefined}
                className="court-centre-logo pointer-events-none absolute left-1/2 top-1/2 aspect-square -translate-x-1/2 -translate-y-1/2"
                style={{
                  width: `calc(12 / ${LENGTH} * 100%)`,
                  opacity: props.final
                    ? FINAL_LOGO_OPACITY
                    : palette.logoOpacity,
                }}
              >
                <TeamLogoMark
                  branding={palette.logo}
                  decorative
                  className="h-full w-full"
                />
              </div>
            ) : null}
            <svg
              viewBox={`0 0 ${LENGTH} ${WIDTH}`}
              aria-hidden="true"
              className="absolute inset-0 h-full w-full"
            >
              <rect
                data-testid="court-lane"
                x="0"
                y={WIDTH / 2 - COURT_FEET.laneWidth / 2}
                width={COURT_FEET.laneLength}
                height={COURT_FEET.laneWidth}
                fill={palette.lane}
              />
              <rect
                data-testid="court-lane"
                x={LENGTH - COURT_FEET.laneLength}
                y={WIDTH / 2 - COURT_FEET.laneWidth / 2}
                width={COURT_FEET.laneLength}
                height={COURT_FEET.laneWidth}
                fill={palette.lane}
              />
              <circle
                cx={LENGTH / 2}
                cy={WIDTH / 2}
                r="6"
                fill="none"
                stroke={palette.ring}
                strokeWidth="0.5"
              />
              <g style={{ color: palette.line }}>
                <FullCourtLines centreCircle={false} />
              </g>
              {flashRim ? (
                <circle
                  key={`flash-${playIndex}`}
                  className="court-rim-flash"
                  cx={rimX}
                  cy={WIDTH / 2}
                  r={COURT_FEET.rimRadius}
                  fill="none"
                  stroke={palette.line}
                  strokeWidth="0.5"
                  data-testid="court-rim-flash"
                />
              ) : null}
              {showShotChart
                ? frame.shots.map((shot) => {
                    const cx = shot.at.x * LENGTH;
                    const cy = shot.at.y * WIDTH;
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

            {frame.players.map((player) => {
              const color = colorOf(player.side);
              return (
                <CourtToken
                  key={player.playerId}
                  player={player}
                  team={teamOf(player.side)}
                  color={color}
                  points={points.get(player.playerId) ?? 0}
                  checkedIn={incoming.get(player.playerId)?.index ?? null}
                  selected={props.selectedPlayerId === player.playerId}
                  onSelect={props.onSelectPlayer}
                  outline={tokenOutline(color, palette)}
                  accent={palette.line}
                  labelAbove={player.spot.y > LABEL_ABOVE_Y}
                />
              );
            })}

            {ghosts.map(({ sub, outgoing, spot }) => (
              <CourtGhost
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
              className="court-ball pointer-events-none absolute z-20 -ml-1.5 -mt-1.5 h-3 w-3 rounded-full border border-black/50 bg-orange-500 shadow"
              style={{
                left: pct(frame.ball.at.x),
                top: pct(frame.ball.at.y),
              }}
            />

            {callout && lastPlay ? (
              <CourtCallout
                key={lastPlay.index}
                text={callout}
                at={frame.ball.at}
              />
            ) : null}
          </div>
          {props.periodBreak ? (
            <CourtPeriodCard key={props.periodBreak} text={props.periodBreak} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
