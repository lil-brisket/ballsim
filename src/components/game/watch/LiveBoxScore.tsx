import { DataTable, Section } from "@/components/ui";
import { cn } from "@/components/ui/styles";
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
            "whitespace-nowrap px-3 py-2 font-mono tabular-nums",
            index === 0 ? "font-bold text-zinc-50" : "text-zinc-300",
            props.strong && "font-bold text-zinc-100",
          )}
        >
          {cell}
        </td>
      ))}
    </>
  );
}

function TeamTable(props: {
  team: WatchTeam;
  box: LiveTeamBox;
  players: WatchPlayer[];
  isFinal: boolean;
}) {
  const minutes = new Map(
    props.players.map((p) => [p.playerId, p.finalMinutes]),
  );
  const rows = [
    ...props.box.rows.filter((row) => row.started),
    ...props.box.rows.filter((row) => !row.started),
  ];
  const totalMinutes = rows.reduce(
    (sum, row) => sum + (minutes.get(row.playerId) ?? 0),
    0,
  );
  const headers = [
    "Player",
    ...(props.isFinal ? ["MIN"] : []),
    ...STAT_HEADERS,
  ];
  return (
    <Section title={`${props.team.city} ${props.team.name}`}>
      <DataTable
        headers={headers}
        caption={`${props.team.abbreviation} live box score`}
      >
        {rows.map((row) => (
          <tr
            key={row.playerId}
            className={cn(
              "border-t border-zinc-800",
              row.fouledOut && "text-zinc-500",
            )}
          >
            <td className="whitespace-nowrap px-3 py-2 text-zinc-100">
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
                {row.fouledOut ? (
                  <span className="rounded border border-rose-700/50 px-1 font-mono text-[0.65rem] text-rose-300">
                    FO
                  </span>
                ) : null}
              </span>
            </td>
            {props.isFinal ? (
              <td className="whitespace-nowrap px-3 py-2 font-mono tabular-nums text-zinc-300">
                {minutes.get(row.playerId) ?? 0}
              </td>
            ) : null}
            <StatTds stats={row} />
          </tr>
        ))}
        <tr className="border-t border-zinc-700 bg-zinc-900/60">
          <td className="px-3 py-2 font-medium text-zinc-200">Totals</td>
          {props.isFinal ? (
            <td className="whitespace-nowrap px-3 py-2 font-mono font-bold tabular-nums text-zinc-100">
              {totalMinutes}
            </td>
          ) : null}
          <StatTds stats={props.box.totals} strong />
        </tr>
      </DataTable>
    </Section>
  );
}

export function LiveBoxScore(props: {
  live: LiveBoxScoreModel;
  away: WatchTeam;
  home: WatchTeam;
  players: WatchPlayer[];
}) {
  return (
    <div className="min-w-0 space-y-6">
      <TeamTable
        team={props.away}
        box={props.live.away}
        players={props.players}
        isFinal={props.live.isFinal}
      />
      <TeamTable
        team={props.home}
        box={props.live.home}
        players={props.players}
        isFinal={props.live.isFinal}
      />
    </div>
  );
}
