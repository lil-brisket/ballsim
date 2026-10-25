/**
 * History hub view model shared by /awards (awards only), /history (league
 * history) and /team/history (team records, player history, retired jerseys).
 * Composes the awards, league, team, and player history selectors and only
 * builds the data the active tab needs.
 */

import type { AwardDefinitionId } from "@/domain/entities/awards";
import type { GameState } from "@/state/game-state";
import {
  toAwardHistoryView,
  toCurrentSeasonAwardGroups,
  type AwardHistorySeasonSelection,
  type AwardHistoryView,
  type CurrentSeasonAwardGroup,
} from "@/state/awards-hub-selectors";
import {
  toFranchiseHistoryView,
  toTeamHistoryView,
  toTeamRecordsView,
  type FranchiseHistoryView,
  type TeamHistoryView,
  type TeamRecordsRow,
} from "@/state/franchise-selectors";
import { toLegacyView, type LegacyView } from "@/state/legacy-selectors";
import {
  toLeagueHistoryView,
  type LeagueHistoryView,
} from "@/state/league-history-selectors";
import { toOwnerDashboardView } from "@/state/owner-dashboard";
import {
  toPlayerHistoryIndex,
  toPlayerHistoryView,
  type PlayerHistoryIndexEntry,
  type PlayerHistoryView,
} from "@/state/player-history-selectors";
import { toNotificationsView } from "@/state/selectors";
import { AWARD_DEFINITIONS } from "@/systems/awards/award-definitions";

export const HISTORY_HUB_TABS = [
  "current",
  "awards",
  "league",
  "teams",
  "players",
  "jerseys",
] as const;

export type HistoryHubTab = (typeof HISTORY_HUB_TABS)[number];

export type HistoryHubRoute = "awards" | "history" | "team";

/** Tabs each route shows, default first. */
export const HISTORY_HUB_ROUTE_TABS: Record<
  HistoryHubRoute,
  readonly HistoryHubTab[]
> = {
  awards: ["current", "awards"],
  history: ["league"],
  team: ["teams", "players", "jerseys"],
};

export type HistoryHubParams = {
  tab?: string;
  season?: string;
  award?: string;
  team?: string;
  player?: string;
};

export const OWNER_STORY_LIMIT = 12;

export type OwnerStoryItem = {
  id: string;
  meta: string;
  title: string;
  summary: string;
};

export type HistoryHubView = {
  saveId: string;
  route: HistoryHubRoute;
  tab: HistoryHubTab;
  currentSeasonYear: number;
  currentSeason: CurrentSeasonAwardGroup[] | null;
  awardHistory: AwardHistoryView | null;
  leagueHistory: LeagueHistoryView | null;
  teamRecords: TeamRecordsRow[] | null;
  selectedTeam: TeamHistoryView | null;
  /** Owner summary + story only when the selected team is the active owner team. */
  ownerFranchise: FranchiseHistoryView | null;
  ownerStory: OwnerStoryItem[] | null;
  playerIndex: PlayerHistoryIndexEntry[] | null;
  selectedPlayer: PlayerHistoryView | null;
  /** Active owner team's retired numbers and legends who can join them. */
  retiredJerseys: Pick<LegacyView, "retiredNumbers" | "legends"> | null;
};

function isHistoryHubTab(value: string | undefined): value is HistoryHubTab {
  return (
    value !== undefined &&
    (HISTORY_HUB_TABS as readonly string[]).includes(value)
  );
}

function parseSeason(
  raw: string | undefined,
): AwardHistorySeasonSelection | undefined {
  if (raw === "all") return "all";
  if (raw === undefined || raw === "") return undefined;
  const year = Number(raw);
  return Number.isInteger(year) ? year : undefined;
}

/**
 * The route that owns `params.tab` when it is not the current route, so old
 * links such as /awards?tab=teams can redirect. Null when no redirect is due.
 */
export function misroutedHistoryHubTab(
  route: HistoryHubRoute,
  params: HistoryHubParams,
): HistoryHubRoute | null {
  if (!isHistoryHubTab(params.tab)) return null;
  const tab = params.tab;
  if (HISTORY_HUB_ROUTE_TABS[route].includes(tab)) return null;
  const owner = (Object.keys(HISTORY_HUB_ROUTE_TABS) as HistoryHubRoute[]).find(
    (candidate) => HISTORY_HUB_ROUTE_TABS[candidate].includes(tab),
  );
  return owner ?? null;
}

/**
 * The tab named in `params` when the route shows it. Otherwise /awards opens
 * Current Season (or Awards when ?season= names a past year or nothing has
 * been won yet), and other routes open their first tab.
 */
export function resolveHistoryHubTab(
  state: GameState,
  route: HistoryHubRoute,
  params: HistoryHubParams,
): HistoryHubTab {
  const tabs = HISTORY_HUB_ROUTE_TABS[route];
  if (isHistoryHubTab(params.tab) && tabs.includes(params.tab)) {
    return params.tab;
  }
  if (route !== "awards") return tabs[0]!;
  const season = parseSeason(params.season);
  if (season !== undefined && season !== state.competition.season.year) {
    return "awards";
  }
  const currentHasWinners = toCurrentSeasonAwardGroups(state).some((group) =>
    group.slots.some((slot) => slot.status === "won"),
  );
  // Races give the tab something to show before the first award is decided.
  return currentHasWinners || state.competition.season.phase === "regular"
    ? "current"
    : "awards";
}

function toOwnerStory(state: GameState): OwnerStoryItem[] {
  const situations = toOwnerDashboardView(state).situations.map(
    (situation) => ({
      id: situation.id,
      meta: `${situation.updatedOn} · ${situation.category} · ${situation.status}`,
      title: situation.title,
      summary: situation.summary,
    }),
  );
  const narrative = toNotificationsView(state)
    .filter((notification) => notification.type === "narrative")
    .slice(0, OWNER_STORY_LIMIT)
    .map((notification) => ({
      id: notification.id,
      meta: `${notification.occurredOn} · story`,
      title: notification.title,
      summary: notification.message,
    }));
  return [...situations, ...narrative];
}

export function toHistoryHubView(
  state: GameState,
  route: HistoryHubRoute,
  params: HistoryHubParams,
): HistoryHubView {
  const tab = resolveHistoryHubTab(state, route, params);
  const view: HistoryHubView = {
    saveId: state.meta.saveId,
    route,
    tab,
    currentSeasonYear: state.competition.season.year,
    currentSeason: null,
    awardHistory: null,
    leagueHistory: null,
    teamRecords: null,
    selectedTeam: null,
    ownerFranchise: null,
    ownerStory: null,
    playerIndex: null,
    selectedPlayer: null,
    retiredJerseys: null,
  };

  switch (tab) {
    case "current":
      view.currentSeason = toCurrentSeasonAwardGroups(state, { races: true });
      break;
    case "awards": {
      const awardId =
        params.award && params.award in AWARD_DEFINITIONS
          ? (params.award as AwardDefinitionId)
          : undefined;
      view.awardHistory = toAwardHistoryView(state, {
        seasonYear: parseSeason(params.season),
        awardId,
      });
      break;
    }
    case "league":
      view.leagueHistory = toLeagueHistoryView(state);
      break;
    case "teams": {
      view.teamRecords = toTeamRecordsView(state);
      const ownerTeamId = state.user.activeOwnerTeamId;
      const teamId =
        params.team ?? (route === "team" ? ownerTeamId : undefined);
      if (teamId && state.business.franchiseHistory[teamId]) {
        view.selectedTeam = toTeamHistoryView(state, teamId);
        if (teamId === ownerTeamId) {
          view.ownerFranchise = toFranchiseHistoryView(state);
          view.ownerStory = toOwnerStory(state);
        }
      }
      break;
    }
    case "players":
      view.playerIndex = toPlayerHistoryIndex(state);
      if (params.player) {
        view.selectedPlayer = toPlayerHistoryView(state, params.player);
      }
      break;
    case "jerseys": {
      const { retiredNumbers, legends } = toLegacyView(state);
      view.retiredJerseys = { retiredNumbers, legends };
      break;
    }
  }

  return view;
}
