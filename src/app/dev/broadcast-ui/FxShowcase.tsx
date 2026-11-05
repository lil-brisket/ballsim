"use client";

import { useMemo, useState } from "react";
import { WatchGameClient } from "@/components/game/watch/WatchGameClient";
import { Button } from "@/components/ui";
import { asPlayerId } from "@/domain/ids";
import type {
  WatchGameView,
  WatchPlay,
  WatchPlayer,
} from "@/state/watch-game-view";
import { COURT_FIXTURE_VIEW } from "./court-fixture";

type Scenario = {
  label: string;
  /** Rewrites the fixture's plays to show one kind of moment. */
  plays: (plays: WatchPlay[]) => WatchPlay[];
};

/** Reserves, so the benches look like a real game's. */
const RESERVES: WatchPlayer[] = ([0, 1] as const).flatMap((side) =>
  Array.from({ length: 7 }, (_, i) => {
    const last = ["Boyd", "Cruz", "Dunn", "Ellis", "Ford", "Grant", "Hayes"][
      i
    ]!;
    return {
      playerId: asPlayerId(`${side === 0 ? "h" : "a"}r${i}`),
      side,
      fullName: `Reserve ${last}`,
      shortName: `R. ${last}`,
      lastName: last,
      position: null,
      jerseyNumber: 50 + i,
      started: false,
      finalMinutes: 0,
    };
  }),
);

const atFirst = (change: Partial<WatchPlay>) => (plays: WatchPlay[]) =>
  plays.map((play, index) => (index === 0 ? { ...play, ...change } : play));

const SCENARIOS: Scenario[] = [
  {
    label: "Ordinary make",
    plays: atFirst({ kind: "two_made" }),
  },
  { label: "Three, block, steal, miss", plays: (plays) => plays },
  { label: "And-one", plays: atFirst({ highlights: ["and_one"] }) },
  { label: "Clutch", plays: atFirst({ highlights: ["clutch"] }) },
  { label: "Lead change", plays: atFirst({ highlights: ["lead_change"] }) },
  {
    label: "Game winner",
    plays: (plays) =>
      plays.map((play, index) =>
        index === plays.length - 1
          ? { ...play, highlights: ["clutch", "lead_change"] }
          : play,
      ),
  },
  { label: "Scoring run", plays: atFirst({ points: 9 }) },
  {
    label: "Period break",
    plays: (plays) =>
      plays.map((play, index) =>
        index >= 2 ? { ...play, period: 2, periodLabel: "Q2" } : play,
      ),
  },
];

/**
 * The broadcast effects on the fixture game, one moment at a time. Nothing
 * mounts until a scenario is chosen, so the page's screenshot has no canvas.
 */
export function FxShowcase() {
  const [picked, setPicked] = useState<number | null>(null);
  const view = useMemo<WatchGameView | null>(
    () =>
      picked === null
        ? null
        : {
            ...COURT_FIXTURE_VIEW,
            players: [...COURT_FIXTURE_VIEW.players, ...RESERVES],
            plays: SCENARIOS[picked]!.plays(COURT_FIXTURE_VIEW.plays),
          },
    [picked],
  );
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {SCENARIOS.map((scenario, index) => (
          <Button
            key={scenario.label}
            variant="quiet"
            aria-pressed={index === picked}
            onClick={() => setPicked(index)}
          >
            {scenario.label}
          </Button>
        ))}
      </div>
      {view ? <WatchGameClient key={picked} view={view} saveId="dev" /> : null}
    </div>
  );
}
