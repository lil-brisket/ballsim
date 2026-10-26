import Link from "next/link";
import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { TeamEntityLink } from "@/components/entity/TeamEntityLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { ScoreBug } from "@/components/ui/ScoreBug";
import { Section } from "@/components/ui/Section";
import type {
  LeagueGameResultRow,
  LeagueTransactionBrief,
} from "@/state/league-hub-selectors";
import type { LeagueInjuryRow } from "@/state/league-injury-selectors";
import { cn, focusRingClass } from "@/components/ui/styles";
import { formatGameDate } from "@/presentation/game-date";

export function LeagueRecentResultsPanel(props: {
  saveId: string;
  games: LeagueGameResultRow[];
}) {
  return (
    <Section title="Recent Results">
      {props.games.length === 0 ? (
        <EmptyState message="No completed games yet this season." />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {props.games.map((game) => (
            <li key={game.gameId}>
              <ScoreBug
                teams={[
                  {
                    abbreviation: game.awayAbbreviation,
                    branding: game.awayBranding,
                    score: game.awayScore,
                  },
                  {
                    abbreviation: game.homeAbbreviation,
                    branding: game.homeBranding,
                    score: game.homeScore,
                  },
                ]}
                date={game.date}
                href={`/dashboard/${props.saveId}/games/${game.gameId}`}
              />
              {game.canWatch ? (
                <Link
                  href={`/dashboard/${props.saveId}/games/${game.gameId}/watch`}
                  className={cn(
                    "inline-flex min-h-11 items-center px-1 text-sm text-team-ink underline-offset-4 hover:underline",
                    focusRingClass,
                  )}
                >
                  Watch
                </Link>
              ) : null}
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
  const href = `/dashboard/${props.saveId}/league/transactions`;
  return (
    <Section
      title="Transactions"
      action={
        <Link
          href={href}
          className={cn(
            "text-sm text-team-ink underline-offset-4 hover:underline",
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
              className="rounded-lg border border-line px-3 py-2 text-sm"
            >
              <p className="text-sm text-faint">
                {formatGameDate(row.occurredOn)} · {row.type}
              </p>
              <p className="mt-0.5 text-ink">{row.description}</p>
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
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <PlayerEntityLink
                  saveId={props.saveId}
                  playerId={row.playerId}
                  className={cn("text-ink hover:text-team-ink", focusRingClass)}
                >
                  {row.playerName}
                </PlayerEntityLink>
                {row.teamId && row.teamAbbreviation ? (
                  <span className="ml-2 text-faint">
                    <TeamEntityLink
                      saveId={props.saveId}
                      teamId={row.teamId}
                      className={cn(
                        "text-muted hover:text-team-ink",
                        focusRingClass,
                      )}
                    >
                      {row.teamAbbreviation}
                    </TeamEntityLink>
                  </span>
                ) : null}
              </div>
              <span className="text-sm text-faint">
                {row.severity} · {row.bodyPart}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
