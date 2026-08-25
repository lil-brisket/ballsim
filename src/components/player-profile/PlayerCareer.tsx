import Link from "next/link";
import { DataTable } from "@/components/owner/DataTable";
import { EmptyState } from "@/components/owner/EmptyState";
import { Section } from "@/components/owner/Section";
import type { PlayerProfileView } from "@/state/player-profile-selectors";

const HIGH_LABELS: Record<string, string> = {
  points: "Points",
  rebounds: "Rebounds",
  assists: "Assists",
  steals: "Steals",
  blocks: "Blocks",
  threeMade: "3PM",
  minutes: "Minutes",
  fgMade: "FGM",
  fgAttempted: "FGA",
  ftMade: "FTM",
  threeAttempted: "3PA",
};

export function PlayerCareer(props: {
  player: PlayerProfileView;
  saveId: string;
}) {
  const { player } = props;

  if (
    player.seasonHistory.length === 0 &&
    player.teamStints.length === 0 &&
    player.careerHighs.length === 0
  ) {
    return (
      <Section title="Career">
        <EmptyState
          message={
            player.trackingStartedSeasonYear
              ? `Historical tracking began in ${player.trackingStartedSeasonYear}. Career and trend data will accumulate as future seasons are completed.`
              : "Historical tracking began this season. Career and trend data will accumulate as future seasons are completed."
          }
        />
      </Section>
    );
  }

  const tenureBlocks = buildTenureBlocks(player);

  return (
    <div className="space-y-8">
      <Section title="Team history">
        {tenureBlocks.length === 0 ? (
          <EmptyState message="No team stints derived from game history yet." />
        ) : (
          <ul className="space-y-2">
            {tenureBlocks.map((block) => (
              <li
                key={`${block.start}-${block.end}-${block.team}`}
                className="rounded-lg border border-zinc-800 px-4 py-3 text-sm"
              >
                <span className="font-mono text-amber-400">
                  {block.start === block.end
                    ? String(block.start)
                    : `${block.start}–${block.end}`}
                </span>
                <span className="ml-3 text-zinc-100">{block.team}</span>
                <span className="ml-2 text-zinc-500">
                  ({block.games} GP)
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Best seasons">
        {player.bestSeasons.length === 0 ? (
          <EmptyState message="Not enough season data for best-season marks." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {player.bestSeasons.map((best) => (
              <div
                key={best.kind}
                className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3"
              >
                <p className="text-xs text-zinc-500">{best.label}</p>
                <p className="mt-1 text-lg text-zinc-100">{best.valueLabel}</p>
                <p className="text-sm text-zinc-400">{best.seasonYear}</p>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Career highs">
        {player.careerHighs.length === 0 ? (
          <EmptyState message="No career highs yet." />
        ) : (
          <DataTable headers={["Stat", "Value", "Context", "Game"]}>
            {player.careerHighs.map((high) => (
              <tr key={high.stat} className="border-t border-zinc-800">
                <td className="px-3 py-2 text-zinc-100">
                  {HIGH_LABELS[high.stat] ?? high.stat}
                </td>
                <td className="px-3 py-2 font-mono text-amber-400">
                  {high.value}
                </td>
                <td className="px-3 py-2 text-sm text-zinc-400">
                  vs {high.opponentAbbreviation} · {high.date} ·{" "}
                  {high.seasonYear}
                </td>
                <td className="px-3 py-2">
                  <Link
                    href={`/dashboard/${props.saveId}/games/${high.gameId}`}
                    className="text-amber-400 hover:underline"
                  >
                    Box score
                  </Link>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </Section>

      <Section title="Season snapshots">
        {player.seasonHistory.length === 0 ? (
          <EmptyState message="No completed season snapshots yet." />
        ) : (
          <ul className="space-y-2">
            {player.seasonHistory.map((season) => (
              <li
                key={season.seasonId}
                className="rounded-lg border border-zinc-800 px-4 py-3 text-sm"
              >
                <span className="font-mono text-amber-400">
                  {season.seasonYear}
                </span>
                <span className="ml-3 text-zinc-100">
                  Age {season.age} · OVR {season.overall} ·{" "}
                  {season.developmentStage} · {season.injuryKind}
                </span>
                <span className="ml-2 text-zinc-500">
                  {season.competition.combined.games} GP
                  {season.competition.combined.games === 0
                    ? " — did not appear"
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function buildTenureBlocks(player: PlayerProfileView): Array<{
  start: number;
  end: number;
  team: string;
  games: number;
}> {
  if (player.teamStints.length === 0) return [];

  // Group consecutive seasons with same team (mid-season multi-team stays separate per season)
  const bySeason = new Map<number, typeof player.teamStints>();
  for (const stint of player.teamStints) {
    const list = bySeason.get(stint.seasonYear) ?? [];
    list.push(stint);
    bySeason.set(stint.seasonYear, list);
  }

  const blocks: Array<{
    start: number;
    end: number;
    team: string;
    games: number;
  }> = [];

  for (const year of [...bySeason.keys()].sort((a, b) => a - b)) {
    const stints = bySeason.get(year)!;
    for (const stint of stints) {
      const team = `${stint.teamCity} ${stint.teamName}`;
      const last = blocks[blocks.length - 1];
      if (
        last &&
        last.team === team &&
        last.end === year - 1 &&
        stints.length === 1
      ) {
        last.end = year;
        last.games += stint.games;
      } else {
        blocks.push({
          start: year,
          end: year,
          team,
          games: stint.games,
        });
      }
    }
  }

  return blocks;
}
