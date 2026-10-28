import "server-only";
import type { DashboardMomentsView } from "@/state/dashboard-moments";
import type { TransactionTickerView } from "@/state/transaction-ticker-selectors";
import type { SaveGameSummary } from "@/persistence/save-game-store";
import type {
  DashboardSnapshot,
  TeamListEntry,
  CityPickOption,
  RosterPlayerView,
  StandingRowView,
  FreeAgentView,
  FreeAgencyOfferView,
  DraftBoardView,
  ObjectiveView,
  NotificationView,
  EventLogEntryView,
  ScheduleGameView,
  ContractRowView,
  FinancesView,
} from "@/state/selectors";
import type { OwnerNavGroup } from "@/application/owner-nav-config";
import type { DomainEvent } from "@/domain/events";
import type { AdvanceSimulationResult } from "@/systems/simulation/types";
import type { TradeFinderCandidate } from "@/systems/trades";
import {
  toStaffView,
  type FacilityRowView,
  type FranchiseBusinessView,
  type SponsorshipView,
  type FranchiseHistoryView,
} from "@/state/franchise-selectors";
import type { FranchisePnLView } from "@/state/franchise-pnl";
import type { LeagueEconomy } from "@/domain/entities/league-economy";
import type { RelocationProcess } from "@/domain/entities/relocation";
import type { ExpansionState } from "@/domain/entities/expansion";
import type { RelocationAssessment } from "@/state/relocation-assessment";
import type { ExpansionAssessment } from "@/state/expansion-assessment";
import type { OwnerDashboardView } from "@/state/owner-dashboard";
import type { PhaseDashboardView } from "@/state/phase-dashboard";
import type { GameSettings } from "@/domain/game-settings";
import { toLeagueAwardsView } from "@/state/award-selectors";

/** Max Owner Mode SaveGame rows. Current-count cap, not a lifetime counter. */
export const MAX_OWNER_SAVE_SLOTS = 10;

export type CreateGameResult = {
  save: SaveGameSummary;
  dashboard: DashboardSnapshot;
  navGroups?: readonly OwnerNavGroup[];
  /** Moments the dashboard layout may auto-open (loadOwnerSave only). */
  moments?: DashboardMomentsView;
  /** Deadline / free agency ticker (loadOwnerSave only). */
  ticker?: TransactionTickerView | null;
};

export type OwnerCommandSuccess<T extends object = object> = {
  ok: true;
  save: SaveGameSummary;
  dashboard: DashboardSnapshot;
} & T;

export type OwnerCommandFailure = {
  ok: false;
  error: string;
};

export type OwnerCommandResult<T extends object = object> =
  OwnerCommandSuccess<T> | OwnerCommandFailure;

export type AdvanceDayResult = CreateGameResult & {
  events: DomainEvent[];
  simulation: Omit<AdvanceSimulationResult, "state" | "events">;
};

export type OwnerSaveView = CreateGameResult & {
  teams: TeamListEntry[];
  cities: CityPickOption[];
  roster: RosterPlayerView[];
  standings: StandingRowView[];
  freeAgents: FreeAgentView[];
  freeAgencyOffers: FreeAgencyOfferView[];
  openFreeAgencyOffers: FreeAgencyOfferView[];
  draftBoard: DraftBoardView | null;
  tradeCandidates: TradeFinderCandidate[];
  objectives: ObjectiveView[];
  notifications: NotificationView[];
  eventLog: EventLogEntryView[];
  schedule: ScheduleGameView[];
  contracts: ContractRowView[];
  finances: FinancesView;
  staff: ReturnType<typeof toStaffView>;
  facilities: FacilityRowView[];
  franchiseBusiness: FranchiseBusinessView;
  franchisePnL: FranchisePnLView;
  sponsorships: SponsorshipView[];
  leagueEconomy: LeagueEconomy;
  relocation: RelocationProcess;
  expansion: ExpansionState;
  relocationAssessment: RelocationAssessment;
  expansionAssessment: ExpansionAssessment;
  franchiseHistory: FranchiseHistoryView;
  ownerDashboard: OwnerDashboardView;
  phaseDashboard: PhaseDashboardView;
  /** Persisted career settings from GameState.settings (read-only for UI). */
  settings: GameSettings;
  leagueAwards: ReturnType<typeof toLeagueAwardsView>;
  teamHub: import("@/state/team-hub-selectors").TeamHubView;
};
