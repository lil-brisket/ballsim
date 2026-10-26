import { buildSituationsView } from "@/state/owner-dashboard/action-items";
import type { OwnerDashboardSituationView } from "@/state/owner-dashboard/types";
import "server-only";
import type { SaveGameStore } from "@/persistence/save-game-store";
import {
  toRosterView,
  toDashboardSnapshot,
  listTeamsForSelection,
  listCitiesForTeamPick,
  toStandingsView,
  toFreeAgentViews,
  toFreeAgencyOfferViews,
  toOpenFreeAgencyOfferViews,
  toDraftBoardView,
  toObjectivesView,
  toNotificationsView,
  toEventLogView,
  toScheduleView,
  toContractsView,
  toFinancesView,
  isPlayerInOwnerScope,
  toPlayerDetailView,
  type GameBoxScoreView,
  canOpenGameBoxScore,
  toGameBoxScoreView,
} from "@/state/selectors";
import { type TradeFinderCandidate, findTrades } from "@/systems/trades";
import { asPlayerId, asSeasonId, asTeamId } from "@/domain/ids";
import {
  toStaffView,
  toFacilitiesView,
  toFranchiseBusinessView,
  toSponsorshipsView,
  toLeagueEconomyView,
  toRelocationView,
  toExpansionView,
  toFranchiseHistoryView,
} from "@/state/franchise-selectors";
import { toFranchisePnLView } from "@/state/franchise-pnl";
import { assessRelocation } from "@/state/relocation-assessment";
import { assessExpansion } from "@/state/expansion-assessment";
import { toOwnerDashboardView } from "@/state/owner-dashboard";
import { toPhaseDashboardView } from "@/state/phase-dashboard";
import { toLeagueAwardsView } from "@/state/award-selectors";
import { toTeamHubView } from "@/state/team-hub-selectors";
import { ownerNavGroupsForState } from "@/application/owner-nav-config";
import {
  type RosterPageView,
  toRosterPageView,
} from "@/state/roster-page-selectors";
import {
  type PlayerGameSeriesPoint,
  type PlayerProfileView,
  toPlayerGameSeries,
  toPlayerProfileView,
} from "@/state/player-profile-selectors";
import {
  type PlayerDrawerView,
  toPlayerDrawerView,
  type TeamDrawerView,
  toTeamDrawerView,
  type StaffDrawerView,
  toStaffDrawerView,
} from "@/state/entity-drawer-selectors";
import { canWatchGame, toWatchGameView } from "@/state/watch-game-selectors";
import type { WatchGameView } from "@/state/watch-game-view";
import {
  type LeagueHubView,
  toLeagueHubView,
} from "@/state/league-hub-selectors";
import {
  type ContractHubView,
  toContractHubView,
} from "@/state/contract-hub-selectors";
import {
  type StaffHubView,
  toStaffHubView,
  type StaffHiringMarketView,
  toStaffHiringMarketView,
} from "@/state/staff-hub-selectors";
import {
  type DevelopmentHubView,
  toDevelopmentHubView,
} from "@/state/development-hub-selectors";
import {
  type DevelopmentLeagueDashboardView,
  toDevelopmentLeagueDashboardView,
} from "@/state/development-league-selectors";
import {
  type FinanceHubView,
  toFinanceHubView,
} from "@/state/finance-hub-selectors";
import {
  type FranchiseHubView,
  toFranchiseHubView,
} from "@/state/franchise-hub-selectors";
import {
  type FranchiseOwnershipView,
  toFranchiseOwnershipView,
} from "@/state/franchise-ownership-selectors";
import {
  type TransactionFilterGroup,
  type TransactionDateRangeKey,
  type TransactionSortKey,
  type TransactionActivityMode,
  type TransactionHubView,
  toTransactionHubView,
  TRANSACTION_HUB_PAGE_SIZE,
} from "@/state/transaction-hub-selectors";
import { getActiveOwnerTeamId } from "@/state/owner-context";
import {
  firstSearchParam,
  parseStandingsPageParams,
} from "@/state/standings-page-params";
import {
  toStandingsPageView,
  toPlayoffRaceView,
} from "@/state/standings-selectors";
import { toSettingsView, type SettingsView } from "@/state/settings-view";
import { toLeagueLeadersView } from "@/state/league-leaders-selectors";
import {
  parseLeagueStatsSort,
  PLAYER_STAT_KEYS,
  TEAM_STAT_KEYS,
  toPlayerStatsView,
  toTeamStatsView,
  type PlayerStatsView,
  type TeamStatsView,
} from "@/state/league-stats-selectors";
import {
  type LeagueScheduleFilters,
  type LeagueScheduleView,
  toLeagueScheduleView,
} from "@/state/league-schedule-selectors";
import {
  type MediaTimelinePageOptions,
  type MediaTimelinePageView,
  toMediaTimelinePageView,
} from "@/state/media-timeline/page-view";
import type {
  OwnerSaveView,
  CreateGameResult,
} from "@/application/game-service/types";
import {
  getStore,
  ensureAiTradeBlocks,
  loadSaveWithHistory,
  toSaveSummary,
} from "@/application/game-service/internal";

export async function loadOwnerSaveView(
  saveId: string,
  store?: SaveGameStore,
): Promise<OwnerSaveView | null> {
  const loaded = await getStore(store).load(saveId);
  if (!loaded) {
    return null;
  }
  const state = loaded.state;
  const teamId = state.user.activeOwnerTeamId;
  const roster = toRosterView(state);
  const outgoingPlayerId = roster[roster.length - 1]?.playerId;
  let tradeCandidates: TradeFinderCandidate[] = [];
  if (outgoingPlayerId) {
    tradeCandidates = findTrades(ensureAiTradeBlocks(state), {
      direction: "move",
      teamId,
      asset: { kind: "player", playerId: asPlayerId(outgoingPlayerId) },
    });
  }

  return {
    save: toSaveSummary(loaded),
    dashboard: toDashboardSnapshot(state),
    teams: listTeamsForSelection(state),
    cities: listCitiesForTeamPick(state),
    roster,
    standings: toStandingsView(state),
    freeAgents: toFreeAgentViews(state),
    freeAgencyOffers: toFreeAgencyOfferViews(state),
    openFreeAgencyOffers: toOpenFreeAgencyOfferViews(state),
    draftBoard: toDraftBoardView(state),
    tradeCandidates,
    objectives: toObjectivesView(state),
    notifications: toNotificationsView(state),
    eventLog: toEventLogView(state),
    schedule: toScheduleView(state),
    contracts: toContractsView(state),
    finances: toFinancesView(state),
    staff: toStaffView(state),
    facilities: toFacilitiesView(state),
    franchiseBusiness: toFranchiseBusinessView(state),
    franchisePnL: toFranchisePnLView(state),
    sponsorships: toSponsorshipsView(state),
    leagueEconomy: toLeagueEconomyView(state),
    relocation: toRelocationView(state),
    expansion: toExpansionView(state),
    relocationAssessment: assessRelocation(state),
    expansionAssessment: assessExpansion(state),
    franchiseHistory: toFranchiseHistoryView(state),
    ownerDashboard: toOwnerDashboardView(state),
    phaseDashboard: toPhaseDashboardView(state),
    settings: state.settings,
    leagueAwards: toLeagueAwardsView(state, saveId),
    teamHub: toTeamHubView(state),
    navGroups: ownerNavGroupsForState(state),
  };
}

export type RosterPageLoadResult = CreateGameResult & {
  rosterPage: RosterPageView;
};

/**
 * Dedicated roster-management page load.
 * Does not run Trade Finder / ensureAiTradeBlocks — candidates load lazily.
 */
export async function loadRosterPageView(
  saveId: string,
  store?: SaveGameStore,
): Promise<RosterPageLoadResult | null> {
  const loaded = await getStore(store).load(saveId);
  if (!loaded) {
    return null;
  }
  const state = loaded.state;
  return {
    save: toSaveSummary(loaded),
    dashboard: toDashboardSnapshot(state),
    rosterPage: toRosterPageView(state),
    navGroups: ownerNavGroupsForState(state),
  };
}

export async function loadOwnerPlayerView(
  saveId: string,
  playerId: string,
  store?: SaveGameStore,
): Promise<(CreateGameResult & { player: PlayerProfileView }) | null> {
  const loaded = await loadSaveWithHistory(saveId, store);
  if (!loaded) {
    return null;
  }
  const typedId = asPlayerId(playerId);
  if (!isPlayerInOwnerScope(loaded.state, typedId)) {
    return null;
  }
  const detail = toPlayerDetailView(loaded.state, typedId);
  if (!detail) {
    return null;
  }
  const player = toPlayerProfileView(loaded.state, typedId, detail);
  return {
    save: toSaveSummary(loaded),
    dashboard: toDashboardSnapshot(loaded.state),
    player,
  };
}

/** Quick-view drawer payload — any in-league player (public vs controlled fields). */
export async function loadPlayerDrawerView(
  saveId: string,
  playerId: string,
  store?: SaveGameStore,
): Promise<PlayerDrawerView | null> {
  const loaded = await loadSaveWithHistory(saveId, store);
  if (!loaded) {
    return null;
  }
  return toPlayerDrawerView(loaded.state, asPlayerId(playerId), saveId);
}

/** Game-by-game series for one season; the drawer loads the current season eagerly. */
export async function loadPlayerGameSeries(
  saveId: string,
  playerId: string,
  seasonId: string,
  store?: SaveGameStore,
): Promise<PlayerGameSeriesPoint[] | null> {
  const loaded = await loadSaveWithHistory(saveId, store);
  if (!loaded || !loaded.state.world.players[playerId]) {
    return null;
  }
  return toPlayerGameSeries(
    loaded.state,
    asPlayerId(playerId),
    asSeasonId(seasonId),
  );
}

/** Quick-view drawer payload for any league team. */
export async function loadTeamDrawerView(
  saveId: string,
  teamId: string,
  store?: SaveGameStore,
): Promise<TeamDrawerView | null> {
  const loaded = await getStore(store).load(saveId);
  if (!loaded) {
    return null;
  }
  return toTeamDrawerView(loaded.state, asTeamId(teamId), saveId);
}

/** Quick-view drawer payload for a staff member. */
export async function loadStaffDrawerView(
  saveId: string,
  staffId: string,
  store?: SaveGameStore,
): Promise<StaffDrawerView | null> {
  const loaded = await getStore(store).load(saveId);
  if (!loaded) {
    return null;
  }
  return toStaffDrawerView(loaded.state, staffId, saveId);
}

export async function loadOwnerGameBoxScoreView(
  saveId: string,
  gameId: string,
  store?: SaveGameStore,
): Promise<
  (CreateGameResult & { boxScore: GameBoxScoreView; canWatch: boolean }) | null
> {
  const loaded = await loadSaveWithHistory(saveId, store);
  if (!loaded) {
    return null;
  }
  if (!canOpenGameBoxScore(loaded.state, gameId)) {
    return null;
  }
  const boxScore = toGameBoxScoreView(loaded.state, gameId);
  if (!boxScore) {
    return null;
  }
  return {
    save: toSaveSummary(loaded),
    dashboard: toDashboardSnapshot(loaded.state),
    boxScore,
    canWatch: canWatchGame(loaded.state, gameId),
  };
}

/**
 * Watch Game payload: box-score eligibility gates the game (current-season,
 * final, belongs to this save); `watch` is null when no log was recorded.
 */
export async function loadOwnerWatchGameView(
  saveId: string,
  gameId: string,
  store?: SaveGameStore,
): Promise<(CreateGameResult & { watch: WatchGameView | null }) | null> {
  const loaded = await getStore(store).load(saveId);
  if (!loaded) {
    return null;
  }
  if (!canOpenGameBoxScore(loaded.state, gameId)) {
    return null;
  }
  return {
    save: toSaveSummary(loaded),
    dashboard: toDashboardSnapshot(loaded.state),
    watch: toWatchGameView(loaded.state, gameId),
  };
}

/**
 * League Hub — single-pass overview for the league experience.
 */
export async function loadLeagueHubView(
  saveId: string,
  store?: SaveGameStore,
): Promise<LeagueHubView | null> {
  const loaded = await loadSaveWithHistory(saveId, store);
  if (!loaded) {
    return null;
  }
  return toLeagueHubView(loaded.state);
}

/**
 * Contract Management Hub — payroll, options, and contract decisions.
 */
export async function loadContractHubView(
  saveId: string,
  store?: SaveGameStore,
): Promise<ContractHubView | null> {
  const loaded = await getStore(store).load(saveId);
  if (!loaded) {
    return null;
  }
  return toContractHubView(loaded.state);
}

/**
 * Staff Hub — Staff Directory, vacancies, and hiring market.
 */
export async function loadStaffHubView(
  saveId: string,
  store?: SaveGameStore,
): Promise<StaffHubView | null> {
  const loaded = await getStore(store).load(saveId);
  if (!loaded) {
    return null;
  }
  return toStaffHubView(loaded.state);
}

/**
 * Staff Hiring Market — unemployed staff and open owner offers.
 */
export async function loadStaffHiringMarketView(
  saveId: string,
  store?: SaveGameStore,
): Promise<StaffHiringMarketView | null> {
  const loaded = await getStore(store).load(saveId);
  if (!loaded) {
    return null;
  }
  return toStaffHiringMarketView(loaded.state);
}

/**
 * Player Development Hub — who is changing on the roster.
 */
export async function loadDevelopmentHubView(
  saveId: string,
  store?: SaveGameStore,
): Promise<DevelopmentHubView | null> {
  const loaded = await getStore(store).load(saveId);
  if (!loaded) {
    return null;
  }
  return toDevelopmentHubView(loaded.state);
}

/**
 * Franchise Development League Hub.
 */
export async function loadDevelopmentLeagueHubView(
  saveId: string,
  store?: SaveGameStore,
): Promise<DevelopmentLeagueDashboardView | null> {
  const loaded = await getStore(store).load(saveId);
  if (!loaded) {
    return null;
  }
  return toDevelopmentLeagueDashboardView(loaded.state);
}

/**
 * Finance Hub — position, performance, commitments, activity, trend.
 */
export async function loadFinanceHubView(
  saveId: string,
  store?: SaveGameStore,
): Promise<FinanceHubView | null> {
  const loaded = await getStore(store).load(saveId);
  if (!loaded) {
    return null;
  }
  return toFinanceHubView(loaded.state);
}

/**
 * Franchise Hub — long-term organizational state.
 */
export async function loadFranchiseHubView(
  saveId: string,
  store?: SaveGameStore,
): Promise<
  (FranchiseHubView & { situations: OwnerDashboardSituationView[] }) | null
> {
  const loaded = await getStore(store).load(saveId);
  if (!loaded) {
    return null;
  }
  return {
    ...toFranchiseHubView(loaded.state),
    // Franchise situations (relocation pressure, objectives at risk) live here.
    situations: buildSituationsView(loaded.state),
  };
}

/**
 * Franchise Ownership tab — ownership mood, season notes and objective record.
 */
export async function loadFranchiseOwnershipView(
  saveId: string,
  store?: SaveGameStore,
): Promise<FranchiseOwnershipView | null> {
  const loaded = await getStore(store).load(saveId);
  if (!loaded) {
    return null;
  }
  return toFranchiseOwnershipView(loaded.state);
}

/**
 * Transactions Hub — factual seasonEventLog ledger.
 */
export async function loadTransactionHubView(
  saveId: string,
  options: {
    group?: TransactionFilterGroup;
    teamParam?: string;
    range?: TransactionDateRangeKey;
    search?: string;
    limit?: number;
    sort?: TransactionSortKey;
    activityMode?: TransactionActivityMode;
    start?: string;
    end?: string;
  } = {},
  store?: SaveGameStore,
): Promise<TransactionHubView | null> {
  const loaded = await getStore(store).load(saveId);
  if (!loaded) {
    return null;
  }
  const state = loaded.state;
  const myTeamId = getActiveOwnerTeamId(state);
  let teamId: string | null = null;
  const teamParam = options.teamParam;
  if (teamParam && teamParam !== "all") {
    teamId = teamParam === "my" ? myTeamId : teamParam;
  }
  return toTransactionHubView(state, {
    group: options.group ?? "all",
    teamId,
    range: options.range ?? "season",
    start: options.start,
    end: options.end,
    search: options.search ?? "",
    limit: options.limit ?? TRANSACTION_HUB_PAGE_SIZE,
    sort: options.sort ?? "newest",
    activityMode: options.activityMode ?? "league",
  });
}

/**
 * Standings hub (groups, leaders, playoff race) from a single save load.
 */
export async function loadStandingsPageView(
  saveId: string,
  search: {
    view?: string | string[];
    stats?: string | string[];
  } = {},
  store?: SaveGameStore,
) {
  const loaded = await getStore(store).load(saveId);
  if (!loaded) {
    return null;
  }
  const options = parseStandingsPageParams(search, {
    divisionsEnabled: loaded.state.settings.league.divisionsEnabled,
  });
  return {
    standings: toStandingsPageView(loaded.state, options),
    leaders: toLeagueLeadersView(loaded.state),
    playoffRace: toPlayoffRaceView(loaded.state),
  };
}

/**
 * League page Team Stats tab: per-team regular-season averages.
 */
export async function loadLeagueTeamStatsView(
  saveId: string,
  search: { sort?: string | string[]; dir?: string | string[] } = {},
  store?: SaveGameStore,
): Promise<TeamStatsView | null> {
  const loaded = await loadSaveWithHistory(saveId, store);
  if (!loaded) {
    return null;
  }
  return toTeamStatsView(
    loaded.state,
    parseLeagueStatsSort(search, TEAM_STAT_KEYS, "ppg"),
  );
}

/**
 * League page Player Stats tab: qualified players' regular-season averages.
 */
export async function loadLeaguePlayerStatsView(
  saveId: string,
  search: {
    sort?: string | string[];
    dir?: string | string[];
    show?: string | string[];
  } = {},
  store?: SaveGameStore,
): Promise<PlayerStatsView | null> {
  const loaded = await loadSaveWithHistory(saveId, store);
  if (!loaded) {
    return null;
  }
  return toPlayerStatsView(loaded.state, {
    sort: parseLeagueStatsSort(search, PLAYER_STAT_KEYS, "ppg"),
    showAll: firstSearchParam(search.show) === "all",
  });
}

/**
 * League-wide schedule browser (Around Today).
 */
export async function loadLeagueScheduleView(
  saveId: string,
  filters: LeagueScheduleFilters = {},
  store?: SaveGameStore,
): Promise<LeagueScheduleView | null> {
  const loaded = await loadSaveWithHistory(saveId, store);
  if (!loaded) {
    return null;
  }
  return toLeagueScheduleView(loaded.state, filters);
}

/**
 * Media Hub page model: one page of the league timeline for the active owned
 * franchise, plus scores, trending tags and buzz.
 */
export async function loadMediaPageView(
  saveId: string,
  options: MediaTimelinePageOptions = {},
  store?: SaveGameStore,
): Promise<MediaTimelinePageView | null> {
  const loaded = await getStore(store).load(saveId);
  if (!loaded) {
    return null;
  }
  return toMediaTimelinePageView(loaded.state, saveId, options);
}

/** In-game Settings pages (Issue #191). */
export async function loadSettingsView(
  saveId: string,
  selection?: { teamId?: string; playerId?: string },
  store?: SaveGameStore,
): Promise<SettingsView | null> {
  const loaded = await getStore(store).load(saveId);
  if (!loaded) {
    return null;
  }
  return toSettingsView(loaded.state, selection);
}
