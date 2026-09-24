import { GameRow } from "@/components/basketball/GameRow";
import type { TeamRecentHistoryItem } from "@/state/team-recent-history-selectors";

export function RecentHistoryItem(props: {
  saveId: string;
  item: TeamRecentHistoryItem;
}) {
  const { saveId, item } = props;

  if (item.kind === "game_result" && item.game) {
    const game = item.game;
    return (
      <li>
        <GameRow
          saveId={saveId}
          gameId={game.gameId}
          date={game.date}
          home={game.home}
          opponentAbbreviation={game.opponentAbbreviation}
          opponentTeamId={game.opponentTeamId || undefined}
          opponentBranding={game.opponentBranding}
          teamScore={game.teamScore}
          opponentScore={game.opponentScore}
          won={game.won}
          canOpenResult
        />
      </li>
    );
  }

  return (
    <li className="rounded-lg border border-zinc-800 px-3 py-2 text-sm">
      <p className="font-mono text-[0.65rem] uppercase text-zinc-500">
        {item.occurredOn} · {item.categoryLabel}
      </p>
      <p className="mt-0.5 min-w-0 truncate text-zinc-200">{item.title}</p>
      {item.description ? (
        <p className="mt-0.5 text-xs text-zinc-500">{item.description}</p>
      ) : null}
    </li>
  );
}
