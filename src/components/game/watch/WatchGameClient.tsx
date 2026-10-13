"use client";

import { useEffect, useMemo, useState } from "react";
import { KeyMomentsList } from "@/components/game/watch/KeyMomentsList";
import { LiveBoxScore } from "@/components/game/watch/LiveBoxScore";
import {
  PlaybackControls,
  type PlaybackSpeed,
} from "@/components/game/watch/PlaybackControls";
import { PlayByPlayFeed } from "@/components/game/watch/PlayByPlayFeed";
import { Scoreboard } from "@/components/game/watch/Scoreboard";
import { ShotSummaryPanel } from "@/components/game/watch/ShotSummaryPanel";
import {
  buildLiveBoxScore,
  buildShotSummary,
} from "@/state/watch-game-selectors";
import type { WatchGameView } from "@/state/watch-game-view";

/** Milliseconds per play at 1x. */
export const BASE_PLAY_MS = 900;

export function WatchGameClient(props: {
  view: WatchGameView;
  saveId: string;
}) {
  const { view } = props;
  const total = view.plays.length;
  const [revealed, setRevealed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);

  // Playback stops by itself once every play is revealed.
  const isPlaying = playing && revealed < total;

  useEffect(() => {
    if (!isPlaying) {
      return;
    }
    const id = setInterval(() => {
      setRevealed((current) => Math.min(total, current + 1));
    }, BASE_PLAY_MS / speed);
    return () => clearInterval(id);
  }, [isPlaying, speed, total]);

  const live = useMemo(
    () => buildLiveBoxScore(view, revealed),
    [view, revealed],
  );
  const shotSummary = useMemo(
    () => buildShotSummary(view, revealed),
    [view, revealed],
  );

  return (
    <div className="min-w-0 space-y-6">
      <Scoreboard away={view.away} home={view.home} live={live} />
      <PlaybackControls
        playing={isPlaying}
        speed={speed}
        revealed={revealed}
        total={total}
        onTogglePlay={() => setPlaying(!isPlaying)}
        onSpeedChange={setSpeed}
        onSkipToEnd={() => {
          setRevealed(total);
          setPlaying(false);
        }}
        onRestart={() => {
          setRevealed(0);
          setPlaying(false);
        }}
      />
      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <PlayByPlayFeed view={view} revealed={revealed} />
        <KeyMomentsList
          keyMoments={view.keyMoments}
          revealed={revealed}
          isFinal={live.isFinal}
          onJump={(playIndex) => {
            setRevealed(playIndex + 1);
            setPlaying(false);
          }}
        />
      </div>
      <LiveBoxScore
        live={live}
        away={view.away}
        home={view.home}
        players={view.players}
      />
      <ShotSummaryPanel view={view} summary={shotSummary} />
    </div>
  );
}
