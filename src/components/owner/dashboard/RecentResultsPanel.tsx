import Link from "next/link";
import { GameResultLink } from "@/components/owner/GameResultLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { Section } from "@/components/ui/Section";
import { TeamBadge } from "@/components/ui/TeamBadge";
import { formatGameDate } from "@/presentation/game-date";
import { cn, focusRingClass } from "@/components/ui/styles";
import type { RecentFormGame } from "@/state/recent-form-selectors";

/** Horizontal ticker of W/L result chips, newest first. */
export function RecentResultsPanel(props: {
  saveId: string;
  games: RecentFormGame[];
}) {
  return (
    <Section title="Recent Results">
      {props.games.length === 0 ? (
        <EmptyState message="No completed games yet this season." />
      ) : (
        <ul className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]">
          {props.games.map((game, index) => (
            <li
              key={game.gameId}
              className="enter-up shrink-0 snap-start"
              style={{ "--i": index } as React.CSSProperties}
            >
              <GameResultLink
                saveId={props.saveId}
                gameId={game.gameId}
                canOpen
                className={cn(
                  "hover-lift flex min-h-11 w-44 flex-col gap-2 rounded-xl border border-surface-line border-t-4 bg-surface-arena p-3",
                  game.won ? "border-t-win" : "border-t-loss",
                  focusRingClass,
                )}
              >
                <span className="flex items-center justify-between text-sm text-zinc-400">
                  <span>{formatGameDate(game.date)}</span>
                  <span>{game.home ? "Home" : "Away"}</span>
                </span>
                <span className="flex items-center gap-2">
                  <TeamBadge
                    branding={game.opponentBranding}
                    name={game.opponentAbbreviation}
                    size="sm"
                    decorative
                  />
                  <span className="font-display text-xl font-bold uppercase tracking-wide text-zinc-50">
                    {game.home ? "vs" : "@"} {game.opponentAbbreviation}
                  </span>
                </span>
                <span
                  className={cn(
                    "font-display text-2xl font-extrabold tabular-nums",
                    game.won ? "text-win" : "text-loss",
                  )}
                >
                  {game.won ? "W" : "L"} {game.teamScore}–{game.opponentScore}
                </span>
              </GameResultLink>
              {game.canWatch ? (
                <Link
                  href={`/dashboard/${props.saveId}/games/${game.gameId}/watch`}
                  className={cn(
                    "mt-1 inline-flex min-h-11 items-center px-1 text-sm text-team-ink hover:underline underline-offset-4",
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
