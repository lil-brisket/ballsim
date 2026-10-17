"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { HalfCourtLines } from "@/components/game/court/HalfCourtLines";
import { prefersReducedMotion } from "@/components/ui/CountUp";
import { cn } from "@/components/ui/styles";
import type { PlayerId } from "@/domain/ids";
import {
  COURT_FEET,
  type CourtFrame,
  type CourtPoint,
  type CourtSubstitution,
} from "@/state/watch-court-frame";
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
  ballMotion,
  calloutText,
  initialOf,
  pct,
} from "./court-motion";
import { teamTokenColor } from "./team-token-colors";

export type { CourtStatus };

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
  // Read at flight start, so a speed change never cancels a ball mid-air.
  const speedRef = useRef(speed);
  const shownIndex = useRef(playIndex);
  useLayoutEffect(() => {
    lastPlayRef.current = lastPlay;
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
    const motion = ballMotion(play);
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
      />
      <div
        ref={courtRef}
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
          <CourtToken
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
          className="pointer-events-none absolute z-20 -ml-1.5 -mt-1.5 h-3 w-3 rounded-full border border-black/50 bg-orange-500 shadow"
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
          <CourtPeriodCard key={props.periodBreak} text={props.periodBreak} />
        ) : null}
      </div>
    </div>
  );
}
