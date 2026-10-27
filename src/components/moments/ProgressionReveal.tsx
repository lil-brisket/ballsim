"use client";

import { AnimatedOvrBadge } from "@/components/moments/AnimatedOvrBadge";
import {
  MomentOverlay,
  type MomentStep,
} from "@/components/moments/MomentOverlay";
import { signed } from "@/components/moments/progression-format";
import { PlayerPortrait } from "@/components/basketball/PlayerPortrait";
import { OvrBadge } from "@/components/ui/OvrBadge";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { cn } from "@/components/ui/styles";
import type {
  ProgressionLeagueRow,
  ProgressionPlayerRow,
  ProgressionRevealView,
} from "@/state/progression-reveal-selectors";

function deltaClass(delta: number): string {
  return delta > 0 ? "text-win" : delta < 0 ? "text-loss" : "text-muted";
}

function headlineBody(view: ProgressionRevealView) {
  return (
    <div className="space-y-1">
      <p>
        {view.improved} improved · {view.declined} declined · {view.unchanged}{" "}
        unchanged
      </p>
      <p>
        Team Avg OVR {view.averageBefore} → {view.averageAfter} (
        {signed(view.averageDelta)})
      </p>
    </div>
  );
}

function splitName(name: string): [string, string] {
  const index = name.indexOf(" ");
  return index < 0 ? [name, ""] : [name.slice(0, index), name.slice(index + 1)];
}

function PlayerBody({ row }: { row: ProgressionPlayerRow }) {
  const [firstName, lastName] = splitName(row.name);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <PlayerPortrait
          playerId={row.playerId}
          firstName={firstName}
          lastName={lastName}
          size="lg"
          portrait={row.portrait}
        />
        <AnimatedOvrBadge from={row.before} to={row.after} size="lg" />
        <span
          className={cn(
            "text-3xl font-semibold tabular-nums",
            deltaClass(row.delta),
          )}
        >
          {signed(row.delta)}
        </span>
      </div>
      <p className="text-sm text-muted">
        Age {row.age} · {row.position}
      </p>
      {row.topMoves.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {row.topMoves.map((move) => (
            <li key={move.key} className="tabular-nums">
              {move.label} {move.before} → {move.after} ({signed(move.delta)})
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function LeagueList(props: { heading: string; rows: ProgressionLeagueRow[] }) {
  if (props.rows.length === 0) return null;
  return (
    <div>
      <SectionHeading as="h3" size="sm" title={props.heading} />
      <ul className="space-y-1 text-sm tabular-nums">
        {props.rows.map((row) => (
          <li key={row.playerId}>
            {row.name} ({row.teamAbbreviation}) {row.before} → {row.after} (
            {signed(row.delta)})
          </li>
        ))}
      </ul>
    </div>
  );
}

export function buildProgressionSteps(
  view: ProgressionRevealView,
): MomentStep[] {
  const steps: MomentStep[] = [
    {
      id: "headline",
      eyebrow: `${view.seasonYear} offseason`,
      title: "Player progression",
      body: headlineBody(view),
    },
  ];
  view.changed.forEach((row, index) => {
    steps.push({
      id: `player-${row.playerId}`,
      eyebrow:
        index === 0 && row.delta > 0
          ? "Biggest jump"
          : row.delta > 0
            ? "Improved"
            : "Declined",
      title: row.name,
      body: <PlayerBody row={row} />,
      sting: index === 0 && row.delta > 0,
    });
  });
  if (view.unchangedPlayers.length > 0) {
    steps.push({
      id: "unchanged",
      title: "No change",
      body: (
        <ul className="space-y-1 text-sm">
          {view.unchangedPlayers.map((row) => (
            <li key={row.playerId} className="flex items-center gap-2">
              <OvrBadge overall={row.after} size="sm" />
              {row.name}
            </li>
          ))}
        </ul>
      ),
    });
  }
  if (view.risers.length > 0 || view.fallers.length > 0) {
    steps.push({
      id: "league",
      eyebrow: "Around the league",
      title: "Top risers and fallers",
      body: (
        <div className="space-y-4">
          <LeagueList heading="Risers" rows={view.risers} />
          <LeagueList heading="Fallers" rows={view.fallers} />
        </div>
      ),
    });
  }
  return steps;
}

/** Full-screen progression moment for the owner's roster. */
export function ProgressionReveal(props: {
  view: ProgressionRevealView;
  open: boolean;
  onClose: () => void;
}) {
  const { view } = props;
  return (
    <MomentOverlay
      open={props.open}
      onClose={props.onClose}
      label="Progression reveal"
      steps={buildProgressionSteps(view)}
      summary={{
        id: "summary",
        eyebrow: `${view.seasonYear} offseason`,
        title: "Player progression",
        body: (
          <div className="space-y-3">
            {headlineBody(view)}
            {view.changed.length > 0 ? (
              <ul className="space-y-1 text-sm tabular-nums">
                {view.changed.map((row) => (
                  <li key={row.playerId}>
                    {row.name} {row.before} → {row.after} ({signed(row.delta)})
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ),
      }}
    />
  );
}
