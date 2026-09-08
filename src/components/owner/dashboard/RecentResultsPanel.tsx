import { GameRow } from "@/components/basketball/GameRow";
import { EmptyState } from "@/components/owner/EmptyState";
import { Section } from "@/components/owner/Section";
import type { RecentFormGame } from "@/state/recent-form-selectors";

export function RecentResultsPanel(props: {
  saveId: string;
  games: RecentFormGame[];
}) {
  return (
    <Section title="Recent Results">
      {props.games.length === 0 ? (
        <EmptyState message="No completed games yet this season." />
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
                opponentTeamId={game.opponentTeamId || undefined}
                opponentBranding={game.opponentBranding}
                teamScore={game.teamScore}
                opponentScore={game.opponentScore}
                won={game.won}
                canOpenResult
              />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
