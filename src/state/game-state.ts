import type { Calendar } from "@/domain/entities/calendar";
import type { Coach } from "@/domain/entities/coach";
import type { Conference } from "@/domain/entities/conference";
import type { Contract } from "@/domain/entities/contract";
import type { Division } from "@/domain/entities/division";
import type { DraftPick } from "@/domain/entities/draft-pick";
import type { DraftClass } from "@/domain/entities/draft";
import type { ExpansionState } from "@/domain/entities/expansion";
import type { FreeAgencyOffer } from "@/domain/entities/free-agency-offer";
import type { FranchiseHistory } from "@/domain/entities/franchise-history";
import type { FranchiseOps } from "@/domain/entities/franchise-ops";
import type { TeamFinances } from "@/domain/entities/finances";
import type { Game } from "@/domain/entities/game";
import type { League } from "@/domain/entities/league";
import type { LeagueEconomy } from "@/domain/entities/league-economy";
import type { OwnerNotification } from "@/domain/entities/owner-notification";
import type { OwnerObjective } from "@/domain/entities/owner-objective";
import type { OwnerPhilosophy } from "@/domain/entities/owner-philosophy";
import type { NarrativeState } from "@/domain/entities/narrative-situation";
import type { Player } from "@/domain/entities/player";
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
import type { GameSettings } from "@/domain/game-settings";
import type { DomainEvent } from "@/domain/events";
import type { SaveId, TeamId } from "@/domain/ids";

export const GAME_STATE_SCHEMA_VERSION = 32;

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
  scheduledEvents: Record<string, ScheduledEvent>;
};

export type CompetitionSlice = {
  season: Season;
  schedule: Schedule;
  games: Record<string, Game>;
  standings: Standings;
  playoffs: PlayoffTournament;
};

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
};

export type UserSlice = {
  controlledTeamId: TeamId;
  mode: GameMode;
  /** Earliest known season year the player controlled this franchise. */
  ownerStartSeasonYear: number;
  /** Ownership mandate; chosen at team pick. Migrated saves default to balanced. */
  ownerPhilosophy: OwnerPhilosophy;
  /** 0–100 mandate patience; starts from philosophy profile default. */
  ownerPatience: number;
  objectives: OwnerObjective[];
  notifications: OwnerNotification[];
  /**
   * Append-only recent domain events for Owner activity/transactions.
   * Not authoritative for finance/roster/contracts/competition.
   * Bounded to {@link EVENT_LOG_MAX} most recent entries.
   */
  eventLog: DomainEvent[];
  /** Deterministic keys for applied gameplay/AI consequences (idempotency). */
  appliedGameplayConsequenceKeys: Record<string, true>;
  /** Owner narrative situations, month snapshots, and cooldowns. */
  narrative: NarrativeState;
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
 * Append newly emitted domain events exactly once.
 * Call only when a command/simulation emits events during the same persist.
 * Does not re-append on plain load/save of existing state.
 */
export function appendEventLog(
  state: GameState,
  newlyEmitted: readonly DomainEvent[],
): GameState {
  if (newlyEmitted.length === 0) {
    return state;
  }
  const merged = [...state.user.eventLog, ...newlyEmitted];
  const eventLog =
    merged.length > EVENT_LOG_MAX
      ? merged.slice(merged.length - EVENT_LOG_MAX)
      : merged;
  return {
    ...state,
    user: {
      ...state.user,
      eventLog,
    },
  };
}
