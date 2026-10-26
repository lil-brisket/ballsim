import { useState } from "react";
import { cn, focusRingClass, touchTargetClass } from "@/components/ui/styles";
import type { PlayerId } from "@/domain/ids";
import type {
  LiveBoxScore as LiveBoxScoreModel,
  LiveBoxScoreRow,
  LiveTeamBox,
  WatchPlayer,
  WatchTeam,
} from "@/state/watch-game-view";

const STAT_HEADERS = [
  "PTS",
  "REB",
  "AST",
  "STL",
  "BLK",
  "TO",
  "PF",
  "FG",
  "3PT",
  "FT",
];

type StatCells = Pick<
  LiveBoxScoreRow,
  | "points"
  | "rebounds"
  | "assists"
  | "steals"
  | "blocks"
  | "turnovers"
  | "fouls"
  | "fgm"
  | "fga"
  | "threePm"
  | "threePa"
  | "ftm"
  | "fta"
>;

/** Pins the player column while the stat columns scroll sideways. */
const STICKY_CELL = "sticky left-0 z-10";

function StatTds(props: { stats: StatCells; strong?: boolean }) {
  const { stats } = props;
  const cells = [
    stats.points,
    stats.rebounds,
    stats.assists,
    stats.steals,
    stats.blocks,
    stats.turnovers,
    stats.fouls,
    `${stats.fgm}-${stats.fga}`,
    `${stats.threePm}-${stats.threePa}`,
    `${stats.ftm}-${stats.fta}`,
  ];
  return (
    <>
      {cells.map((cell, index) => (
        <td
          key={STAT_HEADERS[index]}
          className={cn(
            "whitespace-nowrap px-3 py-2 text-right font-mono tabular-nums",
            index === 0 ? "font-bold text-ink" : "text-soft",
            props.strong && "font-bold text-ink",
          )}
        >
          {cell}
        </td>
      ))}
    </>
  );
}

function PlayerRow(props: {
  row: LiveBoxScoreRow;
  isFinal: boolean;
  minutes: number;
  selected: boolean;
}) {
  const { row, selected } = props;
  return (
    <tr
      data-selected={selected ? "true" : undefined}
      className={cn(
        "border-t border-line",
        row.fouledOut && "text-faint",
        selected &&
          "bg-team/15 outline outline-1 -outline-offset-1 outline-team-ink",
      )}
    >
      <td
        className={cn(
          STICKY_CELL,
          "whitespace-nowrap px-3 py-2 text-ink",
          selected ? "bg-surface-raised" : "bg-surface-base",
        )}
      >
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden
            className={cn(
              "h-2 w-2 shrink-0 rounded-full",
              row.onCourt ? "bg-emerald-400" : "bg-transparent",
            )}
          />
          {row.onCourt ? <span className="sr-only">on court</span> : null}
          <span>{row.shortName}</span>
          {selected ? <span className="sr-only">selected</span> : null}
          {row.fouledOut ? (
            <span className="rounded border border-rose-700/50 px-1 text-xs text-rose-300">
              FO
            </span>
          ) : null}
        </span>
      </td>
      {props.isFinal ? (
        <td className="whitespace-nowrap px-3 py-2 text-right font-mono tabular-nums text-soft">
          {props.minutes}
        </td>
      ) : null}
      <StatTds stats={row} />
    </tr>
  );
}

function TeamTable(props: {
  team: WatchTeam;
  box: LiveTeamBox;
  players: WatchPlayer[];
  isFinal: boolean;
  selectedPlayerId: PlayerId | null;
}) {
  const minutes = new Map(
    props.players.map((p) => [p.playerId, p.finalMinutes]),
  );
  // Roster order within each group; never sorted, so rows stay put in playback.
  const starters = props.box.rows.filter((row) => row.started);
  const bench = props.box.rows.filter((row) => !row.started);
  const totalMinutes = props.box.rows.reduce(
    (sum, row) => sum + (minutes.get(row.playerId) ?? 0),
    0,
  );
  const headers = [
    "Player",
    ...(props.isFinal ? ["MIN"] : []),
    ...STAT_HEADERS,
  ];
  const renderRow = (row: LiveBoxScoreRow) => (
    <PlayerRow
      key={row.playerId}
      row={row}
      isFinal={props.isFinal}
      minutes={minutes.get(row.playerId) ?? 0}
      selected={row.playerId === props.selectedPlayerId}
    />
  );
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="min-w-full text-left text-sm">
        <caption className="sr-only">
          {props.team.abbreviation} live box score
        </caption>
        <thead className="bg-surface-raised text-muted">
          <tr>
            {headers.map((header, index) => (
              <th
                key={header}
                scope="col"
                className={cn(
                  "px-3 py-2 font-medium",
                  index === 0
                    ? cn(STICKY_CELL, "bg-surface-raised")
                    : "text-right",
                )}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {starters.map(renderRow)}
          {bench.length > 0 ? (
            <tr className="border-t border-line">
              <th
                scope="colgroup"
                colSpan={headers.length}
                className="bg-surface-raised/60 px-3 py-1 text-left text-sm font-medium text-muted"
              >
                Bench
              </th>
            </tr>
          ) : null}
          {bench.map(renderRow)}
          <tr className="border-t border-line-strong bg-surface-raised/60">
            <td
              className={cn(
                STICKY_CELL,
                "bg-surface-raised px-3 py-2 font-medium text-ink",
              )}
            >
              Totals
            </td>
            {props.isFinal ? (
              <td className="whitespace-nowrap px-3 py-2 text-right font-mono font-bold tabular-nums text-ink">
                {totalMinutes}
              </td>
            ) : null}
            <StatTds stats={props.box.totals} strong />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

type TeamSide = "away" | "home";

export function LiveBoxScore(props: {
  live: LiveBoxScoreModel;
  away: WatchTeam;
  home: WatchTeam;
  players: WatchPlayer[];
  /** Row highlighted from the court (player card). */
  selectedPlayerId?: PlayerId | null;
}) {
  const selectedPlayerId = props.selectedPlayerId ?? null;
  // The shown team follows the court selection: a newly selected player
  // brings their team into view, clearing the selection leaves it as is, and
  // the toggle overrides it until the selection changes again.
  const selectedSide: TeamSide | null =
    selectedPlayerId === null
      ? null
      : props.live.home.rows.some((r) => r.playerId === selectedPlayerId)
        ? "home"
        : props.live.away.rows.some((r) => r.playerId === selectedPlayerId)
          ? "away"
          : null;
  const [shown, setShown] = useState<{
    side: TeamSide;
    seen: PlayerId | null;
  }>({ side: selectedSide ?? "away", seen: selectedPlayerId });
  let side = shown.side;
  if (shown.seen !== selectedPlayerId) {
    side = selectedSide ?? shown.side;
    setShown({ side, seen: selectedPlayerId });
  }
  const teams: { side: TeamSide; team: WatchTeam }[] = [
    { side: "away", team: props.away },
    { side: "home", team: props.home },
  ];
  return (
    <div className="min-w-0 space-y-3">
      <div role="group" aria-label="Team" className="flex gap-2">
        {teams.map((t) => (
          <button
            key={t.side}
            type="button"
            aria-pressed={side === t.side}
            onClick={() => setShown({ side: t.side, seen: selectedPlayerId })}
            className={cn(
              touchTargetClass,
              focusRingClass,
              "rounded-md border px-4 text-sm font-semibold",
              side === t.side
                ? "border-team-ink bg-team/15 text-ink"
                : "border-line-strong text-soft hover:bg-surface-high",
            )}
          >
            <span>{t.team.abbreviation}</span>
            <span className="sr-only">
              {" "}
              {t.team.city} {t.team.name}
            </span>
          </button>
        ))}
      </div>
      <TeamTable
        team={side === "home" ? props.home : props.away}
        box={side === "home" ? props.live.home : props.live.away}
        players={props.players}
        isFinal={props.live.isFinal}
        selectedPlayerId={selectedPlayerId}
      />
    </div>
  );
}
