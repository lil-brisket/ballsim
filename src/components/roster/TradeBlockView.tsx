import type { TradeBlockView } from "@/state/roster-page-selectors";
import { toggleTradeBlockAction } from "@/application/actions";
import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { EmptyState } from "@/components/owner/EmptyState";
import { Section } from "@/components/owner/Section";
import { cn, focusRingClass, panelClass } from "@/components/ui/styles";

export function TradeBlockRosterView(props: {
  saveId: string;
  tradeBlock: TradeBlockView;
  returnPath: string;
}) {
  const { players, picks } = props.tradeBlock;
  const empty = players.length === 0 && picks.length === 0;

  if (empty) {
    return (
      <EmptyState message="No players or picks on the trade block. Use Add to block on the roster table." />
    );
  }

  return (
    <div className="space-y-6">
      <Section title="Player Trade Block">
        {players.length === 0 ? (
          <EmptyState message="No players on the trade block." />
        ) : (
          <ul className={cn(panelClass, "divide-y divide-zinc-800")}>
            {players.map((player) => (
              <li
                key={player.playerId}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div className="min-w-0">
                  <PlayerEntityLink
                    saveId={props.saveId}
                    playerId={player.playerId}
                  >
                    {player.firstName} {player.lastName}
                  </PlayerEntityLink>
                  <p className="mt-0.5 font-mono text-xs text-zinc-500">
                    {player.position} · {player.overall} OVR · {player.status}
                  </p>
                </div>
                <form action={toggleTradeBlockAction}>
                  <input type="hidden" name="saveId" value={props.saveId} />
                  <input
                    type="hidden"
                    name="playerId"
                    value={player.playerId}
                  />
                  <input type="hidden" name="listed" value="false" />
                  <input
                    type="hidden"
                    name="returnPath"
                    value={props.returnPath}
                  />
                  <button
                    type="submit"
                    className={cn(
                      "text-xs text-zinc-400 hover:text-zinc-200",
                      focusRingClass,
                    )}
                  >
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Available Picks">
        {picks.length === 0 ? (
          <EmptyState message="No draft picks on the trade block." />
        ) : (
          <ul className={cn(panelClass, "divide-y divide-zinc-800")}>
            {picks.map((pick) => (
              <li
                key={pick.draftPickId}
                className="flex items-center justify-between gap-2 px-4 py-3"
              >
                <div>
                  <p className="text-sm text-zinc-100">{pick.label}</p>
                  <p className="font-mono text-xs text-zinc-500">{pick.status}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
