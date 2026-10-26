import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { Section } from "@/components/ui/Section";
import { cn, panelClass } from "@/components/ui/styles";
import type { LeagueLeadersView } from "@/state/league-leaders-selectors";

function formatLeaderValue(key: string, value: number): string {
  if (key === "fgPct") {
    return `${value.toFixed(1)}%`;
  }
  return value.toFixed(1);
}

export function LeagueLeaders(props: {
  saveId: string;
  view: LeagueLeadersView;
}) {
  const { view } = props;

  return (
    <Section title="League Leaders" density="compact" className="mb-4">
      <p className="mb-2 text-sm text-muted">Min {view.minGames} games</p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {view.cards.map((card) => (
          <div
            key={card.key}
            className={cn(panelClass, "px-3 py-2")}
            data-testid={`standings-leader-${card.key}`}
          >
            <p className="text-sm text-muted">{card.label}</p>
            {card.leader ? (
              <>
                <p className="mt-1 truncate text-sm font-medium text-ink">
                  <PlayerEntityLink
                    saveId={props.saveId}
                    playerId={card.leader.playerId}
                    className="hover:text-team-ink"
                  >
                    {`${card.leader.firstName} ${card.leader.lastName}`.trim()}
                  </PlayerEntityLink>
                </p>
                <p className="font-mono text-lg text-ink">
                  {formatLeaderValue(card.key, card.leader.value)}
                  {card.leader.teamAbbreviation ? (
                    <span className="ml-2 text-sm text-faint">
                      {card.leader.teamAbbreviation}
                    </span>
                  ) : null}
                </p>
              </>
            ) : (
              <>
                <p className="mt-1 text-sm text-faint">—</p>
                <p className="font-mono text-lg text-disabled">—</p>
              </>
            )}
          </div>
        ))}
      </div>
      {view.allEmpty ? (
        <p className="mt-2 text-sm text-faint">No qualified players yet.</p>
      ) : null}
    </Section>
  );
}
