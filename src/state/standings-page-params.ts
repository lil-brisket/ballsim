/**
 * Standings page URL search-param parsing and href building.
 * Pure; does not import React or Next.
 */

export const STANDINGS_VIEW_MODES = [
  "overall",
  "conference",
  "division",
] as const;
export const STANDINGS_STATS_MODES = ["standard", "advanced"] as const;

export type StandingsViewMode = (typeof STANDINGS_VIEW_MODES)[number];
export type StandingsStatsMode = (typeof STANDINGS_STATS_MODES)[number];

export type StandingsPageOptions = {
  view: StandingsViewMode;
  stats: StandingsStatsMode;
};

export const DEFAULT_STANDINGS_VIEW: StandingsViewMode = "overall";
export const DEFAULT_STANDINGS_STATS: StandingsStatsMode = "standard";

const VIEW_SET = new Set<string>(STANDINGS_VIEW_MODES);
const STATS_SET = new Set<string>(STANDINGS_STATS_MODES);

export function firstSearchParam(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function isViewMode(value: string): value is StandingsViewMode {
  return VIEW_SET.has(value);
}

function isStatsMode(value: string): value is StandingsStatsMode {
  return STATS_SET.has(value);
}

export function parseStandingsPageParams(
  search: {
    view?: string | string[];
    stats?: string | string[];
  },
  options: { divisionsEnabled: boolean },
): StandingsPageOptions {
  const rawView = firstSearchParam(search.view);
  const rawStats = firstSearchParam(search.stats);

  let view: StandingsViewMode = DEFAULT_STANDINGS_VIEW;
  if (rawView != null && isViewMode(rawView)) {
    view = rawView;
  }
  if (view === "division" && !options.divisionsEnabled) {
    view = DEFAULT_STANDINGS_VIEW;
  }

  let stats: StandingsStatsMode = DEFAULT_STANDINGS_STATS;
  if (rawStats != null && isStatsMode(rawStats)) {
    stats = rawStats;
  }

  return { view, stats };
}

export function searchParamsFromRecord(
  record: Record<string, string | string[] | undefined> | URLSearchParams,
): URLSearchParams {
  if (record instanceof URLSearchParams) {
    return new URLSearchParams(record.toString());
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(record)) {
    const first = firstSearchParam(value);
    if (first != null && first !== "") {
      params.set(key, first);
    }
  }
  return params;
}

/**
 * Build a standings href from the current query.
 * Preserves unrelated params; drops only `error`; omits default view/stats.
 */
export function buildStandingsHref(input: {
  pathname: string;
  currentSearch:
    URLSearchParams | Record<string, string | string[] | undefined> | string;
  view: StandingsViewMode;
  stats: StandingsStatsMode;
}): string {
  const current =
    typeof input.currentSearch === "string"
      ? new URLSearchParams(input.currentSearch)
      : searchParamsFromRecord(input.currentSearch);
  const params = new URLSearchParams(current.toString());
  params.delete("error");

  if (input.view === DEFAULT_STANDINGS_VIEW) {
    params.delete("view");
  } else {
    params.set("view", input.view);
  }

  if (input.stats === DEFAULT_STANDINGS_STATS) {
    params.delete("stats");
  } else {
    params.set("stats", input.stats);
  }

  const qs = params.toString();
  return qs ? `${input.pathname}?${qs}` : input.pathname;
}
