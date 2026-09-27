import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { Section } from "@/components/owner/Section";
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
      <p className="mb-2 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-zinc-500">
        Min {view.minGames} games
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {view.cards.map((card) => (
          <div
            key={card.key}
            className={cn(panelClass, "px-3 py-2")}
            data-testid={`standings-leader-${card.key}`}
          >
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-zinc-500">
              {card.label}
            </p>
            {card.leader ? (
              <>
                <p className="mt-1 truncate text-sm font-medium text-zinc-100">
                  <PlayerEntityLink
                    saveId={props.saveId}
                    playerId={card.leader.playerId}
                    className="hover:text-amber-400"
                  >
                    {`${card.leader.firstName} ${card.leader.lastName}`.trim()}
                  </PlayerEntityLink>
                </p>
                <p className="font-mono text-lg text-zinc-50">
                  {formatLeaderValue(card.key, card.leader.value)}
                  {card.leader.teamAbbreviation ? (
                    <span className="ml-2 text-xs text-zinc-500">
                      {card.leader.teamAbbreviation}
                    </span>
                  ) : null}
                </p>
              </>
            ) : (
              <>
                <p className="mt-1 text-sm text-zinc-500">—</p>
                <p className="font-mono text-lg text-zinc-600">—</p>
              </>
            )}
          </div>
        ))}
      </div>
      {view.allEmpty ? (
        <p className="mt-2 text-xs text-zinc-500">No qualified players yet.</p>
      ) : null}
    </Section>
  );
}
