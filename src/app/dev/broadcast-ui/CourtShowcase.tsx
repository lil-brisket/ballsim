"use client";

import { useMemo, useState } from "react";
import { CourtView } from "@/components/game/watch/court/CourtView";
import { Button } from "@/components/ui";
import type { PlayerId } from "@/domain/ids";
import { buildCourtFrame } from "@/state/watch-court-frame";
import { buildLiveBoxScore } from "@/state/watch-game-selectors";
import { COURT_AWAY, COURT_FIXTURE_VIEW, COURT_HOME } from "./court-fixture";

/** Steps the fixture game one play at a time through CourtView. */
export function CourtShowcase() {
  const total = COURT_FIXTURE_VIEW.plays.length;
  const [revealed, setRevealed] = useState(0);
  const [shotChart, setShotChart] = useState(false);
  const [selected, setSelected] = useState<PlayerId | null>(null);
  const frame = useMemo(
    () => buildCourtFrame(COURT_FIXTURE_VIEW, revealed),
    [revealed],
  );
  const live = useMemo(
    () => buildLiveBoxScore(COURT_FIXTURE_VIEW, revealed),
    [revealed],
  );
  const text =
    revealed > 0 ? COURT_FIXTURE_VIEW.plays[revealed - 1]!.text : "Tip-off";
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="quiet"
          disabled={revealed === 0}
          onClick={() => setRevealed((n) => Math.max(0, n - 1))}
        >
          Previous
        </Button>
        <Button
          variant="quiet"
          disabled={revealed === total}
          onClick={() => setRevealed((n) => Math.min(total, n + 1))}
        >
          Next
        </Button>
        <p className="text-sm text-zinc-400">
          Play {revealed} of {total}: {text}
        </p>
      </div>
      <CourtView
        frame={frame}
        home={COURT_HOME}
        away={COURT_AWAY}
        live={live}
        players={COURT_FIXTURE_VIEW.players}
        speed={1}
        periodBreak={null}
        showShotChart={shotChart}
        onShowShotChartChange={setShotChart}
        selectedPlayerId={selected}
        onSelectPlayer={setSelected}
      />
    </div>
  );
}
