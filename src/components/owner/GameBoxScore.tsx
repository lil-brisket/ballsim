import type { GameBoxScoreView } from "@/state/selectors";
import type { TeamBrandingView } from "@/state/team-branding-view";
import { DataTable } from "@/components/owner/DataTable";
import { Section } from "@/components/owner/Section";
import { TeamLogoMark } from "@/components/team/logos/TeamLogoMark";

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

function MatchupTeamBlock(props: {
  label: string;
  city: string;
  name: string;
  abbreviation: string;
  score: number;
  branding: TeamBrandingView | null;
  align?: "left" | "right";
}) {
  const alignRight = props.align === "right";
  return (
    <div className={alignRight ? "sm:text-right" : undefined}>
      <p className="text-sm text-zinc-500">{props.label}</p>
      <div
        className={`mt-1 flex items-center gap-3 ${
          alignRight ? "sm:flex-row-reverse" : ""
        }`}
      >
        {props.branding ? (
          <span
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-700"
            style={{ backgroundColor: props.branding.primaryColor }}
          >
            <TeamLogoMark
              branding={props.branding}
              size="lg"
              title={`${props.city} ${props.name}`}
            />
          </span>
        ) : (
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-amber-700/40 bg-amber-950/50 font-mono text-xs font-semibold text-amber-400">
            {props.abbreviation}
          </span>
        )}
        <div>
          <p className="text-lg font-medium text-zinc-100">
            {props.city} {props.name}
          </p>
          <p className="font-mono text-3xl text-zinc-50">{props.score}</p>
        </div>
      </div>
    </div>
  );
}

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
          <MatchupTeamBlock
            label="Away"
            city={away.city}
            name={away.name}
            abbreviation={away.abbreviation}
            score={away.score}
            branding={away.branding}
          />
          <div className="text-center text-zinc-500">—</div>
          <MatchupTeamBlock
            label="Home"
            city={home.city}
            name={home.name}
            abbreviation={home.abbreviation}
            score={home.score}
            branding={home.branding}
            align="right"
          />
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
