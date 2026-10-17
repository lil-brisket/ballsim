"use client";

import { useEffect, useMemo, useState } from "react";
import { CourtPlayerCard } from "@/components/game/watch/court/CourtPlayerCard";
import type { CourtStatus } from "@/components/game/watch/court/CourtHeader";
import { FullCourtView } from "@/components/game/watch/court/FullCourtView";
import { KeyMomentsList } from "@/components/game/watch/KeyMomentsList";
import { LiveBoxScore } from "@/components/game/watch/LiveBoxScore";
import {
  PlaybackControls,
  type PlaybackSpeed,
} from "@/components/game/watch/PlaybackControls";
import { PlayByPlayFeed } from "@/components/game/watch/PlayByPlayFeed";
import { Scoreboard } from "@/components/game/watch/Scoreboard";
import { ShotSummaryPanel } from "@/components/game/watch/ShotSummaryPanel";
import { playDelayMs } from "@/components/game/watch/playback-pacing";
import { Panel, SectionHeading } from "@/components/ui";
import type { PlayerId } from "@/domain/ids";
import { stepPossession } from "@/state/watch-court-frame";
import { buildFullCourtFrame } from "@/state/watch-full-court";
import {
  buildLiveBoxScore,
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
  const [selectedPlayerId, setSelectedPlayerId] = useState<PlayerId | null>(
    null,
  );

  // Playback stops by itself once every play is revealed.
  const isPlaying = playing && revealed < total;

  // One timeout per play: each reveal schedules the next with that play's
  // pacing. Pausing, a speed change or unmount clears the pending step.
  useEffect(() => {
    if (!isPlaying) {
      return;
    }
    const id = setTimeout(
      () => setRevealed((current) => Math.min(total, current + 1)),
      playDelayMs(view, revealed) / speed,
    );
    return () => clearTimeout(id);
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
      <Panel as="section" className="min-w-0 space-y-3">
        <SectionHeading as="h2" title="Court" />
        <FullCourtView
          frame={courtFrame}
          home={view.home}
          away={view.away}
          live={live}
          status={courtStatus}
          speed={speed}
          periodBreak={periodBreak ?? finalCard}
          wide={periodBreak !== null || live.isFinal}
          final={live.isFinal}
          players={view.players}
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
