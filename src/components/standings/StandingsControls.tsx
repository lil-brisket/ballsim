import Link from "next/link";
import {
  buildStandingsHref,
  DEFAULT_STANDINGS_STATS,
  DEFAULT_STANDINGS_VIEW,
  STANDINGS_STATS_MODES,
  STANDINGS_VIEW_MODES,
  type StandingsStatsMode,
  type StandingsViewMode,
} from "@/state/standings-page-params";
import { cn, focusRingClass } from "@/components/ui/styles";

const VIEW_LABELS: Record<StandingsViewMode, string> = {
  overall: "Overall",
  conference: "Conference",
  division: "Division",
};

const STATS_LABELS: Record<StandingsStatsMode, string> = {
  standard: "Standard",
  advanced: "Advanced",
};

function pillClass(active: boolean): string {
  return cn(
    "rounded-full border px-3 py-1 text-xs",
    active
      ? "border-amber-600 text-amber-400"
      : "border-zinc-700 text-zinc-400 hover:border-zinc-500",
    focusRingClass,
  );
}

export function StandingsControls(props: {
  saveId: string;
  view: StandingsViewMode;
  stats: StandingsStatsMode;
  divisionsEnabled: boolean;
  searchParams?:
    URLSearchParams | Record<string, string | string[] | undefined> | string;
}) {
  const pathname = `/dashboard/${props.saveId}/standings`;
  const currentSearch = props.searchParams ?? {};
  const viewModes = STANDINGS_VIEW_MODES.filter(
    (mode) => mode !== "division" || props.divisionsEnabled,
  );
  const isDefault =
    props.view === DEFAULT_STANDINGS_VIEW &&
    props.stats === DEFAULT_STANDINGS_STATS;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-4">
      <nav
        className="flex flex-wrap items-center gap-2"
        aria-label="Standings view"
      >
        <span className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-zinc-500">
          View
        </span>
        {viewModes.map((mode) => {
          const active = props.view === mode;
          return (
            <Link
              key={mode}
              href={buildStandingsHref({
                pathname,
                currentSearch,
                view: mode,
                stats: props.stats,
              })}
              className={pillClass(active)}
              aria-current={active ? "page" : undefined}
              data-testid={`standings-view-${mode}`}
            >
              {VIEW_LABELS[mode]}
            </Link>
          );
        })}
      </nav>
      <nav
        className="flex flex-wrap items-center gap-2"
        aria-label="Standings stats"
      >
        <span className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-zinc-500">
          Stats
        </span>
        {STANDINGS_STATS_MODES.map((mode) => {
          const active = props.stats === mode;
          return (
            <Link
              key={mode}
              href={buildStandingsHref({
                pathname,
                currentSearch,
                view: props.view,
                stats: mode,
              })}
              className={pillClass(active)}
              aria-current={active ? "page" : undefined}
              data-testid={`standings-stats-${mode}`}
            >
              {STATS_LABELS[mode]}
            </Link>
          );
        })}
      </nav>
      {isDefault ? null : (
        <Link
          href={buildStandingsHref({
            pathname,
            currentSearch,
            view: DEFAULT_STANDINGS_VIEW,
            stats: DEFAULT_STANDINGS_STATS,
          })}
          className={cn(
            "text-xs text-zinc-500 hover:text-amber-400",
            focusRingClass,
          )}
          data-testid="standings-reset"
        >
          Reset to default
        </Link>
      )}
    </div>
  );
}
