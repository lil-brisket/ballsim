"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { FullCourtLines } from "@/components/game/court/FullCourtLines";
import { prefersReducedMotion } from "@/components/ui/CountUp";
import { Button } from "@/components/ui/Button";
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
import { courtCamera, type CourtCameraView } from "./court-camera";
import {
  CUT_MS,
  calloutText,
  fullCourtBallMotion,
  initialOf,
  pct,
} from "./court-motion";
import { useCompactCourt, useCourtView } from "./court-view-preference";
import { teamTokenColor } from "./team-token-colors";

const LENGTH = FULL_COURT_FEET.length;
const WIDTH = FULL_COURT_FEET.width;
/** Tokens below this normalized y hang their label above, to stay on the floor. */
const LABEL_ABOVE_Y = 0.85;

/** Perspective for the tilted floor (the sideline camera's distance). */
const CAMERA_PERSPECTIVE = "1800px";

const VIEW_LABEL: Record<CourtCameraView, string> = {
  broadcast: "Broadcast",
  "top-down": "Top-down",
};

const WORDMARK_CLASS =
  "pointer-events-none absolute flex items-center justify-center font-display text-sm font-semibold uppercase tracking-wide";

/**
 * Full-court replay: the same tokens, ball and callouts as `CourtView` on a
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
  /** Frame the whole floor in Broadcast (period breaks, the final). */
  wide?: boolean;
  className?: string;
}) {
  const { frame, home, away, live } = props;
  const speed = props.speed && props.speed > 0 ? props.speed : 1;
  const [localShotChart, setLocalShotChart] = useState(false);
  const showShotChart = props.showShotChart ?? localShotChart;

  const [view, setView] = useCourtView();
  const compact = useCompactCourt();
  const camera = courtCamera(
    view,
    frame.attackingEnd,
    props.wide ?? false,
    compact,
  );
  const reducedMotion = prefersReducedMotion();

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

  return (
    <div className={cn("space-y-2", props.className)}>
      <CourtHeader
        status={props.status}
        ballTeam={frame.ballSide !== null ? teamOf(frame.ballSide) : null}
        showShotChart={showShotChart}
        onToggleShotChart={toggleShotChart}
        controls={
          <div role="group" aria-label="Camera" className="flex">
            {(["broadcast", "top-down"] as const).map((option) => (
              <Button
                key={option}
                variant="quiet"
                aria-pressed={view === option}
                className={cn(view === option && "bg-zinc-800 text-zinc-50")}
                onClick={() => setView(option)}
              >
                {VIEW_LABEL[option]}
              </Button>
            ))}
          </div>
        }
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

        <div
          className={cn(
            "relative w-full overflow-hidden",
            camera.framing === "wide" && "court-camera-wide",
            reducedMotion && "court-camera-static",
          )}
          style={{ aspectRatio: camera.aspect }}
          data-testid="court-camera"
          data-camera-view={view}
          data-camera-framing={camera.framing}
        >
          <div
            className="court-camera-stage"
            style={{
              width: camera.stageWidth,
              transform: camera.transform,
              perspective: camera.tilt > 0 ? CAMERA_PERSPECTIVE : undefined,
              perspectiveOrigin: camera.perspectiveOrigin,
            }}
            data-testid="court-camera-stage"
          >
            <div
              ref={courtRef}
              className={cn(
                "court-wood relative aspect-[94/50] w-full",
                // Clipping flattens 3D children; the camera viewport crops instead.
                camera.tilt === 0 && "overflow-x-clip",
                frame.transition && "court-switching",
                camera.tilt > 0 && "court-tilted",
              )}
              style={
                {
                  backgroundColor: palette.floor,
                  "--court-tilt": `${camera.tilt}deg`,
                } as CSSProperties
              }
            >
              {/* Under the lines: the logo is faded paint, not a layer over the court. */}
              {palette.logo ? (
                <div
                  aria-hidden="true"
                  data-testid="court-centre-logo"
                  className="pointer-events-none absolute left-1/2 top-1/2 aspect-square -translate-x-1/2 -translate-y-1/2"
                  style={{
                    width: `calc(12 / ${LENGTH} * 100%)`,
                    opacity: palette.logoOpacity,
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
                  x="0"
                  y={WIDTH / 2 - COURT_FEET.laneWidth / 2}
                  width={COURT_FEET.laneLength}
                  height={COURT_FEET.laneWidth}
                  fill={palette.lane}
                />
                <rect
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

              {props.periodBreak ? (
                <CourtPeriodCard
                  key={props.periodBreak}
                  text={props.periodBreak}
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
