import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { ScoreBug, type ScoreBugTeam } from "@/components/ui/ScoreBug";
import { Section } from "@/components/ui/Section";
import { cn, focusRingClass } from "@/components/ui/styles";
import type { RecentFormGame } from "@/state/recent-form-selectors";

/** Horizontal strip of final-score bugs, newest first. */
export function RecentResultsPanel(props: {
  saveId: string;
  games: RecentFormGame[];
  team: Pick<ScoreBugTeam, "abbreviation" | "branding">;
}) {
  return (
    <Section title="Recent Results">
      {props.games.length === 0 ? (
        <EmptyState message="No completed games yet this season." />
      ) : (
        <ul className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]">
          {props.games.map((game, index) => {
            const mine: ScoreBugTeam = {
              ...props.team,
              score: game.teamScore,
            };
            const theirs: ScoreBugTeam = {
              abbreviation: game.opponentAbbreviation,
              branding: game.opponentBranding,
              score: game.opponentScore,
            };
            return (
              <li
                key={game.gameId}
                className="enter-up w-48 shrink-0 snap-start"
                style={{ "--i": index } as React.CSSProperties}
              >
                <ScoreBug
                  teams={game.home ? [theirs, mine] : [mine, theirs]}
                  date={game.date}
                  href={`/dashboard/${props.saveId}/games/${game.gameId}`}
                />
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
            );
          })}
        </ul>
      )}
    </Section>
  );
}
