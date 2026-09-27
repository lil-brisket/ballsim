import { GameRow } from "@/components/basketball/GameRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { Section } from "@/components/ui/Section";
import type { DlRecentResultView } from "@/state/development-league-selectors";

export const DL_EMPTY_NO_ASSIGNMENTS = "No prospects assigned";
export const DL_EMPTY_SEASON_NOT_STARTED =
  "DL season has not started; assigned prospects will appear here";

export function DlTeamPerformancePanel(props: {
  saveId: string;
  assignedCount: number;
  games: DlRecentResultView[];
}) {
  const emptyMessage =
    props.assignedCount === 0
      ? DL_EMPTY_NO_ASSIGNMENTS
      : DL_EMPTY_SEASON_NOT_STARTED;

  return (
    <Section title="Squad performance">
      {props.games.length === 0 ? (
        <EmptyState message={emptyMessage} />
      ) : (
        <ul className="space-y-2">
          {props.games.map((game) => (
            <li key={game.gameId}>
              <GameRow
                saveId={props.saveId}
                gameId={game.gameId}
                date={game.date}
                home={game.home}
                opponentAbbreviation={game.opponentAbbreviation}
                opponentName={game.opponentName}
                opponentTeamId={game.opponentTeamId}
                opponentBranding={game.opponentBranding}
                teamScore={game.teamScore}
                opponentScore={game.opponentScore}
                won={game.won}
                canOpenResult={false}
              />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
