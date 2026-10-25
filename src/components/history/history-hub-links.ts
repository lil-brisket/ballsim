import type { HistoryHubRoute } from "@/state/history-hub-selectors";

export type HistoryHubLinkParams = {
  tab?: string;
  season?: string;
  award?: string;
  team?: string;
  player?: string;
};

/**
 * Hub URL for a route: /awards, /history, or /team/history for the team
 * route (team records, player history, retired jerseys).
 */
export function historyHubHref(
  saveId: string,
  route: HistoryHubRoute,
  params: HistoryHubLinkParams = {},
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const qs = search.toString();
  const base =
    route === "team"
      ? `/dashboard/${saveId}/team/history`
      : `/dashboard/${saveId}/${route}`;
  return qs ? `${base}?${qs}` : base;
}
