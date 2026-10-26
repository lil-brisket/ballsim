import { useMemo } from "react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { HalfCourtLines } from "@/components/game/court/HalfCourtLines";
import { teamTokenColor } from "@/components/game/watch/court/team-token-colors";
import { DataTable, Section } from "@/components/ui";
import { buildCourtFrame, type CourtShot } from "@/state/watch-court-frame";
import type {
  ShotLine,
  ShotSummary,
  WatchGameView,
  WatchSide,
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
      <DataTable
        headers={["Type", "M-A", "%"]}
        caption={`${props.team.abbreviation} shot types`}
      >
        {rows.map(([label, made, attempted]) => (
          <tr key={label} className="border-t border-line">
            <td className="px-3 py-2 text-soft">{label}</td>
            <td className="px-3 py-2 font-mono tabular-nums text-ink">
              {shotCell(made, attempted)}
            </td>
            <td className="px-3 py-2 font-mono tabular-nums text-muted">
              {pct(made, attempted)}
            </td>
          </tr>
        ))}
      </DataTable>
      <p className="text-sm tabular-nums text-muted">
        Points {line.points} · Assisted{" "}
        {line.fgm === 0
          ? "—"
          : `${Math.round((line.assistedFgm / line.fgm) * 100)}%`}
      </p>
    </div>
  );
}

function ShotChart(props: {
  team: WatchTeam;
  side: WatchSide;
  line: ShotLine;
  shots: CourtShot[];
  color: string;
}) {
  const { team, side, line, shots, color } = props;
  return (
    <div className="space-y-2">
      <SectionHeading
        as="h3"
        size="sm"
        title={
          <>
            {team.abbreviation}
            <span className="sr-only"> {team.name}</span>
          </>
        }
      />
      <div className="grid items-start gap-4 sm:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <svg
          viewBox="0 0 50 47"
          role="img"
          aria-label={`${team.abbreviation} shot chart: ${line.fgm} of ${line.fga} field goals made`}
          className="aspect-[50/47] w-full max-w-[18rem] rounded-lg border border-line bg-surface-base text-disabled"
        >
          <HalfCourtLines orientation="basket-top" />
          {shots.map((shot) =>
            shot.made ? (
              <circle
                key={`chart-shot-${shot.index}`}
                data-testid="shot-made"
                data-side={side}
                aria-hidden="true"
                cx={shot.at.x * 50}
                cy={shot.at.y * 47}
                r={0.9}
                fill={color}
                stroke="#f4f4f5"
                strokeWidth={0.3}
              />
            ) : (
              <circle
                key={`chart-shot-${shot.index}`}
                data-testid="shot-missed"
                data-side={side}
                aria-hidden="true"
                cx={shot.at.x * 50}
                cy={shot.at.y * 47}
                r={0.9}
                fill="none"
                stroke={color}
                strokeWidth={0.4}
              />
            ),
          )}
        </svg>
        <TeamShotCard team={team} line={line} />
      </div>
    </div>
  );
}

export function ShotSummaryPanel(props: {
  view: WatchGameView;
  summary: ShotSummary;
  revealed: number;
}) {
  const { view, summary, revealed } = props;
  const shots = useMemo(
    () => buildCourtFrame(view, revealed).shots,
    [view, revealed],
  );
  const colorOf = teamTokenColor(view.home, view.away);

  return (
    <Section title="Shot summary">
      {shots.length === 0 ? (
        <p className="text-sm text-faint">No shots yet.</p>
      ) : (
        <>
          <p className="text-sm text-faint">
            Shot spots are illustrative — the simulation records shot types, not
            locations.
          </p>
          <p className="text-sm text-muted">
            <span aria-hidden="true">●</span> made{" "}
            <span aria-hidden="true">○</span> missed
          </p>
          <div className="space-y-6">
            <ShotChart
              team={view.away}
              side={1}
              line={summary.away.total}
              shots={shots.filter((s) => s.side === 1)}
              color={colorOf(1)}
            />
            <ShotChart
              team={view.home}
              side={0}
              line={summary.home.total}
              shots={shots.filter((s) => s.side === 0)}
              color={colorOf(0)}
            />
          </div>
        </>
      )}
    </Section>
  );
}
