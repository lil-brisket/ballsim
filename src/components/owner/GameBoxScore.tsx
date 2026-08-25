import type { GameBoxScoreView } from "@/state/selectors";
import { DataTable } from "@/components/owner/DataTable";
import { Section } from "@/components/owner/Section";

type GameBoxScoreProps = {
  boxScore: GameBoxScoreView;
};

const PLAYER_HEADERS = [
  "Player",
  "MIN",
  "PTS",
  "FG",
  "3PT",
  "FT",
  "REB",
  "AST",
  "TO",
  "PF",
];

export function GameBoxScore({ boxScore }: GameBoxScoreProps) {
  const { away, home } = boxScore;
  const metaParts = [
    boxScore.date,
    boxScore.competitionTypeLabel,
    boxScore.seasonGameNumber != null
      ? `Game ${boxScore.seasonGameNumber}`
      : null,
  ].filter(Boolean);

  return (
    <div className="space-y-8">
      <header className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-6 py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-zinc-500">Away</p>
            <p className="text-lg font-medium text-zinc-100">
              {away.city} {away.name}
            </p>
            <p className="font-mono text-3xl text-zinc-50">{away.score}</p>
          </div>
          <div className="text-center text-zinc-500">—</div>
          <div className="sm:text-right">
            <p className="text-sm text-zinc-500">Home</p>
            <p className="text-lg font-medium text-zinc-100">
              {home.city} {home.name}
            </p>
            <p className="font-mono text-3xl text-zinc-50">{home.score}</p>
          </div>
        </div>
        <p className="mt-4 text-sm text-amber-400/90">
          {boxScore.winnerName} wins by {boxScore.margin}
        </p>
        <p className="mt-1 text-sm text-zinc-500">{metaParts.join(" · ")}</p>
      </header>

      <Section title="Team comparison">
        <DataTable headers={["Statistic", "Away", "Home"]}>
          {(
            [
              ["Points", away.teamStats.points, home.teamStats.points],
              ["FG", away.teamStats.fieldGoals, home.teamStats.fieldGoals],
              [
                "3PT",
                away.teamStats.threePointers,
                home.teamStats.threePointers,
              ],
              ["FT", away.teamStats.freeThrows, home.teamStats.freeThrows],
              ["REB", away.teamStats.rebounds, home.teamStats.rebounds],
              ["AST", away.teamStats.assists, home.teamStats.assists],
              ["TO", away.teamStats.turnovers, home.teamStats.turnovers],
              ["PF", away.teamStats.fouls, home.teamStats.fouls],
            ] as const
          ).map(([label, awayValue, homeValue]) => (
            <tr key={label} className="border-t border-zinc-800">
              <td className="px-3 py-2 text-zinc-400">{label}</td>
              <td className="px-3 py-2 text-right font-mono text-zinc-100">
                {awayValue}
              </td>
              <td className="px-3 py-2 text-right font-mono text-zinc-100">
                {homeValue}
              </td>
            </tr>
          ))}
        </DataTable>
      </Section>

      <Section title={`${away.city} ${away.name}`}>
        <PlayerTable players={away.players} />
      </Section>

      <Section title={`${home.city} ${home.name}`}>
        <PlayerTable players={home.players} />
      </Section>
    </div>
  );
}

function PlayerTable({
  players,
}: {
  players: GameBoxScoreView["home"]["players"];
}) {
  if (players.length === 0) {
    return (
      <p className="text-sm text-zinc-500">No player statistics recorded.</p>
    );
  }
  return (
    <DataTable headers={PLAYER_HEADERS}>
      {players.map((player) => (
        <tr key={player.playerId} className="border-t border-zinc-800">
          <td className="px-3 py-2 text-zinc-100">{player.playerName}</td>
          <td className="px-3 py-2 text-right font-mono text-zinc-300">
            {player.minutes}
          </td>
          <td className="px-3 py-2 text-right font-mono text-zinc-100">
            {player.points}
          </td>
          <td className="px-3 py-2 text-right font-mono text-zinc-300">
            {player.fieldGoals}
          </td>
          <td className="px-3 py-2 text-right font-mono text-zinc-300">
            {player.threePointers}
          </td>
          <td className="px-3 py-2 text-right font-mono text-zinc-300">
            {player.freeThrows}
          </td>
          <td className="px-3 py-2 text-right font-mono text-zinc-300">
            {player.rebounds}
          </td>
          <td className="px-3 py-2 text-right font-mono text-zinc-300">
            {player.assists}
          </td>
          <td className="px-3 py-2 text-right font-mono text-zinc-300">
            {player.turnovers}
          </td>
          <td className="px-3 py-2 text-right font-mono text-zinc-300">
            {player.fouls}
          </td>
        </tr>
      ))}
    </DataTable>
  );
}
