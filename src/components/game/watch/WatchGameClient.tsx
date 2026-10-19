"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CourtPlayerCard } from "@/components/game/watch/court/CourtPlayerCard";
import { FullCourtView } from "@/components/game/watch/court/FullCourtView";
import { KeyMomentsList } from "@/components/game/watch/KeyMomentsList";
import { LiveBoxScore } from "@/components/game/watch/LiveBoxScore";
import {
  PlaybackControls,
  type PlaybackMoment,
  type PlaybackSpeed,
  type PlaybackStatus,
} from "@/components/game/watch/PlaybackControls";
import { PlayByPlayFeed } from "@/components/game/watch/PlayByPlayFeed";
import { Scoreboard } from "@/components/game/watch/Scoreboard";
import { ShotSummaryPanel } from "@/components/game/watch/ShotSummaryPanel";
import {
  motionMs,
  openerShare,
  playDelayMs,
} from "@/components/game/watch/playback-pacing";
import type { PlayerId } from "@/domain/ids";
import { buildPlayChoreography } from "@/state/watch-court-choreo";
import { stepPossession } from "@/state/watch-court-frame";
import { buildFullCourtFrame } from "@/state/watch-full-court";
import {
  buildLiveBoxScore,
  currentRun,
  periodLabel,
  buildShotSummary,
} from "@/state/watch-game-selectors";
import type { WatchGameView } from "@/state/watch-game-view";

export function WatchGameClient(props: {
  view: WatchGameView;
  saveId: string;
}) {
  const { view } = props;
  const total = view.plays.length;
  const [revealed, setRevealed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  // True when the latest reveal came from the playback timer (its play is
  // choreographed); a jump (restart, skip, possession step, feed) snaps.
  const [animated, setAnimated] = useState(false);
  const [showShotChart, setShowShotChart] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<PlayerId | null>(
    null,
  );

  // Playback stops by itself once every play is revealed.
  const isPlaying = playing && revealed < total;

  // One timeout per play: each reveal schedules the next with that play's
  // pacing. Pausing or a speed change keeps what is left of the step (at 1x)
  // so the timer stays in step with the court's paused animations; a new
  // reveal or a jump starts the next step from its full pacing.
  const pending = useRef<{ revealed: number; remainingMs: number } | null>(
    null,
  );
  useEffect(() => {
    if (!isPlaying) {
      return;
    }
    const remainingMs =
      pending.current?.revealed === revealed
        ? pending.current.remainingMs
        : playDelayMs(view, revealed);
    const startedAt = performance.now();
    const id = setTimeout(() => {
      pending.current = null;
      setAnimated(true);
      setRevealed((current) => Math.min(total, current + 1));
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

  const live = useMemo(
    () => buildLiveBoxScore(view, revealed),
    [view, revealed],
  );
  const shotSummary = useMemo(
    () => buildShotSummary(view, revealed),
    [view, revealed],
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
          })
        : null,
    [view, revealed, animated],
  );

  const previousPlay = revealed > 0 ? view.plays[revealed - 1] : undefined;
  const nextPlay = revealed < total ? view.plays[revealed] : undefined;
  const periodBreak =
    previousPlay && nextPlay && previousPlay.period !== nextPlay.period
      ? `End of ${periodLabel(previousPlay.period)} · ${view.away.abbreviation} ${live.awayScore} – ${view.home.abbreviation} ${live.homeScore}`
      : null;

  const finalCard = live.isFinal
    ? `Final · ${view.away.abbreviation} ${live.awayScore} – ${view.home.abbreviation} ${live.homeScore}`
    : null;

  const jumpTo = (next: number) => {
    pending.current = null;
    setAnimated(false);
    setRevealed(next);
    setPlaying(false);
  };

  const courtStatus: PlaybackStatus = live.isFinal
    ? "complete"
    : isPlaying
      ? "playing"
      : "paused";

  // Blank at the end: the scoreboard already says Final.
  const clockText = live.isFinal
    ? ""
    : revealed === 0
      ? "Tip-off"
      : `${live.periodLabel} ${live.clockLabel}`;
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
      <Scoreboard away={view.away} home={view.home} live={live} />
      <section aria-label="Court" className="min-w-0">
        <FullCourtView
          frame={courtFrame}
          home={view.home}
          away={view.away}
          live={live}
          showShotChart={showShotChart}
          speed={speed}
          choreography={choreography}
          motionMs={motionMs(view, revealed)}
          playing={isPlaying}
          periodBreak={periodBreak ?? finalCard}
          final={live.isFinal}
          run={currentRun(view, revealed)}
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
      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        <PlayByPlayFeed view={view} revealed={revealed} />
        <KeyMomentsList
          keyMoments={view.keyMoments}
          revealed={revealed}
          isFinal={live.isFinal}
          onJump={(playIndex) => jumpTo(playIndex + 1)}
        />
      </div>
      <LiveBoxScore
        live={live}
        away={view.away}
        home={view.home}
        players={view.players}
        selectedPlayerId={selectedPlayerId}
      />
      <ShotSummaryPanel view={view} summary={shotSummary} />
    </div>
  );
}
