import { ScoreBug, type ScoreBugTeam } from "@/components/ui/ScoreBug";
import { cn, focusRingClass } from "@/components/ui/styles";
import type { RecentFormGame } from "@/state/recent-form-selectors";

/**
 * One horizontal row of final-score bugs, newest first. Scrolls sideways on
 * phones; the scroller is focusable so keyboard users can reach every bug.
 */
export function RecentResultsPanel(props: {
  saveId: string;
  games: RecentFormGame[];
  team: Pick<ScoreBugTeam, "abbreviation" | "branding">;
}) {
  if (props.games.length === 0) {
    return (
      <p className="text-sm text-muted">No completed games yet this season.</p>
    );
  }
  return (
    <div
      role="region"
      aria-label="Recent results"
      tabIndex={0}
      className={cn(
        "-mx-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        focusRingClass,
      )}
    >
      <ul className="flex snap-x gap-3">
        {props.games.slice(0, 5).map((game) => {
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
              className="w-48 shrink-0 snap-start sm:min-w-44 sm:flex-1"
            >
              <ScoreBug
                teams={game.home ? [theirs, mine] : [mine, theirs]}
                date={game.date}
                className="py-1!"
                href={`/dashboard/${props.saveId}/games/${game.gameId}`}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
