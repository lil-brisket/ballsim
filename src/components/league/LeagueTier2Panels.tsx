import Link from "next/link";
import { LeagueGameRow } from "@/components/basketball/LeagueGameRow";
import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { TeamEntityLink } from "@/components/entity/TeamEntityLink";
import { EmptyState } from "@/components/owner/EmptyState";
import { Section } from "@/components/owner/Section";
import type {
  LeagueGameResultRow,
  LeagueMediaBrief,
  LeagueTransactionBrief,
} from "@/state/league-hub-selectors";
import type { LeagueInjuryRow } from "@/state/league-injury-selectors";
import { cn, focusRingClass } from "@/components/ui/styles";

export function LeagueRecentResultsPanel(props: {
  saveId: string;
  games: LeagueGameResultRow[];
}) {
  return (
    <Section title="Recent Results">
      {props.games.length === 0 ? (
        <EmptyState message="No completed games yet this season." />
      ) : (
        <ul className="space-y-2">
          {props.games.map((game) => (
            <li key={game.gameId}>
              <LeagueGameRow
                saveId={props.saveId}
                gameId={game.gameId}
                date={game.date}
                homeTeamId={game.homeTeamId}
                awayTeamId={game.awayTeamId}
                homeAbbreviation={game.homeAbbreviation}
                awayAbbreviation={game.awayAbbreviation}
                homeBranding={game.homeBranding}
                awayBranding={game.awayBranding}
                homeScore={game.homeScore}
                awayScore={game.awayScore}
                status="final"
                competitionType={game.competitionType}
              />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

export function LeagueTransactionsBriefing(props: {
  saveId: string;
  rows: LeagueTransactionBrief[];
}) {
  const href = `/dashboard/${props.saveId}/transactions`;
  return (
    <Section
      title="Transactions"
      action={
        <Link
          href={href}
          className={cn(
            "text-sm text-amber-400 hover:text-amber-300",
            focusRingClass,
          )}
        >
          View All Transactions
        </Link>
      }
    >
      {props.rows.length === 0 ? (
        <EmptyState message="No recent transactions." />
      ) : (
        <ul className="space-y-2">
          {props.rows.map((row) => (
            <li
              key={row.id}
              className="rounded-lg border border-zinc-800 px-3 py-2 text-sm"
            >
              <p className="font-mono text-[0.65rem] uppercase text-zinc-500">
                {row.occurredOn} · {row.type}
              </p>
              <p className="mt-0.5 text-zinc-200">{row.description}</p>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

export function LeagueInjuriesBriefing(props: {
  saveId: string;
  rows: LeagueInjuryRow[];
}) {
  return (
    <Section title="Injuries">
      {props.rows.length === 0 ? (
        <EmptyState message="No notable injuries around the league." />
      ) : (
        <ul className="space-y-2">
          {props.rows.map((row) => (
            <li
              key={`${row.playerId}-${row.injuredOn}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <PlayerEntityLink
                  saveId={props.saveId}
                  playerId={row.playerId}
                  className={cn(
                    "text-zinc-100 hover:text-amber-400",
                    focusRingClass,
                  )}
                >
                  {row.playerName}
                </PlayerEntityLink>
                {row.teamId && row.teamAbbreviation ? (
                  <span className="ml-2 text-zinc-500">
                    <TeamEntityLink
                      saveId={props.saveId}
                      teamId={row.teamId}
                      className={cn(
                        "text-zinc-400 hover:text-amber-400",
                        focusRingClass,
                      )}
                    >
                      {row.teamAbbreviation}
                    </TeamEntityLink>
                  </span>
                ) : null}
              </div>
              <span className="font-mono text-xs text-zinc-500">
                {row.severity} · {row.bodyPart}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

export function LeagueMediaBriefing(props: {
  saveId: string;
  rows: LeagueMediaBrief[];
}) {
  const href = `/dashboard/${props.saveId}/media`;
  return (
    <Section
      title="Around the League"
      action={
        <Link
          href={href}
          className={cn(
            "text-sm text-amber-400 hover:text-amber-300",
            focusRingClass,
          )}
        >
          Media Hub
        </Link>
      }
    >
      {props.rows.length === 0 ? (
        <EmptyState message="No league stories yet." />
      ) : (
        <ul className="space-y-2">
          {props.rows.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className={cn(
                  "block rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 transition-colors hover:border-zinc-600",
                  focusRingClass,
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-zinc-100">
                    {item.headline}
                  </p>
                  {item.unread ? (
                    <span className="font-mono text-[0.65rem] uppercase text-amber-400">
                      New
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 line-clamp-1 text-xs text-zinc-500">
                  {item.occurredOn} · {item.importance}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
