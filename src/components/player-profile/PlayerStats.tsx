import { DataTable } from "@/components/owner/DataTable";
import { EmptyState } from "@/components/owner/EmptyState";
import { Section } from "@/components/owner/Section";
import type {
  PlayerProfileView,
  SeasonAveragesView,
} from "@/state/player-profile-selectors";
import type { PlayerSeasonStatLine } from "@/domain/entities/player-history";

function TotalsGrid(props: { line: PlayerSeasonStatLine; title: string }) {
  const { line } = props;
  if (line.games === 0) {
    return <EmptyState message={`No ${props.title.toLowerCase()} games.`} />;
  }
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
      <Cell label="GP" value={String(line.games)} />
      <Cell label="MIN" value={String(line.minutes)} />
      <Cell label="PTS" value={String(line.points)} />
      <Cell label="REB" value={String(line.rebounds)} />
      <Cell label="AST" value={String(line.assists)} />
      <Cell label="STL" value={String(line.steals)} />
      <Cell label="BLK" value={String(line.blocks)} />
      <Cell label="TO" value={String(line.turnovers)} />
      <Cell
        label="FG"
        value={`${line.fgMade}/${line.fgAttempted}`}
      />
      <Cell
        label="3PT"
        value={`${line.threeMade}/${line.threeAttempted}`}
      />
      <Cell
        label="FT"
        value={`${line.ftMade}/${line.ftAttempted}`}
      />
    </div>
  );
}

function AveragesGrid(props: { avg: SeasonAveragesView }) {
  const { avg } = props;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
      <Cell label="GP" value={String(avg.games)} />
      <Cell label="MPG" value={avg.mpg.toFixed(1)} />
      <Cell label="PPG" value={avg.ppg.toFixed(1)} />
      <Cell label="RPG" value={avg.rpg.toFixed(1)} />
      <Cell label="APG" value={avg.apg.toFixed(1)} />
      <Cell label="SPG" value={avg.spg.toFixed(1)} />
      <Cell label="BPG" value={avg.bpg.toFixed(1)} />
      <Cell label="TOPG" value={avg.topg.toFixed(1)} />
      <Cell label="FG%" value={avg.fgPct !== null ? `${avg.fgPct}%` : "—"} />
      <Cell
        label="3P%"
        value={avg.threePct !== null ? `${avg.threePct}%` : "—"}
      />
      <Cell label="FT%" value={avg.ftPct !== null ? `${avg.ftPct}%` : "—"} />
    </div>
  );
}

function Cell(props: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 px-3 py-2">
      <p className="text-[10px] uppercase text-zinc-500">{props.label}</p>
      <p className="font-mono text-sm text-zinc-100">{props.value}</p>
    </div>
  );
}

export function PlayerStats(props: { player: PlayerProfileView }) {
  const { player } = props;

  return (
    <div className="space-y-8">
      <Section title="Current season — per game">
        {player.seasonAverages ? (
          <AveragesGrid avg={player.seasonAverages} />
        ) : (
          <EmptyState message="No games played this season." />
        )}
      </Section>

      <Section title="Current season — totals">
        <TotalsGrid line={player.seasonStatLine} title="Season" />
      </Section>

      {player.playoffStatLine.games > 0 ? (
        <Section title="Current season — playoffs (totals)">
          <TotalsGrid line={player.playoffStatLine} title="Playoff" />
        </Section>
      ) : null}

      <Section title="Season history">
        {player.seasonHistory.length === 0 &&
        player.seasonStatLine.games === 0 ? (
          <EmptyState message="Historical tracking began this season. Season history will accumulate as seasons are completed." />
        ) : (
          <DataTable
            headers={[
              "Season",
              "Age",
              "OVR",
              "GP",
              "MPG",
              "PPG",
              "RPG",
              "APG",
              "FG%",
              "3P%",
              "FT%",
            ]}
          >
            {player.seasonHistory.map((season) => {
              const line = season.competition.combined;
              const g = line.games;
              return (
                <tr key={season.seasonId} className="border-t border-zinc-800">
                  <td className="px-3 py-2 text-zinc-100">{season.seasonYear}</td>
                  <td className="px-3 py-2 text-zinc-400">{season.age}</td>
                  <td className="px-3 py-2 font-mono text-zinc-100">
                    {season.overall}
                  </td>
                  <td className="px-3 py-2 font-mono text-zinc-400">{g}</td>
                  <td className="px-3 py-2 font-mono text-zinc-400">
                    {g > 0 ? (line.minutes / g).toFixed(1) : "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-zinc-400">
                    {g > 0 ? (line.points / g).toFixed(1) : "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-zinc-400">
                    {g > 0 ? (line.rebounds / g).toFixed(1) : "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-zinc-400">
                    {g > 0 ? (line.assists / g).toFixed(1) : "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-zinc-400">
                    {line.fgAttempted > 0
                      ? `${((line.fgMade / line.fgAttempted) * 100).toFixed(1)}%`
                      : "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-zinc-400">
                    {line.threeAttempted > 0
                      ? `${((line.threeMade / line.threeAttempted) * 100).toFixed(1)}%`
                      : "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-zinc-400">
                    {line.ftAttempted > 0
                      ? `${((line.ftMade / line.ftAttempted) * 100).toFixed(1)}%`
                      : "—"}
                  </td>
                </tr>
              );
            })}
            {player.seasonStatLine.games > 0 ? (
              <tr className="border-t border-zinc-800 bg-zinc-900/40">
                <td className="px-3 py-2 text-amber-400">
                  {player.currentSeasonYear} *
                </td>
                <td className="px-3 py-2 text-zinc-400">{player.age}</td>
                <td className="px-3 py-2 font-mono text-zinc-100">
                  {player.overall}
                </td>
                <td className="px-3 py-2 font-mono text-zinc-400">
                  {player.seasonAverages?.games ?? 0}
                </td>
                <td className="px-3 py-2 font-mono text-zinc-400">
                  {player.seasonAverages?.mpg.toFixed(1) ?? "—"}
                </td>
                <td className="px-3 py-2 font-mono text-zinc-400">
                  {player.seasonAverages?.ppg.toFixed(1) ?? "—"}
                </td>
                <td className="px-3 py-2 font-mono text-zinc-400">
                  {player.seasonAverages?.rpg.toFixed(1) ?? "—"}
                </td>
                <td className="px-3 py-2 font-mono text-zinc-400">
                  {player.seasonAverages?.apg.toFixed(1) ?? "—"}
                </td>
                <td className="px-3 py-2 font-mono text-zinc-400">
                  {player.seasonAverages?.fgPct !== null &&
                  player.seasonAverages?.fgPct !== undefined
                    ? `${player.seasonAverages.fgPct}%`
                    : "—"}
                </td>
                <td className="px-3 py-2 font-mono text-zinc-400">
                  {player.seasonAverages?.threePct !== null &&
                  player.seasonAverages?.threePct !== undefined
                    ? `${player.seasonAverages.threePct}%`
                    : "—"}
                </td>
                <td className="px-3 py-2 font-mono text-zinc-400">
                  {player.seasonAverages?.ftPct !== null &&
                  player.seasonAverages?.ftPct !== undefined
                    ? `${player.seasonAverages.ftPct}%`
                    : "—"}
                </td>
              </tr>
            ) : null}
          </DataTable>
        )}
      </Section>

      <Section title="Career">
        {player.careerAverages ? (
          <div className="space-y-4">
            <AveragesGrid avg={player.careerAverages} />
            <p className="text-xs text-zinc-500">Career averages (regular + playoffs).</p>
            <TotalsGrid line={player.careerTotals} title="Career" />
          </div>
        ) : (
          <EmptyState message="No career statistics available yet." />
        )}
      </Section>
    </div>
  );
}
