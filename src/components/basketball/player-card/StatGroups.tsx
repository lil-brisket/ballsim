import type { PlayerStatLine } from "@/domain/player-stat-aggregation";
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
            className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3"
          >
            <h3 className="mb-2 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-team-ink">
              {group.title}
            </h3>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3">
              {group.items.map((item) => (
                <div key={item.key} className="min-w-0">
                  <dt className="font-mono text-[0.65rem] uppercase tracking-[0.12em] text-zinc-400">
                    {item.label}
                    {item.key === "gs" ? <sup aria-hidden> ‡</sup> : null}
                  </dt>
                  <dd className="font-mono text-base tabular-nums text-zinc-100">
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
      <div className="space-y-1 text-xs text-zinc-400">
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
