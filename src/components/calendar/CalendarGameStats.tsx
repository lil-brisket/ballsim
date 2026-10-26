import Link from "next/link";
import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { cn, focusRingClass } from "@/components/ui/styles";
import type { CalendarGameStatsView } from "@/state/selectors/calendar-game-stats";

const footerLinkClass = cn(
  "inline-flex min-h-11 items-center text-sm font-medium text-team-ink hover:underline",
  focusRingClass,
);

export function CalendarGameStats(props: {
  saveId: string;
  stats: CalendarGameStatsView;
}) {
  const { stats } = props;
  const gameHref = `/dashboard/${props.saveId}/games/${stats.gameId}`;
  const sides = [stats.away, stats.home];
  const comparison: Array<{ label: string; away: string; home: string }> = [
    {
      label: "FG",
      away: stats.away.teamStats.fieldGoals,
      home: stats.home.teamStats.fieldGoals,
    },
    {
      label: "3P",
      away: stats.away.teamStats.threePointers,
      home: stats.home.teamStats.threePointers,
    },
    {
      label: "FT",
      away: stats.away.teamStats.freeThrows,
      home: stats.home.teamStats.freeThrows,
    },
    {
      label: "REB",
      away: String(stats.away.teamStats.rebounds),
      home: String(stats.home.teamStats.rebounds),
    },
    {
      label: "AST",
      away: String(stats.away.teamStats.assists),
      home: String(stats.home.teamStats.assists),
    },
    {
      label: "TOV",
      away: String(stats.away.teamStats.turnovers),
      home: String(stats.home.teamStats.turnovers),
    },
  ];

  return (
    <div
      className="space-y-3 rounded-md border border-surface-line bg-surface-raised px-3 py-3 text-xs text-soft"
      aria-label="Game stats"
    >
      <table className="w-full text-center tabular-nums">
        <caption className="sr-only">Line score</caption>
        <thead>
          <tr className="text-faint">
            <th scope="col" className="text-left font-medium">
              <span className="sr-only">Team</span>
            </th>
            {stats.periods.map((period) => (
              <th key={period.label} scope="col" className="font-medium">
                {period.label}
              </th>
            ))}
            <th scope="col" className="font-medium">
              T
            </th>
          </tr>
        </thead>
        <tbody>
          {sides.map((side) => {
            const key = side === stats.home ? "home" : "away";
            return (
              <tr key={side.teamId}>
                <th scope="row" className="text-left font-semibold text-ink">
                  {side.abbreviation}
                </th>
                {stats.periods.map((period) => (
                  <td key={period.label}>{period[key]}</td>
                ))}
                <td className="font-bold text-ink">{side.score}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <dl className="space-y-1">
        {comparison.map((row) => (
          <div
            key={row.label}
            className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 tabular-nums"
          >
            <dd className="text-left text-ink">{row.away}</dd>
            <dt className="text-faint">{row.label}</dt>
            <dd className="text-right text-ink">{row.home}</dd>
          </div>
        ))}
      </dl>

      <div className="space-y-2">
        <h5 className="font-medium text-muted">Top performers</h5>
        {sides.map((side) => (
          <div key={side.teamId} className="space-y-1">
            <p className="font-semibold text-ink">{side.abbreviation}</p>
            <ul className="space-y-0.5">
              {side.topPerformers.map((player) => (
                <li
                  key={player.playerId}
                  className="flex flex-wrap items-baseline justify-between gap-x-2"
                >
                  <PlayerEntityLink
                    saveId={props.saveId}
                    playerId={player.playerId}
                  >
                    {player.playerName}
                  </PlayerEntityLink>
                  <span className="text-muted">
                    {player.points} PTS · {player.rebounds} REB ·{" "}
                    {player.assists} AST
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-x-4">
        <Link href={gameHref} className={footerLinkClass}>
          Full box score
        </Link>
        {stats.canWatch ? (
          <Link href={`${gameHref}/watch`} className={footerLinkClass}>
            Watch replay
          </Link>
        ) : null}
      </div>
    </div>
  );
}
