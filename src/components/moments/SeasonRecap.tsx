"use client";

import {
  MomentOverlay,
  type MomentStep,
} from "@/components/moments/MomentOverlay";
import { PlayerPortrait } from "@/components/basketball/PlayerPortrait";
import { MoneyDisplay, formatMoney } from "@/components/owner/MoneyDisplay";
import type {
  TrajectoryArrow,
  YoYMetric,
} from "@/domain/entities/annual-franchise-report";
import { formatGameDate } from "@/presentation/game-date";
import type {
  SeasonRecapGame,
  SeasonRecapView,
} from "@/state/season-recap-selectors";

/** 1st, 2nd, 3rd, 4th, 11th, 12th, 21st. */
export function ordinal(value: number): string {
  const tail = value % 100;
  if (tail >= 11 && tail <= 13) return `${value}th`;
  switch (value % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
}

function overtimeLabel(overtimes: number): string {
  return overtimes <= 0 ? "" : overtimes === 1 ? "OT" : `${overtimes}OT`;
}

export function recordLine(view: SeasonRecapView): string {
  return `${view.wins}–${view.losses}`;
}

export function gameLine(game: SeasonRecapGame): string {
  const parts = [
    `W ${game.teamScore}–${game.opponentScore} ${game.home ? "vs" : "@"} ${game.opponentAbbreviation}`,
    formatGameDate(game.date),
  ];
  if (game.playoff) parts.push("Playoffs");
  const overtime = overtimeLabel(game.overtimes);
  if (overtime) parts.push(overtime);
  return parts.join(" · ");
}

const TRAJECTORY: Record<TrajectoryArrow, { glyph: string; word: string }> = {
  up: { glyph: "▲", word: "Up" },
  flat: { glyph: "▶", word: "Flat" },
  down: { glyph: "▼", word: "Down" },
};

const TRAJECTORY_ROWS = [
  ["competitive", "Competitive"],
  ["financial", "Financial"],
  ["brand", "Brand"],
] as const;

export function trajectoryWord(arrow: TrajectoryArrow): string {
  return TRAJECTORY[arrow].word;
}

/** Signed money change vs last year; null in a first season (no prior). */
function moneyChange(metric: YoYMetric): string | null {
  if (metric.delta === null) return null;
  if (metric.delta > 0) return `+${formatMoney(metric.delta)} vs last year`;
  if (metric.delta < 0) {
    return `−${formatMoney(Math.abs(metric.delta))} vs last year`;
  }
  return "No change vs last year";
}

export function playerLine(
  player: NonNullable<SeasonRecapView["bestPlayer"]>,
): string {
  return `${player.games} GP · ${player.points.toFixed(1)} PTS · ${player.rebounds.toFixed(1)} REB · ${player.assists.toFixed(1)} AST`;
}

function splitName(name: string): [string, string] {
  const index = name.indexOf(" ");
  return index < 0 ? [name, ""] : [name.slice(0, index), name.slice(index + 1)];
}

export function RecordBody({ view }: { view: SeasonRecapView }) {
  return (
    <div className="space-y-1 text-lg">
      {view.leagueRank !== null ? (
        <p>{ordinal(view.leagueRank)} in the league</p>
      ) : null}
      {view.seed !== null ? <p>No. {view.seed} seed</p> : null}
      <p>{view.playoffLabel}</p>
      {view.championship ? <p className="font-semibold">Champions</p> : null}
    </div>
  );
}

export function GamesBody({ view }: { view: SeasonRecapView }) {
  return (
    <ul className="space-y-2 text-base tabular-nums">
      {view.bestGames.map((game) => (
        <li key={game.gameId}>{gameLine(game)}</li>
      ))}
    </ul>
  );
}

export function AwardsBody({ view }: { view: SeasonRecapView }) {
  return (
    <ul className="space-y-2 text-lg">
      {view.awardWinners.map((award) => (
        <li key={award.awardName}>
          {award.awardName}: {award.winnerName}
        </li>
      ))}
    </ul>
  );
}

export function PlayerBody({
  player,
}: {
  player: NonNullable<SeasonRecapView["bestPlayer"]>;
}) {
  const [firstName, lastName] = splitName(player.name);
  return (
    <div className="flex items-center gap-4">
      <PlayerPortrait
        playerId={player.playerId}
        firstName={firstName}
        lastName={lastName}
        size="lg"
        portrait={player.portrait}
      />
      <div className="space-y-1">
        <p className="text-sm tabular-nums text-muted">{playerLine(player)}</p>
        {player.position ? <p className="text-lg">{player.position}</p> : null}
      </div>
    </div>
  );
}

function MoneyRow(props: { label: string; metric: YoYMetric }) {
  const change = moneyChange(props.metric);
  return (
    <li className="flex flex-wrap items-baseline gap-x-3">
      <span className="text-muted">{props.label}</span>
      <MoneyDisplay amount={props.metric.value} className="text-lg" />
      {change ? <span className="text-sm text-muted">{change}</span> : null}
    </li>
  );
}

export function FinancesBody({ view }: { view: SeasonRecapView }) {
  return (
    <ul className="space-y-2">
      <MoneyRow label="Net income" metric={view.finances.netIncome} />
      <MoneyRow label="Ending cash" metric={view.finances.endingCash} />
    </ul>
  );
}

export function TrajectoryBody({ view }: { view: SeasonRecapView }) {
  return (
    <ul className="space-y-2 text-lg">
      {TRAJECTORY_ROWS.map(([key, label]) => {
        const arrow = view.trajectory[key];
        return (
          <li key={key} className="flex items-center gap-3">
            <span aria-hidden="true">{TRAJECTORY[arrow].glyph}</span>
            <span className="text-muted">{label}</span>
            <span className="font-semibold">{TRAJECTORY[arrow].word}</span>
          </li>
        );
      })}
    </ul>
  );
}

function SummaryBody({ view }: { view: SeasonRecapView }) {
  const net = moneyChange(view.finances.netIncome);
  return (
    <div className="space-y-2">
      <p className="text-lg">
        {recordLine(view)} · {view.playoffLabel}
      </p>
      {view.bestPlayer ? (
        <p>
          Best player: {view.bestPlayer.name} · {playerLine(view.bestPlayer)}
        </p>
      ) : null}
      <p>
        Net income <MoneyDisplay amount={view.finances.netIncome.value} />
        {net ? ` (${net})` : ""}
      </p>
      <p>
        {TRAJECTORY_ROWS.map(
          ([key, label]) => `${label} ${trajectoryWord(view.trajectory[key])}`,
        ).join(" · ")}
      </p>
    </div>
  );
}

export function buildSeasonRecapSteps(view: SeasonRecapView): MomentStep[] {
  const eyebrow = `${view.seasonYear} season`;
  const steps: MomentStep[] = [
    {
      id: "record",
      eyebrow,
      title: recordLine(view),
      body: <RecordBody view={view} />,
      sting: view.championship,
    },
  ];
  if (view.bestGames.length > 0) {
    steps.push({
      id: "games",
      eyebrow,
      title: "Best games",
      body: <GamesBody view={view} />,
    });
  }
  if (view.awardWinners.length > 0) {
    steps.push({
      id: "awards",
      eyebrow,
      title: "Your award winners",
      body: <AwardsBody view={view} />,
    });
  }
  if (view.bestPlayer) {
    steps.push({
      id: "player",
      eyebrow: "Best player",
      title: view.bestPlayer.name,
      body: <PlayerBody player={view.bestPlayer} />,
    });
  }
  steps.push(
    {
      id: "finances",
      eyebrow,
      title: "The books",
      body: <FinancesBody view={view} />,
    },
    {
      id: "trajectory",
      eyebrow,
      title: "Where the franchise is heading",
      body: <TrajectoryBody view={view} />,
    },
  );
  return steps;
}

/** The owner's season in six beats; replayable from Franchise History. */
export function SeasonRecap(props: {
  view: SeasonRecapView;
  open: boolean;
  onClose: () => void;
}) {
  const { view } = props;
  return (
    <MomentOverlay
      open={props.open}
      onClose={props.onClose}
      label="Season recap"
      steps={buildSeasonRecapSteps(view)}
      summary={{
        id: "summary",
        eyebrow: `${view.seasonYear} season`,
        title: "Season recap",
        body: <SummaryBody view={view} />,
      }}
    />
  );
}
