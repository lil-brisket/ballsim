import type { Calendar } from "@/domain/entities/calendar";
import type { Coach } from "@/domain/entities/coach";
import type { Conference } from "@/domain/entities/conference";
import type { Contract } from "@/domain/entities/contract";
import type { Division } from "@/domain/entities/division";
import type { DraftPick } from "@/domain/entities/draft-pick";
import type { DraftClass } from "@/domain/entities/draft";
import type { FantasyDraft } from "@/domain/entities/fantasy-draft";
import type { ExpansionState } from "@/domain/entities/expansion";
import type { FreeAgencyOffer } from "@/domain/entities/free-agency-offer";
import type { FranchiseHistory } from "@/domain/entities/franchise-history";
import type { FranchiseOps } from "@/domain/entities/franchise-ops";
import type { FranchiseReportCache } from "@/domain/entities/annual-franchise-report";
import type { TeamFinances } from "@/domain/entities/finances";
import type { Game } from "@/domain/entities/game";
import type { GameArchive } from "@/domain/entities/game-archive";
import type { League } from "@/domain/entities/league";
import type { LeagueEconomy } from "@/domain/entities/league-economy";
import type {
  OwnerDecisionRecord,
  PendingOwnerDecision,
} from "@/domain/entities/owner-decision";
import type { OwnerNotification } from "@/domain/entities/owner-notification";
import type { OwnerObjective } from "@/domain/entities/owner-objective";
import type { OwnershipConfidenceState } from "@/domain/entities/ownership-confidence";
import type { NarrativeState } from "@/domain/entities/narrative-situation";
import type { Player } from "@/domain/entities/player";
import type { PlayerHistory } from "@/domain/entities/player-history";
import type { PlayoffTournament } from "@/domain/entities/playoffs";
import type { RelocationProcess } from "@/domain/entities/relocation";
import type { Schedule } from "@/domain/entities/schedule";
import type { Season } from "@/domain/entities/season";
import type { Sponsorship } from "@/domain/entities/sponsorship";
import type { Staff } from "@/domain/entities/staff";
import type { StaffContract } from "@/domain/entities/staff-contract";
import type { Standings } from "@/domain/entities/standings";
import type { Team } from "@/domain/entities/team";
import type { ScheduledEvent } from "@/domain/entities/scheduled-event";
import type { TradeBlock } from "@/domain/entities/trade-block";
import type {
  AiAssistancePhases,
  AiManagementPreset,
} from "@/domain/ai-management-presets";
import type { GameSettings } from "@/domain/game-settings";
import type { DomainEvent } from "@/domain/events";
import type { SaveId, TeamId } from "@/domain/ids";
import type {
  CompetitionPhaseState,
  FranchisePhaseState,
} from "@/systems/phase-engine/phase-types";

export const GAME_STATE_SCHEMA_VERSION = 49;

/** Bounded recent history for Owner Mode activity / transactions UI. */
export const EVENT_LOG_MAX = 1_000;

export type GameMode = "owner";

export type MetaSlice = {
  saveId: SaveId;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
  /** Original seed for the save (reproducibility / debugging). */
  rngSeed: number;
  /** Current PRNG internal state; resume streams across advances. */
  rngState: number;
};

export type WorldSlice = {
  calendar: Calendar;
  league: League;
  conferences: Record<string, Conference>;
  divisions: Record<string, Division>;
  teams: Record<string, Team>;
  players: Record<string, Player>;
  coaches: Record<string, Coach>;
  staff: Record<string, Staff>;
  draftPicks: Record<string, DraftPick>;
  drafts: Record<string, DraftClass>;
  /** Startup fantasy draft; null when league uses standard roster generation. */
  fantasyDraft: FantasyDraft | null;
  scheduledEvents: Record<string, ScheduledEvent>;
};

export type CompetitionSlice = {
  season: Season;
  /**
   * Authoritative hierarchical league phase pointer (schema v49+).
   * Prefer this over season.offseasonStage for phase engine logic.
   */
  phase: CompetitionPhaseState;
  schedule: Schedule;
  games: Record<string, Game>;
  standings: Standings;
  playoffs: PlayoffTournament;
  /**
   * League-wide transaction feed for the current season.
   * Every transaction-level event (AI or user), regardless of active franchise.
   * Cleared on season rollover. Bounded; not a finance/roster authority.
   */
  seasonEventLog: DomainEvent[];
};

/** Max entries retained in competition.seasonEventLog. */
export const SEASON_EVENT_LOG_MAX = 2_000;

export type FreeAgencyState = {
  /** Historical offers; resolution changes status, never deletes. */
  offers: Record<string, FreeAgencyOffer>;
};

export type BusinessSlice = {
  contracts: Record<string, Contract>;
  finances: Record<string, TeamFinances>;
  freeAgency: FreeAgencyState;
  tradeBlocks: Record<string, TradeBlock>;
  /** Staff employment terms (separate from player contracts). */
  staffContracts: Record<string, StaffContract>;
  /** Commercial sponsorships (separate from player/staff contracts). */
  sponsorships: Record<string, Sponsorship>;
  /** Per-team operational knobs + slow franchise metrics. */
  franchiseOps: Record<string, FranchiseOps>;
  leagueEconomy: LeagueEconomy;
  relocationByTeamId: Record<string, RelocationProcess>;
  expansion: ExpansionState;
  franchiseHistory: Record<string, FranchiseHistory>;
  /**
   * Immutable annual report snapshots keyed by teamId → seasonYear.
   * Separate from franchiseHistory (facts vs interpretation).
   */
  franchiseReportCache: FranchiseReportCache;
  /**
   * Authoritative completed games across seasons.
   * Populated at season_finalization before competition.games is wiped.
   */
  gameArchive: GameArchive;
  /**
   * Per-player season-end snapshots (not game logs).
   * Career highs / stints are derived from gameArchive.
   */
  playerHistory: Record<string, PlayerHistory>;
};

/**
 * Per-franchise owner identity and owner-mode runtime state.
 * Does NOT include pendingOwnerDecisions (those live on UserSlice).
 */
export type OwnedFranchiseState = {
  /** 0–100 mandate patience; starts from default mandate profile. */
  ownerPatience: number;
  /**
   * Ownership confidence / strategic friction narrative.
   * Expectations are derived; this stores evidence, mood, and season notes.
   */
  ownershipConfidence: OwnershipConfidenceState;
  objectives: OwnerObjective[];
  /** Owner narrative situations, month snapshots, and cooldowns. */
  narrative: NarrativeState;

  notifications: OwnerNotification[];
  /**
   * Append-only recent domain events for Owner activity/transactions.
   * Not authoritative for finance/roster/contracts/competition.
   * Bounded to {@link EVENT_LOG_MAX} most recent entries.
   */
  eventLog: DomainEvent[];
  /** Deterministic keys for applied gameplay/AI consequences (idempotency). */
  appliedGameplayConsequenceKeys: Record<string, true>;
  /**
   * Explicit owner decisions AI continuity must not override
   * (e.g. declined_fa:${playerId}).
   */
  explicitDecisions: Record<string, true>;
  /** Recorded phase skips when the owner continues past unresolved decisions. */
  phaseSkips: Array<{ phaseKey: string; skippedOn: string; reason: string }>;

  /** AI management configuration — what the player allows AI to do. */
  aiAssistance: AiAssistancePhases;
  managementPreset: AiManagementPreset;

  /** AI runtime state — cooldowns, season counters, resolved-need fingerprints. */
  aiAssistState: AiAssistRuntimeState;

  /**
   * True after the owner finalizes city selection on the new-game pick screen.
   * Distinct from time-advance lock; rejects further city relocation at pick.
   */
  citySelectionConfirmed: boolean;
  /**
   * True after owner completes initial team identity setup (branding screen).
   * ONBOARDING ONLY — does not mean branding is permanently locked.
   */
  franchiseIdentityConfirmed: boolean;
  /** Earliest known season year the player controlled this franchise. */
  ownerStartSeasonYear: number;
};

export type UserSlice = {
  /** Teams the player controls (simulation / ownership). */
  ownedTeamIds: TeamId[];
  /** Team the player is currently acting as (UI context only). */
  activeOwnerTeamId: TeamId;
  /** Per-franchise owner state keyed by team id. */
  ownedFranchises: Record<string, OwnedFranchiseState>;
  mode: GameMode;
  /**
   * Save-level decision queue (NOT duplicated per franchise).
   * At most one active blocking decision that pauses simulation.
   */
  pendingOwnerDecisions: PendingOwnerDecision[];
  /** Bounded history of resolved owner decisions + rejection fingerprints. */
  ownerDecisionHistory: OwnerDecisionRecord[];
  /**
   * Per-franchise phase UI dismissals only (schema v49+).
   * Task completion is derived from game state — never persisted here.
   */
  franchisePhaseState: Record<string, FranchisePhaseState>;
};

export type AiAssistResolvedNeed = {
  resolvedOn: string;
  cooldownUntil?: string;
};

export type AiAssistSeasonCounters = {
  seasonYear: number;
  decisions: number;
  rosterMoves: number;
  freeAgentSignings: number;
};

export type AiAssistRuntimeState = {
  resolvedNeeds: Record<string, AiAssistResolvedNeed>;
  seasonCounters: AiAssistSeasonCounters;
};

export const EMPTY_AI_ASSIST_STATE: AiAssistRuntimeState = {
  resolvedNeeds: {},
  seasonCounters: {
    seasonYear: 0,
    decisions: 0,
    rosterMoves: 0,
    freeAgentSignings: 0,
  },
};

/**
 * Authoritative game model for one save.
 * Composed of typed slices to avoid a single undifferentiated object.
 *
 * `settings` is career configuration (how the league works).
 * Other slices hold runtime state (what has happened).
 * `settings.league.teamCount` is the size at career creation — after expansion
 * use `Object.keys(world.teams).length` for the live league size.
 */
export type GameState = {
  meta: MetaSlice;
  settings: GameSettings;
  world: WorldSlice;
  competition: CompetitionSlice;
  business: BusinessSlice;
  user: UserSlice;
};

/**
 * Append newly emitted domain events exactly once for a franchise.
 * Call only when a command/simulation emits events during the same persist.
 * Does not re-append on plain load/save of existing state.
 */
export function appendEventLog(
  state: GameState,
  newlyEmitted: readonly DomainEvent[],
  teamId?: TeamId,
): GameState {
  if (newlyEmitted.length === 0) {
    return state;
  }
  const targetTeamId = teamId ?? state.user.activeOwnerTeamId;
  const franchise = state.user.ownedFranchises[targetTeamId];
  if (!franchise) {
    return state;
  }
  const merged = [...franchise.eventLog, ...newlyEmitted];
  const eventLog =
    merged.length > EVENT_LOG_MAX
      ? merged.slice(merged.length - EVENT_LOG_MAX)
      : merged;
  return {
    ...state,
    user: {
      ...state.user,
      ownedFranchises: {
        ...state.user.ownedFranchises,
        [targetTeamId]: {
          ...franchise,
          eventLog,
        },
      },
    },
  };
}

/**
 * Append transaction-level events to the league-wide season feed.
 * Call at command time after mutation — not inside persistence routing.
 */
export function appendSeasonEventLog(
  state: GameState,
  newlyEmitted: readonly DomainEvent[],
): GameState {
  if (newlyEmitted.length === 0) {
    return state;
  }
  const merged = [...state.competition.seasonEventLog, ...newlyEmitted];
  const seasonEventLog =
    merged.length > SEASON_EVENT_LOG_MAX
      ? merged.slice(merged.length - SEASON_EVENT_LOG_MAX)
      : merged;
  return {
    ...state,
    competition: {
      ...state.competition,
      seasonEventLog,
    },
  };
}
