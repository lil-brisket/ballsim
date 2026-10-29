import type { PlayerStatLine } from "@/domain/player-stat-aggregation";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { buildStatGroups, type ExtendedMode, type StatMode } from "./stat-view";

export function StatGroups(props: {
  line: PlayerStatLine;
  mode: StatMode;
  extended: ExtendedMode;
}) {
  const groups = buildStatGroups(props.line, props.mode, props.extended);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {groups.map((group) => (
          <section
            key={group.title}
            aria-label={group.title}
            className="rounded-lg border border-line bg-surface-raised/40 p-3"
          >
            <SectionHeading
              as="h3"
              size="sm"
              tone="team"
              className="mb-2"
              title={group.title}
            />
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3">
              {group.items.map((item) => (
                <div key={item.key} className="min-w-0">
                  <dt className="text-sm text-muted">
                    {item.label}
                    {item.key === "gs" ? <sup aria-hidden> ‡</sup> : null}
                  </dt>
                  <dd className="text-base tabular-nums text-ink">
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
      <div className="space-y-1 text-sm text-muted">
        <p>
          ‡ GS: older saves did not record starters, so seasons played before
          that update may undercount games started.
        </p>
        {props.extended === "unavailable" ? (
          <p>
            This season was recorded as a season summary only; some columns are
            unavailable.
          </p>
        ) : null}
        {props.extended === "partial" ? (
          <p>† Excludes seasons recorded only as season summaries.</p>
        ) : null}
      </div>
    </div>
  );
}
