"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { FullCourtLines } from "@/components/game/court/FullCourtLines";
import { prefersReducedMotion } from "@/components/ui/CountUp";
import { cn } from "@/components/ui/styles";
import { TeamLogoMark } from "@/components/team/logos/TeamLogoMark";
import type { PlayerId } from "@/domain/ids";
import { buildCourtPalette, tokenOutline } from "@/state/court-palette";
import {
  ALL_LABELS_MIN_COURT_PX,
  courtMonograms,
  layoutCourtLabels,
  type LabelSide,
} from "@/state/court-label-layout";
import type { PlayChoreography } from "@/state/watch-court-choreo";
import {
  COURT_FEET,
  COURT_RIM,
  type CourtSubstitution,
} from "@/state/watch-court-frame";
import {
  BENCH_LAYOUT,
  FULL_COURT_FEET,
  BENCH_CAPTION_PX,
  WIDE_BENCH_LAYOUT,
  WIDE_BENCH_MIN_PX,
  benchTopRowY,
  wideBenchPoint,
  toFullCourt,
  type FullCourtFrame,
  type FullCourtPoint,
} from "@/state/watch-full-court";
import type {
  LiveBoxScore,
  WatchPlayer,
  WatchSide,
  WatchTeam,
} from "@/state/watch-game-view";
import { CourtCallout, CourtPeriodCard, CourtWhistle } from "./CourtOverlays";
import { CourtToken } from "./CourtToken";
import {
  ballFloorKeyframes,
  ballLiftKeyframes,
  calloutText,
  courtTranslate,
  pct,
  rimTime,
  trackKeyframes,
} from "./court-motion";
import { teamTokenColor } from "./team-token-colors";

const LENGTH = FULL_COURT_FEET.length;
const WIDTH = FULL_COURT_FEET.width;
/** Floor size assumed until the first measurement (and in jsdom). */
const DEFAULT_COURT_SIZE = { width: 800, height: 425 };
const RIMS = [toFullCourt(COURT_RIM, "left"), toFullCourt(COURT_RIM, "right")];

/** Centre logo opacity once the game is over. */
const FINAL_LOGO_OPACITY = 0.7;

const WORDMARK_CLASS =
  "pointer-events-none absolute flex items-center justify-center font-display text-base font-bold uppercase tracking-[0.35em]";

/**
 * Full-court replay: player tokens, ball and callouts on a
 * landscape 94 × 50 ft floor painted in the home team's colours, with the
 * home wordmarks on the apron and its logo at centre court. Baselines are the
 * left and right edges. Tokens and the ball sit on zero-size layers moved by
 * `transform` (frame (x, y) is a fraction of the floor's size), and a play's
 * choreography runs on those layers with the Web Animations API.
 */
export function FullCourtView(props: {
  frame: FullCourtFrame;
  home: WatchTeam;
  away: WatchTeam;
  live: LiveBoxScore;
  showShotChart?: boolean;
  selectedPlayerId?: PlayerId | null;
  onSelectPlayer?: (id: PlayerId) => void;
  /** Playback speed multiplier; motion durations are divided by it. */
  speed?: number;
  /**
   * Choreography of the latest play, run over `motionMs`; null or omitted
   * snaps tokens and the ball to the frame (jumps, reduced motion).
   */
  choreography?: PlayChoreography | null;
  /** Milliseconds at 1x the choreography takes (divided by `speed`). */
  motionMs?: number;
  /** Playback is running; running choreography pauses and resumes with it. */
  playing?: boolean;
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
  const showShotChart = props.showShotChart ?? false;

  const clipId = `court-lanes-${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;
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

  const playing = props.playing ?? true;
  const choreography = props.choreography ?? null;
  const motionMs = props.motionMs ?? 0;

  // The latest play's animations, and the speed they were started at.
  const courtRef = useRef<HTMLDivElement>(null);
  const motion = useRef<{ animations: Animation[]; speed: number }>({
    animations: [],
    speed: 1,
  });
  // Read when a choreography starts, so speed or pause changes never restart it.
  const latest = useRef({ speed, playing, motionMs });
  useLayoutEffect(() => {
    latest.current = { speed, playing, motionMs };
  });

  // Floor size in pixels, for the label layout; only changes on resize.
  const [courtSize, setCourtSize] = useState(DEFAULT_COURT_SIZE);
  // A wide floor seats each bench in one row; the frame's seats (and any walk
  // to or from them) are re-laid out point by point.
  const wideBench = courtSize.width >= WIDE_BENCH_MIN_PX;
  const placeOf = wideBench ? wideBenchPoint : (point: FullCourtPoint) => point;
  const place = useRef(placeOf);
  useLayoutEffect(() => {
    place.current = placeOf;
  });
  useEffect(() => {
    const el = courtRef.current;
    if (!el || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry?.contentRect ?? { width: 0, height: 0 };
      if (width > 0 && height > 0) {
        setCourtSize((prev) =>
          prev.width === width && prev.height === height
            ? prev
            : { width, height },
        );
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const running = motion.current.animations;
    // A play revealed mid-motion starts from where each layer is drawn now.
    const drawn = new Map<Element, string>();
    if (choreography) {
      for (const animation of running) {
        const target = (animation.effect as KeyframeEffect | null)?.target;
        if (target && animation.playState !== "finished") {
          drawn.set(target, getComputedStyle(target).transform);
        }
      }
    }
    for (const animation of running) {
      animation.cancel();
    }
    const { speed: startSpeed, playing: startPlaying } = latest.current;
    motion.current = { animations: [], speed: startSpeed };
    const duration = latest.current.motionMs / startSpeed;
    const court = courtRef.current;
    if (!choreography || !court || duration <= 0 || prefersReducedMotion()) {
      return;
    }
    const start = (el: HTMLElement | null, keyframes: Keyframe[]) => {
      if (!el || typeof el.animate !== "function") {
        return;
      }
      const from = drawn.get(el);
      if (from && from !== "none") {
        keyframes[0] = { ...keyframes[0], transform: from };
      }
      const animation = el.animate(keyframes, { duration });
      if (!startPlaying) {
        animation.pause();
      }
      motion.current.animations.push(animation);
    };
    for (const track of choreography.tracks) {
      start(
        court.querySelector<HTMLElement>(`[data-mover="${track.playerId}"]`),
        trackKeyframes(
          choreography.beats,
          track.points.map((point) => place.current(point)),
          choreography.deadBall,
        ),
      );
    }
    start(
      court.querySelector<HTMLElement>('[data-mover="ball"]'),
      ballFloorKeyframes(choreography),
    );
    start(
      court.querySelector<HTMLElement>("[data-ball-lift]"),
      ballLiftKeyframes(choreography),
    );
  }, [choreography]);

  // Pause freezes the play mid-motion; Play carries on from there.
  useEffect(() => {
    for (const animation of motion.current.animations) {
      if (!playing && animation.playState === "running") {
        animation.pause();
      } else if (playing && animation.playState === "paused") {
        animation.play();
      }
    }
  }, [playing]);

  // A speed change retimes the running play instead of restarting it.
  useEffect(() => {
    const current = motion.current;
    for (const animation of current.animations) {
      animation.updatePlaybackRate(speed / current.speed);
    }
  }, [speed]);

  useEffect(
    () => () => {
      for (const animation of motion.current.animations) {
        animation.cancel();
      }
    },
    [],
  );

  const monograms = useMemo(
    () =>
      courtMonograms(
        props.players ??
          frame.players.map((p) => ({
            playerId: p.playerId,
            fullName: p.fullName,
            shortName: p.shortName,
          })),
      ),
    [props.players, frame.players],
  );

  // Jersey numbers on the tokens, team by team: a team shows numbers only
  // when every player has one and none repeat (a replay of an old game can
  // clash after later roster moves); otherwise it shows monograms.
  const badges = useMemo(() => {
    const roster = props.players ?? [];
    const result = new Map<PlayerId, string>();
    for (const side of [0, 1] as const) {
      const members = roster.filter((p) => p.side === side);
      const numbers = members.map((p) => p.jerseyNumber);
      const useNumbers =
        members.length > 0 &&
        numbers.every((n) => n !== null) &&
        new Set(numbers).size === numbers.length;
      for (const p of members) {
        result.set(
          p.playerId,
          useNumbers
            ? String(p.jerseyNumber)
            : (monograms.get(p.playerId) ?? "?"),
        );
      }
    }
    return result;
  }, [props.players, monograms]);
  const badgeOf = (id: PlayerId) => badges.get(id) ?? monograms.get(id) ?? "?";

  // Label budget: handler, shooter and selected names always show; on a wide
  // floor everyone else's shows where it fits, and the rest appear on hover
  // or focus, laid out clear of the shown ones.
  const selectedId = props.selectedPlayerId ?? null;
  const labelSides = useMemo(() => {
    const sides = new Map<PlayerId, LabelSide>();
    const byId = new Map(frame.players.map((p) => [p.playerId, p]));
    const shownIds: PlayerId[] = [];
    const add = (id: PlayerId | null | undefined) => {
      if (id && byId.has(id) && !shownIds.includes(id)) {
        shownIds.push(id);
      }
    };
    add(selectedId);
    add(frame.players.find((p) => p.role === "shooter")?.playerId);
    add(frame.players.find((p) => p.role === "handler")?.playerId);
    const request = (id: PlayerId, optional = false) => {
      const p = byId.get(id)!;
      return { playerId: id, at: p.spot, text: p.label, optional };
    };
    // On a wide enough floor everyone else's name shows too, wherever it
    // fits cleanly; a name with no clean spot waits for hover or focus.
    const everyone = courtSize.width >= ALL_LABELS_MIN_COURT_PX;
    const optionalIds = everyone
      ? frame.players
          .map((p) => p.playerId)
          .filter((id) => !shownIds.includes(id))
      : [];
    const tokens = frame.players.map((p) => p.spot);
    const shown = layoutCourtLabels({
      labels: [
        ...shownIds.map((id) => request(id)),
        ...optionalIds.map((id) => request(id, true)),
      ],
      tokens,
      rims: RIMS,
      court: courtSize,
    });
    for (const [id, placed] of shown) {
      sides.set(id, placed.side);
    }
    const avoid = [...shown.values()].map((placed) => placed.box);
    for (const p of frame.players) {
      if (!shown.has(p.playerId)) {
        const alone = layoutCourtLabels({
          labels: [request(p.playerId)],
          tokens,
          rims: RIMS,
          avoid,
          court: courtSize,
        });
        sides.set(p.playerId, alone.get(p.playerId)!.side);
      }
    }
    return { sides, shown: new Set(shown.keys()) };
  }, [frame.players, courtSize, selectedId]);

  const incoming = new Map<PlayerId, CourtSubstitution>(
    frame.substitutions.map((sub) => [sub.inId, sub]),
  );

  // Floor and bench tokens share one keyed list in a stable (roster) order, so
  // a player who checks in or out keeps his DOM node and the walk animation
  // can move it between a bench seat and the floor.
  const fouledOut = new Set(
    [...live.home.rows, ...live.away.rows]
      .filter((row) => row.fouledOut)
      .map((row) => row.playerId),
  );
  const floorById = new Map(frame.players.map((p) => [p.playerId, p]));
  const benchById = new Map(frame.bench.map((b) => [b.playerId, b]));
  const rosterOrder = new Map(
    (props.players ?? []).map((p, i) => [p.playerId, i]),
  );
  const tokens: Array<
    | { kind: "floor"; id: PlayerId; spot: FullCourtPoint }
    | { kind: "bench"; id: PlayerId; spot: FullCourtPoint }
  > = [
    ...frame.players.map((p) => ({
      kind: "floor" as const,
      id: p.playerId,
      spot: p.spot,
    })),
    ...frame.bench.map((b) => ({
      kind: "bench" as const,
      id: b.playerId,
      spot: b.spot,
    })),
  ];
  if (rosterOrder.size > 0) {
    tokens.sort(
      (a, b) => (rosterOrder.get(a.id) ?? 0) - (rosterOrder.get(b.id) ?? 0),
    );
  }
  const benchTopRow = benchTopRowY(frame.benchRows, wideBench);
  const benchFirstX = wideBench
    ? WIDE_BENCH_LAYOUT.firstX
    : BENCH_LAYOUT.firstX;

  const callout = lastPlay ? calloutText(lastPlay, labelOf) : null;
  // Callouts wait for the event (steal, block, whistle) in the choreography.
  const calloutDelayMs = choreography
    ? (choreography.eventAt * motionMs) / speed
    : 0;
  // A block or steal rings the player who made it, and a foul blows the whistle.
  const impactId =
    lastPlay &&
    (lastPlay.outcome === "blocked" || lastPlay.outcome === "stolen")
      ? lastPlay.player2Id
      : null;
  const impactSide = frame.players.find((p) => p.playerId === impactId)?.side;
  const impact =
    lastPlay && impactId
      ? { key: lastPlay.index, delayMs: calloutDelayMs, paused: !playing }
      : undefined;
  const whistle = lastPlay?.motion === "foul";
  const flashRim =
    lastPlay !== null &&
    lastPlay.outcome === "made" &&
    (lastPlay.motion === "shot" || lastPlay.motion === "free_throw");
  // The flash waits for the ball to reach the rim in the choreography.
  const rim = choreography ? rimTime(choreography) : null;
  const flashDelayMs = rim !== null ? (rim * motionMs) / speed : 0;
  const rimX =
    frame.attackingEnd === "left"
      ? COURT_FEET.hoopY
      : LENGTH - COURT_FEET.hoopY;

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
    <div className={props.className}>
      <div
        role="group"
        aria-label={`Court, ${home.city} ${home.name} home floor`}
        className="relative w-full rounded-t-lg px-6 py-5"
        style={
          {
            backgroundColor: palette.apron,
            // Arena light from above: a touch lighter at the far sideline.
            backgroundImage:
              "linear-gradient(180deg, rgb(255 255 255 / 0.06), transparent 45%, rgb(0 0 0 / 0.18))",
            "--court-speed": speed,
          } as CSSProperties
        }
        data-testid="court-view"
      >
        {/* Possession marker on the scorer's table (near-sideline apron). Before
            the floor so screen readers hear possession before the players. */}
        {frame.ballSide !== null && frame.ballEnd !== null ? (
          <p
            data-testid="court-possession"
            data-end={frame.ballEnd}
            className="pointer-events-none absolute bottom-0 left-1/2 z-40 inline-flex h-5 -translate-x-1/2 items-center gap-1.5 rounded-sm bg-black/80 px-2 text-sm font-medium leading-5 text-zinc-50"
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

        {/* Courtside LED ribbon on the far-sideline apron, only for a run in
            progress. Static: it changes only when a play is revealed. */}
        {props.run ? (
          <span
            aria-hidden="true"
            data-testid="court-ribbon"
            className="pointer-events-none absolute inset-x-6 top-0 flex h-5 items-center justify-center overflow-hidden rounded-sm font-display text-sm font-semibold uppercase leading-5 tracking-widest"
            style={{
              backgroundColor: palette.ribbon,
              color: palette.ribbonInk,
            }}
          >
            <span className="truncate px-2">
              {`${teamOf(props.run.side).abbreviation} ${props.run.points}–0 run`}
            </span>
          </span>
        ) : null}

        {/* Room above the floor for the benches, in floor heights so the bench
            seats (y < 0 on the court layer) land inside it. */}
        <div
          aria-hidden="true"
          data-testid="court-bench-band"
          className="w-full"
          // Down to the top row of seats in floor heights (padding % is of
          // the width), plus a fixed strip for the captions above it.
          style={{
            paddingTop: `calc(${Math.round(((-benchTopRow * WIDTH) / LENGTH) * 10000) / 100}% + ${BENCH_CAPTION_PX}px)`,
          }}
        />

        <div className="court-viewport relative w-full">
          {/* Baseline wordmarks on the apron, centred on the floor's height so
              they line up with the hoops. */}
          <span
            aria-hidden="true"
            data-testid="court-wordmark"
            className={cn(WORDMARK_CLASS, "inset-y-0 -left-6 w-6")}
            style={{ color: palette.wordmark }}
          >
            <span className="-rotate-90 whitespace-nowrap">{home.name}</span>
          </span>
          <span
            aria-hidden="true"
            data-testid="court-wordmark"
            className={cn(WORDMARK_CLASS, "inset-y-0 -right-6 w-6")}
            style={{ color: palette.wordmark }}
          >
            <span className="rotate-90 whitespace-nowrap">{home.name}</span>
          </span>
          <div
            ref={courtRef}
            className="court-wood relative aspect-[94/50] w-full overflow-x-clip"
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
                  width: `calc(8 / ${LENGTH} * 100%)`,
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
              <defs>
                <clipPath id={clipId}>
                  <rect
                    x="0"
                    y={WIDTH / 2 - COURT_FEET.laneWidth / 2}
                    width={COURT_FEET.laneLength}
                    height={COURT_FEET.laneWidth}
                  />
                  <rect
                    x={LENGTH - COURT_FEET.laneLength}
                    y={WIDTH / 2 - COURT_FEET.laneWidth / 2}
                    width={COURT_FEET.laneLength}
                    height={COURT_FEET.laneWidth}
                  />
                </clipPath>
                {/* Sheen on the lane paint, brightest at the baseline and
                    fading out toward the free-throw line. */}
                {(["left", "right"] as const).map((end) => (
                  <linearGradient
                    key={end}
                    id={`${clipId}-${end}`}
                    x1={end === "left" ? "0" : "1"}
                    x2={end === "left" ? "1" : "0"}
                    y1="0"
                    y2="0"
                  >
                    <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.12" />
                    <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
                  </linearGradient>
                ))}
              </defs>
              {(["left", "right"] as const).map((end) => {
                const x = end === "left" ? 0 : LENGTH - COURT_FEET.laneLength;
                const y = WIDTH / 2 - COURT_FEET.laneWidth / 2;
                return (
                  <g key={`lane-${end}`}>
                    <rect
                      data-testid="court-lane"
                      x={x}
                      y={y}
                      width={COURT_FEET.laneLength}
                      height={COURT_FEET.laneWidth}
                      fill={palette.lane}
                    />
                    <rect
                      x={x}
                      y={y}
                      width={COURT_FEET.laneLength}
                      height={COURT_FEET.laneWidth}
                      fill={`url(#${clipId}-${end})`}
                    />
                  </g>
                );
              })}
              <circle
                cx={LENGTH / 2}
                cy={WIDTH / 2}
                r="6"
                fill={palette.lane}
                fillOpacity="0.35"
                stroke={palette.ring}
                strokeWidth="0.6"
              />
              <g style={{ color: palette.line }}>
                <FullCourtLines centreCircle={false} />
              </g>
              <g
                style={{ color: palette.laneLine }}
                clipPath={`url(#${clipId})`}
              >
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
                  stroke={palette.laneLine}
                  strokeWidth="0.5"
                  data-testid="court-rim-flash"
                  style={{
                    animationDelay: `${Math.round(flashDelayMs)}ms`,
                    animationPlayState: playing ? undefined : "paused",
                  }}
                />
              ) : null}
              {showShotChart
                ? frame.shots.map((shot) => {
                    const cx = shot.at.x * LENGTH;
                    const cy = shot.at.y * WIDTH;
                    const color = colorOf(shot.side);
                    return (
                      <g
                        key={`court-shot-${shot.index}`}
                        data-testid="court-shot-marker"
                      >
                        {shot.made ? (
                          <circle
                            cx={cx}
                            cy={cy}
                            r="0.9"
                            fill={color}
                            stroke={palette.line}
                            strokeWidth="0.3"
                          />
                        ) : (
                          <>
                            <circle
                              cx={cx}
                              cy={cy}
                              r="0.9"
                              fill="none"
                              stroke={palette.line}
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

            {[0, 1].map((side) => (
              <span
                key={`bench-caption-${side}`}
                aria-hidden="true"
                data-testid="court-bench-caption"
                className="pointer-events-none absolute max-w-[46%] truncate whitespace-nowrap font-display text-sm font-semibold uppercase tracking-wide"
                style={{
                  left: pct(benchFirstX[side as WatchSide] - 0.02),
                  // Its bottom sits clear of the top row's tokens.
                  top: pct(benchTopRow),
                  transform: "translateY(calc(-100% - 16px))",
                  color: palette.wordmark,
                }}
              >
                {teamOf(side as WatchSide).city} bench
              </span>
            ))}

            {tokens.map((token) => {
              const floor =
                token.kind === "floor" ? floorById.get(token.id) : null;
              const seated =
                token.kind === "bench" ? benchById.get(token.id) : null;
              const player = floor ?? seated;
              if (!player) {
                return null;
              }
              const color = colorOf(player.side);
              return (
                <div
                  key={token.id}
                  data-mover={token.id}
                  className="court-mover z-10"
                  style={{ transform: courtTranslate(placeOf(token.spot)) }}
                >
                  <CourtToken
                    player={player}
                    team={teamOf(player.side)}
                    color={color}
                    points={points.get(token.id) ?? 0}
                    checkedIn={
                      floor ? (incoming.get(token.id)?.index ?? null) : null
                    }
                    selected={props.selectedPlayerId === token.id}
                    onSelect={props.onSelectPlayer}
                    outline={tokenOutline(color, palette)}
                    accent={palette.line}
                    labelSide={
                      floor
                        ? (labelSides.sides.get(token.id) ?? "below")
                        : "above"
                    }
                    labelShown={floor ? labelSides.shown.has(token.id) : false}
                    badge={badgeOf(token.id)}
                    bench={seated !== null}
                    fouledOut={seated !== null && fouledOut.has(token.id)}
                    impact={floor && token.id === impactId ? impact : undefined}
                  />
                </div>
              );
            })}

            {/* The ball's floor layer carries its shadow; the inner layer
                lifts the ball for dribbles and arcs, so the gap between the
                two reads as height. */}
            <div
              aria-hidden="true"
              data-testid="court-ball"
              data-mover="ball"
              className="court-mover z-20"
              style={{ transform: courtTranslate(frame.ball.at) }}
            >
              <span className="absolute -ml-1.5 -mt-1 h-3 w-3 rounded-full bg-black/40 blur-[1px]" />
              <div data-ball-lift className="absolute">
                <div className="-ml-1.5 -mt-1.5 h-3 w-3 rounded-full border border-black/50 bg-orange-500" />
              </div>
            </div>

            {callout && lastPlay ? (
              <CourtCallout
                key={`callout-${lastPlay.index}`}
                text={callout}
                at={frame.ball.at}
                delayMs={calloutDelayMs}
                paused={!playing}
                accent={
                  impactSide !== undefined ? colorOf(impactSide) : undefined
                }
              />
            ) : null}
            {whistle && lastPlay ? (
              <CourtWhistle
                key={`whistle-${lastPlay.index}`}
                at={frame.ball.at}
                delayMs={calloutDelayMs}
                paused={!playing}
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
