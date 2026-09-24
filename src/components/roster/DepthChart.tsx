import type { DepthChartView } from "@/state/roster-page-selectors";
import { PLAYER_POSITIONS } from "@/domain/entities/player";
import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { EmptyState } from "@/components/owner/EmptyState";
import { cn, panelClass } from "@/components/ui/styles";

export function DepthChart(props: {
  saveId: string;
  depthChart: DepthChartView;
}) {
  const hasAny = PLAYER_POSITIONS.some(
    (position) => props.depthChart[position].length > 0,
  );

  if (!hasAny) {
    return <EmptyState message="No players available for depth chart." />;
  }

  return (
    <section aria-label="Depth chart" className="space-y-3">
      <h2 className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-zinc-500">
        Depth Chart
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {PLAYER_POSITIONS.map((position) => {
          const entries = props.depthChart[position];
          return (
            <div
              key={position}
              className={cn(panelClass, "px-3 py-3")}
              aria-label={`${position} depth`}
            >
              <h3 className="font-mono text-sm font-medium text-amber-400">
                {position}
              </h3>
              {entries.length === 0 ? (
                <p className="mt-2 text-xs text-zinc-600">—</p>
              ) : (
                <ol className="mt-2 space-y-2">
                  {entries.slice(0, 5).map((entry, index) => (
                    <li
                      key={`${position}-${entry.playerId}`}
                      className={cn(
                        "text-sm",
                        !entry.canPlay && "opacity-60",
                      )}
                    >
                      <div className="flex items-baseline justify-between gap-1">
                        <span className="min-w-0 truncate">
                          <span className="mr-1 font-mono text-[0.65rem] text-zinc-500">
                            {index + 1}.
                          </span>
                          <PlayerEntityLink
                            saveId={props.saveId}
                            playerId={entry.playerId}
                          >
                            {entry.firstName} {entry.lastName}
                          </PlayerEntityLink>
                        </span>
                        <span className="shrink-0 font-mono text-xs text-zinc-400">
                          {entry.overall}
                        </span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-2 font-mono text-[0.6rem] uppercase tracking-wide text-zinc-500">
                        <span>{entry.label}</span>
                        {!entry.canPlay ? (
                          <span className="text-rose-400">
                            {entry.availabilityLabel}
                          </span>
                        ) : null}
                        {entry.primaryPosition !== position ? (
                          <span>({entry.primaryPosition})</span>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
