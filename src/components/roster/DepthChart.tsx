import type { DepthChartView } from "@/state/roster-page-selectors";
import { PLAYER_POSITIONS } from "@/domain/entities/player";
import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeading } from "@/components/ui/SectionHeading";
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
      <SectionHeading title="Depth Chart" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {PLAYER_POSITIONS.map((position) => {
          const entries = props.depthChart[position];
          return (
            <div
              key={position}
              className={cn(panelClass, "px-3 py-3")}
              aria-label={`${position} depth`}
            >
              <SectionHeading as="h3" size="sm" tone="team" title={position} />
              {entries.length === 0 ? (
                <p className="mt-2 text-sm text-disabled">—</p>
              ) : (
                <ol className="mt-2 space-y-2">
                  {entries.slice(0, 5).map((entry, index) => (
                    <li
                      key={`${position}-${entry.playerId}`}
                      className={cn("text-sm", !entry.canPlay && "opacity-60")}
                    >
                      <div className="flex items-baseline justify-between gap-1">
                        <span className="min-w-0 truncate">
                          <span className="mr-1 tabular-nums text-sm text-faint">
                            {index + 1}.
                          </span>
                          <PlayerEntityLink
                            saveId={props.saveId}
                            playerId={entry.playerId}
                          >
                            {entry.firstName} {entry.lastName}
                          </PlayerEntityLink>
                        </span>
                        <span className="shrink-0 text-sm tabular-nums text-muted">
                          {entry.overall}
                        </span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-2 text-sm text-faint">
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
