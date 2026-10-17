import Link from "next/link";
import { ScoreBug, type ScoreBugTeam } from "@/components/ui/ScoreBug";
import { cn, focusRingClass } from "@/components/ui/styles";
import { formatGameDate } from "@/presentation/game-date";
import type { TeamRecentHistoryItem } from "@/state/team-recent-history-selectors";

export type RecentHistoryItemProps = {
  saveId: string;
  item: TeamRecentHistoryItem;
  /** The team whose history this is (for the score bug). */
  team: Pick<ScoreBugTeam, "abbreviation" | "branding">;
};

export function RecentHistoryItem(props: RecentHistoryItemProps) {
  const { saveId, item } = props;

  if (item.kind === "game_result" && item.game) {
    const game = item.game;
    return (
      <li>
        <ScoreBug
          teams={
            game.home
              ? [
                  {
                    abbreviation: game.opponentAbbreviation,
                    branding: game.opponentBranding,
                    score: game.opponentScore,
                  },
                  { ...props.team, score: game.teamScore },
                ]
              : [
                  { ...props.team, score: game.teamScore },
                  {
                    abbreviation: game.opponentAbbreviation,
                    branding: game.opponentBranding,
                    score: game.opponentScore,
                  },
                ]
          }
          date={game.date}
          href={`/dashboard/${saveId}/games/${game.gameId}`}
        />
        {game.canWatch ? (
          <Link
            href={`/dashboard/${saveId}/games/${game.gameId}/watch`}
            className={cn(
              "inline-flex min-h-11 items-center px-1 text-sm text-team-ink underline-offset-4 hover:underline",
              focusRingClass,
            )}
          >
            Watch
          </Link>
        ) : null}
      </li>
    );
  }

  return (
    <li className="rounded-lg border border-zinc-800 px-3 py-2 text-sm">
      <p className="text-sm text-zinc-500">
        {formatGameDate(item.occurredOn)} · {item.categoryLabel}
      </p>
      <p className="mt-0.5 min-w-0 truncate text-zinc-200">{item.title}</p>
      {item.description ? (
        <p className="mt-0.5 text-sm text-zinc-500">{item.description}</p>
      ) : null}
    </li>
  );
}
