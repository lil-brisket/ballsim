"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CourtPlayerCard } from "@/components/game/watch/court/CourtPlayerCard";
import { FullCourtView } from "@/components/game/watch/court/FullCourtView";
import { LiveBoxScore } from "@/components/game/watch/LiveBoxScore";
import {
  PlaybackControls,
  type PlaybackMoment,
  type PlaybackSpeed,
  type PlaybackStatus,
} from "@/components/game/watch/PlaybackControls";
import { PlayByPlayFeed } from "@/components/game/watch/PlayByPlayFeed";
import { Scoreboard } from "@/components/game/watch/Scoreboard";
import { useGameClock } from "@/components/game/watch/useGameClock";
import { ShotSummaryPanel } from "@/components/game/watch/ShotSummaryPanel";
import { Tabs } from "@/components/ui";
import {
  motionMs,
  openerShare,
  playDelayMs,
  revealAfter,
  tipShare,
} from "@/components/game/watch/playback-pacing";
import type { PlayerId } from "@/domain/ids";
import { buildPlayChoreography } from "@/state/watch-court-choreo";
import { stepPossession } from "@/state/watch-court-frame";
import { buildFullCourtFrame } from "@/state/watch-full-court";
import {
  buildLiveBoxScore,
  currentRun,
  formatGameClock,
  periodLabel,
  teamFoulsAt,
  buildShotSummary,
} from "@/state/watch-game-selectors";
import type { WatchGameView } from "@/state/watch-game-view";

export function WatchGameClient(props: {
  view: WatchGameView;
  saveId: string;
}) {
  const { view } = props;
  const total = view.plays.length;
  // `revealed` drives the court; `settled` (revealed, or one behind while a
  // play's motion is still building to its event) drives the feed, score and
  // stats, so they change when the shot drops or the whistle blows.
  const [revealed, setRevealed] = useState(0);
  const [settled, setSettled] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  // True when the latest reveal came from the playback timer (its play is
  // choreographed); a jump (restart, skip, possession step, feed) snaps.
  const [animated, setAnimated] = useState(false);
  // Revealed count before the latest timer step; a run of substitutions is
  // one step, and its walk starts from here.
  const [stepFrom, setStepFrom] = useState(0);
  const [showShotChart, setShowShotChart] = useState(false);
  const [statsTab, setStatsTab] = useState<"feed" | "box" | "shots">("feed");
  const [selectedPlayerId, setSelectedPlayerId] = useState<PlayerId | null>(
    null,
  );

  // Playback stops by itself once every play is revealed and settled.
  const isPlaying = playing && (revealed < total || settled < revealed);

  // One timeout per play: each reveal schedules the next with that play's
  // pacing. Pausing or a speed change keeps what is left of the step (at 1x)
  // so the timer stays in step with the court's paused animations; a new
  // reveal or a jump starts the next step from its full pacing.
  const pending = useRef<{ revealed: number; remainingMs: number } | null>(
    null,
  );
  useEffect(() => {
    if (!isPlaying || revealed >= total) {
      return;
    }
    const remainingMs =
      pending.current?.revealed === revealed
        ? pending.current.remainingMs
        : playDelayMs(view, revealed, speed);
    const startedAt = performance.now();
    const id = setTimeout(() => {
      pending.current = null;
      setAnimated(true);
      setStepFrom(revealed);
      setSettled(revealed);
      // A run of substitutions is revealed whole, so the walk is one step.
      setRevealed(revealAfter(view, revealed));
    }, remainingMs / speed);
    return () => {
      clearTimeout(id);
      const elapsedMs = (performance.now() - startedAt) * speed;
      pending.current = {
        revealed,
        remainingMs: Math.max(0, remainingMs - elapsedMs),
      };
    };
  }, [isPlaying, speed, total, view, revealed]);

  const live = useMemo(() => buildLiveBoxScore(view, settled), [view, settled]);
  const shotSummary = useMemo(
    () => buildShotSummary(view, settled),
    [view, settled],
  );
  const courtFrame = useMemo(
    () => buildFullCourtFrame(view, revealed),
    [view, revealed],
  );
  const choreography = useMemo(
    () =>
      animated && revealed > 0
        ? buildPlayChoreography(view, revealed - 1, {
            openerShare: openerShare(view, revealed - 1),
            tipShare: tipShare(view, revealed - 1),
            subFrom: stepFrom,
          })
        : null,
    [view, revealed, animated, stepFrom],
  );

  // The revealed play settles at its event beat; pausing keeps what is left.
  const settlePending = useRef<{
    revealed: number;
    remainingMs: number;
  } | null>(null);
  useEffect(() => {
    if (!isPlaying || settled >= revealed) {
      return;
    }
    const remainingMs =
      settlePending.current?.revealed === revealed
        ? settlePending.current.remainingMs
        : (choreography?.eventAt ?? 0) * motionMs(view, revealed);
    const startedAt = performance.now();
    const id = setTimeout(() => {
      settlePending.current = null;
      setSettled(revealed);
    }, remainingMs / speed);
    return () => {
      clearTimeout(id);
      const elapsedMs = (performance.now() - startedAt) * speed;
      settlePending.current = {
        revealed,
        remainingMs: Math.max(0, remainingMs - elapsedMs),
      };
    };
  }, [isPlaying, speed, view, revealed, settled, choreography]);

  const previousPlay = settled > 0 ? view.plays[settled - 1] : undefined;
  const nextPlay = settled < total ? view.plays[settled] : undefined;
  const periodBreak =
    settled === revealed &&
    previousPlay &&
    nextPlay &&
    previousPlay.period !== nextPlay.period
      ? `End of ${periodLabel(previousPlay.period)} · ${view.away.abbreviation} ${live.awayScore} – ${view.home.abbreviation} ${live.homeScore}`
      : null;

  const finalCard = live.isFinal
    ? `Final · ${view.away.abbreviation} ${live.awayScore} – ${view.home.abbreviation} ${live.homeScore}`
    : null;

  const jumpTo = (next: number) => {
    pending.current = null;
    settlePending.current = null;
    setAnimated(false);
    setRevealed(next);
    setSettled(next);
    setPlaying(false);
  };

  const courtStatus: PlaybackStatus = live.isFinal
    ? "complete"
    : isPlaying
      ? "playing"
      : "paused";

  // Blank at the end: the scoreboard already says Final.
  // While a play animates the clock ticks down through it; otherwise it shows
  // the settled play's clock.
  const playMotionMs = motionMs(view, revealed);
  const runningSeconds = useGameClock({
    view,
    revealed,
    animated,
    playing: isPlaying,
    motionMs: playMotionMs,
    speed,
  });
  const runningClock =
    runningSeconds === null || live.isFinal
      ? null
      : {
          periodLabel: view.plays[revealed - 1]!.periodLabel,
          clockLabel: formatGameClock(runningSeconds),
        };
  const teamFouls = useMemo(() => teamFoulsAt(view, settled), [view, settled]);
  // The scrubber announces the settled clock, not every running tick.
  const settledClockText = live.isFinal
    ? ""
    : settled === 0
      ? "Tip-off"
      : `${live.periodLabel} ${live.clockLabel}`;
  const clockText = runningClock
    ? `${runningClock.periodLabel} ${runningClock.clockLabel}`
    : settledClockText;
  const periodStarts = useMemo(
    () =>
      view.plays.flatMap((p, i) =>
        i > 0 && p.period !== view.plays[i - 1]!.period ? [i] : [],
      ),
    [view],
  );
  const moments = useMemo<PlaybackMoment[]>(
    () =>
      view.keyMoments.flatMap((moment) =>
        moment.playIndex === null
          ? []
          : [
              {
                revealed: moment.playIndex + 1,
                title: moment.title,
                detail: moment.detail,
              },
            ],
      ),
    [view],
  );

  // The buttons and the page shortcuts share these handlers.
  const togglePlay = () => {
    if (revealed >= total && !isPlaying) {
      return;
    }
    setPlaying(!isPlaying);
  };
  const stepPlay = (direction: -1 | 1) =>
    jumpTo(Math.min(total, Math.max(0, revealed + direction)));
  const previousPossession = () => {
    if (revealed > 0) {
      jumpTo(stepPossession(view, revealed, -1));
    }
  };
  const nextPossession = () => {
    if (revealed < total) {
      jumpTo(stepPossession(view, revealed, 1));
    }
  };
  const shortcuts = useRef({
    togglePlay,
    stepPlay,
    previousPossession,
    nextPossession,
  });
  useEffect(() => {
    shortcuts.current = {
      togglePlay,
      stepPlay,
      previousPossession,
      nextPossession,
    };
  });
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      ) {
        return;
      }
      const target = event.target instanceof Element ? event.target : null;
      if (
        target?.closest(
          'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="slider"], [role="menu"], [role="menuitem"], [role="menuitemcheckbox"]',
        )
      ) {
        return;
      }
      const current = shortcuts.current;
      switch (event.key) {
        case " ":
          if (target?.closest("button, a")) {
            return;
          }
          current.togglePlay();
          break;
        case "ArrowLeft":
          current.previousPossession();
          break;
        case "ArrowRight":
          current.nextPossession();
          break;
        case ",":
          current.stepPlay(-1);
          break;
        case ".":
          current.stepPlay(1);
          break;
        default:
          return;
      }
      event.preventDefault();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const selectedPlayer =
    view.players.find((p) => p.playerId === selectedPlayerId) ?? null;
  const selectedRow = selectedPlayer
    ? [...live.home.rows, ...live.away.rows].find(
        (row) => row.playerId === selectedPlayer.playerId,
      )
    : undefined;

  return (
    <div className="min-w-0 space-y-6">
      <Scoreboard
        away={view.away}
        home={view.home}
        live={live}
        byPeriod={{
          away: shotSummary.away.byPeriod.map((line) => line.points),
          home: shotSummary.home.byPeriod.map((line) => line.points),
        }}
        currentPeriod={previousPlay?.period ?? 0}
        teamFouls={teamFouls}
        runningClock={runningClock}
      />
      <section aria-label="Court" className="min-w-0">
        <FullCourtView
          frame={courtFrame}
          home={view.home}
          away={view.away}
          live={live}
          showShotChart={showShotChart}
          speed={speed}
          choreography={choreography}
          motionMs={playMotionMs}
          playing={isPlaying}
          periodBreak={periodBreak ?? finalCard}
          final={live.isFinal}
          run={currentRun(view, settled)}
          players={view.players}
          selectedPlayerId={selectedPlayerId}
          onSelectPlayer={(id) =>
            setSelectedPlayerId((current) => (current === id ? null : id))
          }
        />
        <PlaybackControls
          playing={isPlaying}
          speed={speed}
          revealed={revealed}
          total={total}
          clockText={clockText}
          scrubClockText={settledClockText}
          status={courtStatus}
          periodStarts={periodStarts}
          moments={moments}
          showShotChart={showShotChart}
          onTogglePlay={togglePlay}
          onSpeedChange={setSpeed}
          onSeek={(next) => jumpTo(Math.min(total, Math.max(0, next)))}
          onStep={stepPlay}
          onPreviousPossession={previousPossession}
          onNextPossession={nextPossession}
          onRestart={() => jumpTo(0)}
          onSkipToEnd={() => jumpTo(total)}
          onToggleShotChart={() => setShowShotChart((value) => !value)}
        />
        {selectedPlayer && selectedRow ? (
          <div className="mt-3">
            <CourtPlayerCard
              player={selectedPlayer}
              team={selectedPlayer.side === 0 ? view.home : view.away}
              row={selectedRow}
              onClose={() => setSelectedPlayerId(null)}
            />
          </div>
        ) : null}
      </section>
      <section aria-label="Game stats" className="min-w-0 space-y-3">
        <Tabs
          aria-label="Game stats"
          activeKey={statsTab}
          items={[
            {
              key: "feed",
              label: "Play-by-play",
              onSelect: () => setStatsTab("feed"),
            },
            {
              key: "box",
              label: "Box score",
              onSelect: () => setStatsTab("box"),
            },
            {
              key: "shots",
              label: "Shot chart",
              onSelect: () => setStatsTab("shots"),
            },
          ]}
        />
        {statsTab === "feed" ? (
          <PlayByPlayFeed view={view} revealed={settled} onJump={jumpTo} />
        ) : statsTab === "box" ? (
          <LiveBoxScore
            live={live}
            away={view.away}
            home={view.home}
            players={view.players}
            selectedPlayerId={selectedPlayerId}
          />
        ) : (
          <ShotSummaryPanel
            view={view}
            summary={shotSummary}
            revealed={settled}
          />
        )}
      </section>
    </div>
  );
}
