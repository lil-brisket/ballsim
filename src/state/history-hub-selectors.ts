/**
 * League History hub view model shared by /awards and /history.
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
] as const;

export type HistoryHubTab = (typeof HISTORY_HUB_TABS)[number];

export type HistoryHubRoute = "awards" | "history";

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
};

function isHistoryHubTab(value: string | undefined): value is HistoryHubTab {
  return (
    value !== undefined && (HISTORY_HUB_TABS as readonly string[]).includes(value)
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
 * Legacy deep links: /awards → Current Season (or Awards when ?season= names
 * a past year); /history → Team Records for the active owner team.
 */
export function resolveHistoryHubTab(
  state: GameState,
  route: HistoryHubRoute,
  params: HistoryHubParams,
): HistoryHubTab {
  if (isHistoryHubTab(params.tab)) return params.tab;
  if (route === "history") return "teams";
  const season = parseSeason(params.season);
  if (season !== undefined && season !== state.competition.season.year) {
    return "awards";
  }
  return "current";
}

function toOwnerStory(state: GameState): OwnerStoryItem[] {
  const situations = toOwnerDashboardView(state).situations.map((situation) => ({
    id: situation.id,
    meta: `${situation.updatedOn} · ${situation.category} · ${situation.status}`,
    title: situation.title,
    summary: situation.summary,
  }));
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
  };

  switch (tab) {
    case "current":
      view.currentSeason = toCurrentSeasonAwardGroups(state);
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
        params.team ?? (route === "history" ? ownerTeamId : undefined);
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
  }

  return view;
}
