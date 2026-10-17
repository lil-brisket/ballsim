"use client";

import { useEffect, useMemo, useState } from "react";
import { CourtPlayerCard } from "@/components/game/watch/court/CourtPlayerCard";
import {
  CourtView,
  type CourtStatus,
} from "@/components/game/watch/court/CourtView";
import { KeyMomentsList } from "@/components/game/watch/KeyMomentsList";
import { LiveBoxScore } from "@/components/game/watch/LiveBoxScore";
import {
  PlaybackControls,
  type PlaybackSpeed,
} from "@/components/game/watch/PlaybackControls";
import { PlayByPlayFeed } from "@/components/game/watch/PlayByPlayFeed";
import { Scoreboard } from "@/components/game/watch/Scoreboard";
import { ShotSummaryPanel } from "@/components/game/watch/ShotSummaryPanel";
import { Panel, SectionHeading } from "@/components/ui";
import type { PlayerId } from "@/domain/ids";
import { buildCourtFrame, stepPossession } from "@/state/watch-court-frame";
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
  const [selectedPlayerId, setSelectedPlayerId] = useState<PlayerId | null>(
    null,
  );

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
  const courtFrame = useMemo(
    () => buildCourtFrame(view, revealed),
    [view, revealed],
  );

  const jumpTo = (next: number) => {
    setRevealed(next);
    setPlaying(false);
  };

  const courtStatus: CourtStatus = live.isFinal
    ? "complete"
    : isPlaying
      ? "playing"
      : "paused";

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
      <PlaybackControls
        playing={isPlaying}
        speed={speed}
        revealed={revealed}
        total={total}
        onTogglePlay={() => setPlaying(!isPlaying)}
        onSpeedChange={setSpeed}
        onSkipToEnd={() => jumpTo(total)}
        onRestart={() => jumpTo(0)}
        onPreviousPossession={() => jumpTo(stepPossession(view, revealed, -1))}
        onNextPossession={() => jumpTo(stepPossession(view, revealed, 1))}
      />
      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel as="section" className="min-w-0 space-y-3">
          <SectionHeading as="h2" title="Court" />
          <CourtView
            frame={courtFrame}
            home={view.home}
            away={view.away}
            live={live}
            status={courtStatus}
            selectedPlayerId={selectedPlayerId}
            onSelectPlayer={(id) =>
              setSelectedPlayerId((current) => (current === id ? null : id))
            }
          />
          {selectedPlayer && selectedRow ? (
            <CourtPlayerCard
              player={selectedPlayer}
              team={selectedPlayer.side === 0 ? view.home : view.away}
              row={selectedRow}
              onClose={() => setSelectedPlayerId(null)}
            />
          ) : null}
        </Panel>
        <div className="min-w-0 space-y-6">
          <PlayByPlayFeed view={view} revealed={revealed} />
          <KeyMomentsList
            keyMoments={view.keyMoments}
            revealed={revealed}
            isFinal={live.isFinal}
            onJump={(playIndex) => jumpTo(playIndex + 1)}
          />
        </div>
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
