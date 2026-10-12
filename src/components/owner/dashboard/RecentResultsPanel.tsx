import { GameResultLink } from "@/components/owner/GameResultLink";
import { EmptyState } from "@/components/owner/EmptyState";
import { Section } from "@/components/owner/Section";
import { TeamBadge } from "@/components/ui/TeamBadge";
import { cn, focusRingClass } from "@/components/ui/styles";
import type { RecentFormGame } from "@/state/recent-form-selectors";

function shortDate(isoDate: string): string {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const month = months[Number(isoDate.slice(5, 7)) - 1] ?? "";
  return `${month} ${Number(isoDate.slice(8, 10))}`;
}

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
                <span className="flex items-center justify-between font-mono text-[0.65rem] uppercase tracking-[0.14em] text-zinc-400">
                  <span>{shortDate(game.date)}</span>
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
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
