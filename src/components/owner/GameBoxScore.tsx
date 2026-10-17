import type { GameBoxScoreView } from "@/state/selectors";
import type { TeamBrandingView } from "@/state/team-branding-view";
import { DataTable } from "@/components/ui/DataTable";
import { Section } from "@/components/ui/Section";
import { ArenaPanel } from "@/components/ui/ArenaPanel";
import { ScoreNumeral } from "@/components/ui/ScoreNumeral";
import { TeamBadge } from "@/components/ui/TeamBadge";
import { formatGameDate } from "@/presentation/game-date";

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
  winner: boolean;
  align?: "left" | "right";
}) {
  const alignRight = props.align === "right";
  return (
    <div
      className={`flex items-center gap-4 ${
        alignRight ? "sm:flex-row-reverse sm:text-right" : ""
      }`}
    >
      <TeamBadge
        branding={props.branding}
        name={`${props.city} ${props.name}`}
        size="xl"
        decorative
      />
      <div className="min-w-0">
        <p className="text-sm text-zinc-400">
          {props.label} · {props.abbreviation}
        </p>
        <p className="font-display text-2xl font-bold uppercase leading-tight tracking-wide text-zinc-50">
          {props.city} {props.name}
        </p>
        <ScoreNumeral
          value={props.score}
          size="xl"
          tone={props.winner ? "team" : "muted"}
          align={alignRight ? "end" : "start"}
          className="mt-1"
        />
      </div>
    </div>
  );
}

function periodLabel(index: number): string {
  return index < 4 ? `Q${index + 1}` : `OT${index - 3}`;
}

type SideView = GameBoxScoreView["home"];

function topPerformers(side: SideView) {
  return [...side.players].sort((a, b) => b.points - a.points).slice(0, 2);
}

export function GameBoxScore({ boxScore }: GameBoxScoreProps) {
  const { away, home } = boxScore;
  const metaParts = [
    formatGameDate(boxScore.date, { year: true }),
    boxScore.competitionTypeLabel,
    boxScore.seasonGameNumber != null
      ? `Game ${boxScore.seasonGameNumber}`
      : null,
  ].filter(Boolean);

  return (
    <div className="space-y-8">
      <ArenaPanel
        as="header"
        hero
        glow
        density="comfortable"
        aria-labelledby="game-final-title"
      >
        <p
          id="game-final-title"
          className="mb-4 text-center font-display text-lg font-bold uppercase tracking-[0.4em] text-team-ink"
        >
          Final
        </p>
        <div className="grid gap-6 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <MatchupTeamBlock
            label="Away"
            city={away.city}
            name={away.name}
            abbreviation={away.abbreviation}
            score={away.score}
            branding={away.branding}
            winner={boxScore.winner === "away"}
          />
          <div
            aria-hidden
            className="hidden font-display text-3xl text-zinc-500 sm:block"
          >
            –
          </div>
          <MatchupTeamBlock
            label="Home"
            city={home.city}
            name={home.name}
            abbreviation={home.abbreviation}
            score={home.score}
            branding={home.branding}
            winner={boxScore.winner === "home"}
            align="right"
          />
        </div>
        <p className="mt-5 text-sm font-medium text-team-ink">
          {boxScore.winnerName} wins by {boxScore.margin}
        </p>
        <p className="mt-1 text-sm text-zinc-300">{metaParts.join(" · ")}</p>
      </ArenaPanel>

      {boxScore.periods.length > 0 ? (
        <Section title="Scoring by period">
          <DataTable
            headers={[
              "Team",
              ...boxScore.periods.map((_, index) => periodLabel(index)),
              "Total",
            ]}
          >
            {(
              [
                [away, "away"],
                [home, "home"],
              ] as const
            ).map(([side, key]) => (
              <tr key={key} className="border-t border-zinc-800">
                <td className="px-3 py-2 font-display text-lg font-bold uppercase tracking-wide text-zinc-100">
                  {side.abbreviation}
                </td>
                {boxScore.periods.map((period, index) => (
                  <td
                    key={periodLabel(index)}
                    className="px-3 py-2 font-mono tabular-nums text-zinc-300"
                  >
                    {period[key]}
                  </td>
                ))}
                <td
                  className={`px-3 py-2 font-display text-xl font-extrabold tabular-nums ${
                    boxScore.winner === key ? "text-team-ink" : "text-zinc-400"
                  }`}
                >
                  {side.score}
                </td>
              </tr>
            ))}
          </DataTable>
        </Section>
      ) : null}

      <Section title="Top performers">
        <ul className="grid gap-3 sm:grid-cols-2">
          {([away, home] as const).flatMap((side) =>
            topPerformers(side).map((player) => (
              <li key={player.playerId}>
                <ArenaPanel as="div" raised density="compact" edge="left">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-zinc-400">
                        {side.abbreviation}
                      </p>
                      <p className="truncate font-display text-xl font-bold uppercase tracking-wide text-zinc-50">
                        {player.playerName}
                      </p>
                      <p className="font-mono text-sm text-zinc-300">
                        {player.rebounds} REB · {player.assists} AST ·{" "}
                        {player.minutes} MIN
                      </p>
                    </div>
                    <ScoreNumeral
                      value={player.points}
                      label="PTS"
                      labelBelow
                      size="lg"
                      tone="team"
                      align="end"
                      className="shrink-0"
                    />
                  </div>
                </ArenaPanel>
              </li>
            )),
          )}
        </ul>
      </Section>

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
