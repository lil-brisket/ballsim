"use client";

import { useMemo, useState } from "react";
import { FullCourtView } from "@/components/game/watch/court/FullCourtView";
import { Button } from "@/components/ui";
import type { PlayerId } from "@/domain/ids";
import { buildLiveBoxScore } from "@/state/watch-game-selectors";
import { buildFullCourtFrame } from "@/state/watch-full-court";
import type { WatchTeam } from "@/state/watch-game-view";
import { COURT_AWAY, COURT_FIXTURE_VIEW, COURT_HOME } from "./court-fixture";

const LIGHT_HOME: WatchTeam = {
  ...COURT_HOME,
  branding: {
    ...COURT_HOME.branding,
    primaryColor: "#F2F0E6",
    secondaryColor: "#1D6B44",
    accentColor: "#C8102E",
  },
};

const CLASHING_HOME: WatchTeam = {
  ...COURT_HOME,
  branding: { ...COURT_HOME.branding, primaryColor: "#C8102E" },
};

const CLASHING_AWAY: WatchTeam = {
  ...COURT_AWAY,
  branding: {
    ...COURT_AWAY.branding,
    primaryColor: "#C8102E",
    secondaryColor: "#F2F0E6",
  },
};

const UNBRANDED_HOME: WatchTeam = { ...COURT_HOME, hasBranding: false };

const PAIRS = [
  { label: "Dark home", home: COURT_HOME, away: COURT_AWAY },
  { label: "Light home", home: LIGHT_HOME, away: COURT_AWAY },
  { label: "Clashing", home: CLASHING_HOME, away: CLASHING_AWAY },
  { label: "No branding", home: UNBRANDED_HOME, away: COURT_AWAY },
] as const;

/** Steps the fixture game one play at a time through FullCourtView. */
export function FullCourtShowcase() {
  const total = COURT_FIXTURE_VIEW.plays.length;
  const [revealed, setRevealed] = useState(0);
  const [shotChart, setShotChart] = useState(false);
  const [selected, setSelected] = useState<PlayerId | null>(null);
  const [pairIndex, setPairIndex] = useState(0);
  const [wide, setWide] = useState(false);
  const pair = PAIRS[pairIndex]!;
  const frame = useMemo(
    () => buildFullCourtFrame(COURT_FIXTURE_VIEW, revealed),
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
      <div className="flex flex-wrap items-center gap-2">
        {PAIRS.map((option, index) => (
          <Button
            key={option.label}
            variant="quiet"
            aria-pressed={index === pairIndex}
            onClick={() => setPairIndex(index)}
          >
            {option.label}
          </Button>
        ))}
        <Button
          variant="quiet"
          aria-pressed={wide}
          onClick={() => setWide((value) => !value)}
        >
          Wide shot
        </Button>
      </div>
      <FullCourtView
        frame={frame}
        home={pair.home}
        away={pair.away}
        live={live}
        players={COURT_FIXTURE_VIEW.players}
        speed={1}
        periodBreak={null}
        wide={wide}
        showShotChart={shotChart}
        onShowShotChartChange={setShotChart}
        selectedPlayerId={selected}
        onSelectPlayer={setSelected}
      />
    </div>
  );
}
