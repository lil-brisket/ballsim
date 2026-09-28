import type {
  HistoryHubRoute,
  HistoryHubTab,
} from "@/state/history-hub-selectors";

export type HistoryHubLinkParams = {
  tab?: HistoryHubTab;
  season?: string;
  award?: string;
  team?: string;
  player?: string;
};

/** Hub URL on the same legacy route (/awards or /history) the user is on. */
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
  const base = `/dashboard/${saveId}/${route}`;
  return qs ? `${base}?${qs}` : base;
}
