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
import {
  cn,
  focusRingClass,
  touchTargetTextClass,
} from "@/components/ui/styles";
import { ViewSwitch } from "@/components/ui/ViewSwitch";

const VIEW_LABELS: Record<StandingsViewMode, string> = {
  overall: "Overall",
  conference: "Conference",
  division: "Division",
};

const STATS_LABELS: Record<StandingsStatsMode, string> = {
  standard: "Standard",
  advanced: "Advanced",
};

export function StandingsControls(props: {
  saveId: string;
  view: StandingsViewMode;
  stats: StandingsStatsMode;
  divisionsEnabled: boolean;
  searchParams?:
    URLSearchParams | Record<string, string | string[] | undefined> | string;
}) {
  const pathname = `/dashboard/${props.saveId}/league/standings`;
  const currentSearch = props.searchParams ?? {};
  const viewModes = STANDINGS_VIEW_MODES.filter(
    (mode) => mode !== "division" || props.divisionsEnabled,
  );
  const isDefault =
    props.view === DEFAULT_STANDINGS_VIEW &&
    props.stats === DEFAULT_STANDINGS_STATS;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">View</span>
        <ViewSwitch
          aria-label="Standings view"
          activeKey={props.view}
          items={viewModes.map((mode) => ({
            key: mode,
            label: VIEW_LABELS[mode],
            href: buildStandingsHref({
              pathname,
              currentSearch,
              view: mode,
              stats: props.stats,
            }),
          }))}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">Stats</span>
        <ViewSwitch
          aria-label="Standings stats"
          activeKey={props.stats}
          items={STANDINGS_STATS_MODES.map((mode) => ({
            key: mode,
            label: STATS_LABELS[mode],
            href: buildStandingsHref({
              pathname,
              currentSearch,
              view: props.view,
              stats: mode,
            }),
          }))}
        />
      </div>
      {isDefault ? null : (
        <Link
          href={buildStandingsHref({
            pathname,
            currentSearch,
            view: DEFAULT_STANDINGS_VIEW,
            stats: DEFAULT_STANDINGS_STATS,
          })}
          className={cn(
            touchTargetTextClass,
            "text-sm text-muted hover:text-team-ink",
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
