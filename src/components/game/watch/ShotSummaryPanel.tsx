import { DataTable, Section } from "@/components/ui";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { periodLabel } from "@/state/watch-game-selectors";
import type {
  ShotLine,
  ShotSummary,
  WatchGameView,
  WatchTeam,
} from "@/state/watch-game-view";

function pct(made: number, attempted: number): string {
  return attempted === 0 ? "—" : `${Math.round((made / attempted) * 100)}%`;
}

function shotCell(made: number, attempted: number): string {
  return `${made}-${attempted}`;
}

function TeamShotCard(props: { team: WatchTeam; line: ShotLine }) {
  const { line } = props;
  const rows: Array<[string, number, number]> = [
    ["2PT", line.twoPm, line.twoPa],
    ["3PT", line.threePm, line.threePa],
    ["FT", line.ftm, line.fta],
  ];
  return (
    <div className="min-w-0 space-y-2">
      <h3 className="text-sm font-semibold text-zinc-100">
        {props.team.abbreviation}
      </h3>
      <DataTable
        headers={["Type", "M-A", "%"]}
        caption={`${props.team.abbreviation} shot types`}
      >
        {rows.map(([label, made, attempted]) => (
          <tr key={label} className="border-t border-zinc-800">
            <td className="px-3 py-2 text-zinc-300">{label}</td>
            <td className="px-3 py-2 font-mono tabular-nums text-zinc-100">
              {shotCell(made, attempted)}
            </td>
            <td className="px-3 py-2 font-mono tabular-nums text-zinc-400">
              {pct(made, attempted)}
            </td>
          </tr>
        ))}
      </DataTable>
      <p className="text-sm tabular-nums text-zinc-400">
        Points {line.points} · Assisted{" "}
        {line.fgm === 0
          ? "—"
          : `${Math.round((line.assistedFgm / line.fgm) * 100)}%`}
      </p>
    </div>
  );
}

export function ShotSummaryPanel(props: {
  view: WatchGameView;
  summary: ShotSummary;
}) {
  const { view, summary } = props;
  const periods = summary.home.byPeriod.length;
  const playerName = new Map(
    view.players.map((p) => [p.playerId, p.shortName]),
  );
  const top = summary.players
    .filter((entry) => entry.line.points > 0)
    .slice(0, 5);

  return (
    <Section title="Shot summary">
      <p className="text-sm text-zinc-500">
        Shot locations aren&apos;t tracked by the simulation, so this is a
        shot-type summary rather than a shot chart.
      </p>
      <div className="grid gap-6 sm:grid-cols-2">
        <TeamShotCard team={view.away} line={summary.away.total} />
        <TeamShotCard team={view.home} line={summary.home.total} />
      </div>

      <SectionHeading as="h3" title="By quarter" />
      <DataTable
        headers={[
          "Period",
          `${view.away.abbreviation} PTS`,
          `${view.away.abbreviation} FG`,
          `${view.away.abbreviation} 3PT`,
          `${view.home.abbreviation} PTS`,
          `${view.home.abbreviation} FG`,
          `${view.home.abbreviation} 3PT`,
        ]}
        caption="Shot summary by quarter"
      >
        {Array.from({ length: periods }, (_, index) => {
          const away = summary.away.byPeriod[index]!;
          const home = summary.home.byPeriod[index]!;
          return (
            <tr key={index} className="border-t border-zinc-800">
              <td className="px-3 py-2 text-zinc-300">
                {periodLabel(index + 1)}
              </td>
              {[away, home].flatMap((line, side) => [
                <td
                  key={`${side}-pts`}
                  className="px-3 py-2 font-mono font-bold tabular-nums text-zinc-100"
                >
                  {line.points}
                </td>,
                <td
                  key={`${side}-fg`}
                  className="px-3 py-2 font-mono tabular-nums text-zinc-300"
                >
                  {shotCell(line.fgm, line.fga)}
                </td>,
                <td
                  key={`${side}-3p`}
                  className="px-3 py-2 font-mono tabular-nums text-zinc-300"
                >
                  {shotCell(line.threePm, line.threePa)}
                </td>,
              ])}
            </tr>
          );
        })}
      </DataTable>

      <SectionHeading as="h3" title="Top scorers" />
      {top.length === 0 ? (
        <p className="text-sm text-zinc-500">No points scored yet.</p>
      ) : (
        <ol className="space-y-1">
          {top.map((entry) => (
            <li
              key={entry.playerId}
              className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 px-3 py-2 text-sm"
            >
              <span className="min-w-0 truncate text-zinc-100">
                {playerName.get(entry.playerId) ?? entry.playerId}{" "}
                <span className="text-sm text-zinc-500">
                  {entry.side === 0
                    ? view.home.abbreviation
                    : view.away.abbreviation}
                </span>
              </span>
              <span className="shrink-0 font-mono text-sm tabular-nums text-zinc-300">
                {entry.line.points} PTS · FG{" "}
                {shotCell(entry.line.fgm, entry.line.fga)} · 3PT{" "}
                {shotCell(entry.line.threePm, entry.line.threePa)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}
