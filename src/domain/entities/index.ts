export type { League, LeagueInput } from "@/domain/entities/league";
export { createLeague } from "@/domain/entities/league";
export type { Conference, ConferenceInput } from "@/domain/entities/conference";
export { createConference } from "@/domain/entities/conference";
export type { Division, DivisionInput } from "@/domain/entities/division";
export { createDivision } from "@/domain/entities/division";
export type {
  Team,
  TeamInput,
  TeamFinanceState,
  TeamPlayStyle,
} from "@/domain/entities/team";
export {
  createTeam,
  TEAM_PLAY_STYLE_KEYS,
  NEUTRAL_TEAM_PLAY_STYLE,
} from "@/domain/entities/team";
export type {
  TeamBranding,
  TeamBrandingValidation,
  TeamColorPaletteId,
  TeamLogoId,
} from "@/domain/entities/team-branding";
export {
  assertTeamBranding,
  brandingFromPalette,
  isHexColor,
  isTeamColorPaletteId,
  isTeamLogoId,
  isValidTeamBranding,
  normalizeHexColor,
  resolvePaletteIdFromBranding,
  validateTeamBranding,
} from "@/domain/entities/team-branding";
export type {
  PacePhilosophy,
  OffensiveEmphasis,
  DefensiveApproach,
  CoachingPhilosophy,
} from "@/domain/coaching/coaching-philosophy";
export {
  PACE_PHILOSOPHIES,
  OFFENSIVE_EMPHASES,
  DEFENSIVE_APPROACHES,
  DEFAULT_COACHING_PHILOSOPHY,
  isPacePhilosophy,
  isOffensiveEmphasis,
  isDefensiveApproach,
  isCoachingPhilosophy,
} from "@/domain/coaching/coaching-philosophy";
export type { CoachingModifiers } from "@/domain/coaching/coaching-philosophy-config";
export {
  COACHING_PHILOSOPHY_CONFIG,
  getCoachingModifiers,
} from "@/domain/coaching/coaching-philosophy-config";
export type {
  Player,
  PlayerInput,
  PlayerPosition,
  PlayerArchetype,
  PlayerNationality,
  PlayerAttributes,
  PlayerPotential,
  PlayerPersonality,
  InjuryStatus,
  DevelopmentStage,
  DevelopmentState,
} from "@/domain/entities/player";
export {
  RATING_MIN,
  RATING_MAX,
  PLAYER_POSITIONS,
  PLAYER_ATTRIBUTE_KEYS,
  createPlayer,
} from "@/domain/entities/player";
export {
  PLAYER_ARCHETYPES,
  ARCHETYPE_LABELS,
  ARCHETYPE_COMPATIBLE_POSITIONS,
  POSITION_ATTRIBUTE_WEIGHTS,
  ARCHETYPE_ATTRIBUTE_WEIGHTS,
  WEIGHT_WEAK,
  WEIGHT_AVERAGE,
  WEIGHT_SECONDARY,
  WEIGHT_STRONG,
  isPlayerArchetype,
  isArchetypeCompatible,
  compatibleArchetypesForPosition,
  combinedAttributeWeights,
} from "@/domain/entities/player-archetype";
export type { AttributeWeights } from "@/domain/entities/player-archetype";
export type { OffensiveRole } from "@/domain/entities/offensive-role";
export {
  OFFENSIVE_ROLES,
  OFFENSIVE_ROLE_LABELS,
  isOffensiveRole,
} from "@/domain/entities/offensive-role";
export {
  PLAYER_NATIONALITIES,
  NATIONALITY_LABELS,
  isPlayerNationality,
} from "@/domain/entities/player-nationality";
export {
  calculatePlayerOverall,
  CATEGORY_MIX,
  SKILL_WEIGHTS,
  PHYSICAL_WEIGHTS,
  MENTAL_WEIGHTS,
} from "@/domain/player-overall-rating";
export type {
  SkillAttributeKey,
  PhysicalAttributeKey,
  MentalAttributeKey,
  CategoryMix,
} from "@/domain/player-overall-rating";
export type { Coach, CoachInput } from "@/domain/entities/coach";
export { createCoach } from "@/domain/entities/coach";
export type {
  Staff,
  StaffRole,
  StaffStrength,
  StaffWeakness,
  StaffInput,
} from "@/domain/entities/staff";
export {
  STAFF_ROLES,
  TIER1_STAFF_ROLES,
  createStaff,
  assertStaffShape,
  isStaffRole,
} from "@/domain/entities/staff";
export type {
  StaffContract,
  StaffContractInput,
} from "@/domain/entities/staff-contract";
export {
  createStaffContract,
  assertStaffContractShape,
  getStaffContractSalaryForYear,
  isStaffContractActive,
} from "@/domain/entities/staff-contract";
export type {
  Contract,
  ContractInput,
  ContractOption,
  ContractOptionStatus,
  ContractStatus,
} from "@/domain/entities/contract";
export {
  CONTRACT_OPTION_STATUSES,
  assertContractShape,
  createContract,
  declinePlayerOption,
  declineTeamOption,
  exercisePlayerOption,
  exerciseTeamOption,
  getContractLength,
  getContractSalaryForYear,
  getContractStatus,
  isContractActive,
  isContractExpired,
} from "@/domain/entities/contract";
export type {
  DraftPick,
  DraftPickInput,
  DraftPickRound,
} from "@/domain/entities/draft-pick";
export {
  DRAFT_PICK_ROUNDS,
  createDraftPick,
  draftPickIdFor,
} from "@/domain/entities/draft-pick";
export type {
  DraftClass,
  DraftLifecycleStatus,
  DraftOrderSlot,
  DraftOrderSlotStatus,
  DraftProspect,
  DraftProspectStatus,
  DraftScoutReport,
  DraftSelection,
} from "@/domain/entities/draft";
export {
  DRAFT_LIFECYCLE_STATUSES,
  DRAFT_ORDER_SLOT_STATUSES,
  DRAFT_PROSPECT_STATUSES,
  createDraftOrderSlot,
  createDraftProspect,
  createDraftScoutReport,
  createDraftSelection,
  createEmptyDraftClass,
  draftClassIdFor,
  isDraftLifecycleStatus,
  isDraftOrderSlotStatus,
  isDraftProspectStatus,
} from "@/domain/entities/draft";
export type {
  TradeBlock,
  TradeBlockAsset,
  TradeBlockStatus,
} from "@/domain/entities/trade-block";
export {
  TRADE_BLOCK_STATUSES,
  DEFAULT_TRADE_BLOCK_STATUS,
  createEmptyTradeBlock,
  isTradeBlockStatus,
} from "@/domain/entities/trade-block";
export type {
  TradeProposal,
  TradeSide,
} from "@/domain/entities/trade-proposal";
export { tradeSideAssetCount } from "@/domain/entities/trade-proposal";
export type {
  OwnerDecisionRecord,
  OwnerDecisionSource,
  OwnerDecisionStatus,
  OwnerDecisionType,
  PendingOwnerDecision,
  TradeOfferDecisionPayload,
} from "@/domain/entities/owner-decision";
export {
  OWNER_DECISION_HISTORY_MAX,
  TRADE_OFFER_REJECTION_COOLDOWN_DAYS,
  assetsRelativeToUser,
  getActiveOwnerDecision,
  getPendingTradeOffers,
  hasActiveOwnerDecision,
  tradeOfferFingerprint,
} from "@/domain/entities/owner-decision";
export type {
  FreeAgencyOffer,
  FreeAgencyOfferInput,
  FreeAgencyOfferStatus,
} from "@/domain/entities/free-agency-offer";
export {
  FREE_AGENCY_OFFER_STATUSES,
  OPEN_FREE_AGENCY_OFFER_STATUSES,
  TERMINAL_FREE_AGENCY_OFFER_STATUSES,
  assertFreeAgencyOfferShape,
  createFreeAgencyOffer,
  isOpenOffer,
  isTerminalOffer,
} from "@/domain/entities/free-agency-offer";
export type {
  PlayerInterest,
  PlayerInterestFactor,
  EvaluatePlayerInterest,
} from "@/domain/free-agency/player-interest";
export {
  PLAYER_INTEREST_FACTORS,
  emptyInterestFactors,
} from "@/domain/free-agency/player-interest";
export type {
  Game,
  GameInput,
  GameStatus,
  GameScore,
  GameEvent,
  GameEventType,
  GamePlayerStats,
  GameCompetitionType,
  GameTeamSnapshot,
} from "@/domain/entities/game";
export {
  GAME_STATUSES,
  GAME_EVENT_TYPES,
  GAME_COMPETITION_TYPES,
  createGame,
  createEmptyGamePlayerStats,
} from "@/domain/entities/game";
export type { StatInvariantFailure } from "@/domain/entities/game-stat-invariants";
export {
  checkShootingStatInvariants,
  checkNonNegativeBoxScoreFields,
  checkPlayerTeamAggregation,
  checkPlayerPointsEqualScore,
} from "@/domain/entities/game-stat-invariants";
export {
  validateCompletedGameBoxScore,
  assertCompletedGameBoxScore,
} from "@/domain/entities/game-box-score";
export type {
  GameResult,
  GameResultInput,
  GameTeamStats,
  PossessionCounts,
} from "@/domain/entities/game-result";
export {
  createGameResult,
  aggregateTeamStats,
} from "@/domain/entities/game-result";
export type {
  Possession,
  PossessionInput,
  PossessionAction,
  PossessionOutcome,
} from "@/domain/entities/possession";
export {
  POSSESSION_ACTIONS,
  POSSESSION_OUTCOMES,
  createPossession,
} from "@/domain/entities/possession";
export type { Foul, FoulInput, FoulType } from "@/domain/entities/foul";
export { FOUL_TYPES, createFoul } from "@/domain/entities/foul";
export type {
  Season,
  SeasonPhase,
  OffseasonStage,
} from "@/domain/entities/season";
export {
  SEASON_PHASES,
  OFFSEASON_STAGES,
  isSeasonPhase,
  isOffseasonStage,
} from "@/domain/entities/season";
export type {
  ScheduledEvent,
  ScheduledEventType,
  ScheduledEventStatus,
} from "@/domain/entities/scheduled-event";
export {
  SCHEDULED_EVENT_TYPES,
  SCHEDULED_EVENT_STATUSES,
  isScheduledEventType,
  isScheduledEventStatus,
} from "@/domain/entities/scheduled-event";
export type { Schedule } from "@/domain/entities/schedule";
export type {
  PlayoffTournamentStatus,
  PlayoffSeriesStatus,
  PlayoffSeed,
  PlayoffSeries,
  PlayoffTournament,
} from "@/domain/entities/playoffs";
export {
  createEmptyPlayoffTournament,
  playoffRoundLabel,
} from "@/domain/entities/playoffs";
export type {
  StandingStreak,
  Standings,
  TeamStanding,
} from "@/domain/entities/standings";
export { createEmptyTeamStanding } from "@/domain/entities/standings";
export type {
  ExpenseCategory,
  RevenueCategory,
  TeamFinanceBooks,
  TeamFinances,
  TeamFinancialStatement,
} from "@/domain/entities/finances";
export {
  EXPENSE_CATEGORIES,
  REVENUE_CATEGORIES,
  createEmptyTeamFinanceBooks,
  isExpenseCategory,
  isRevenueCategory,
} from "@/domain/entities/finances";
export type { Calendar } from "@/domain/entities/calendar";
export type {
  OwnerObjective,
  OwnerObjectiveCategory,
  OwnerObjectiveInput,
  OwnerObjectiveLifecycle,
  OwnerObjectiveRole,
  OwnerObjectiveStatus,
  OwnerObjectiveType,
} from "@/domain/entities/owner-objective";
export {
  OWNER_OBJECTIVE_TYPES,
  OWNER_OBJECTIVE_STATUSES,
  OWNER_OBJECTIVE_CATEGORIES,
  OWNER_OBJECTIVE_LIFECYCLES,
  OWNER_OBJECTIVE_ROLES,
  isOwnerObjectiveType,
  isOwnerObjectiveStatus,
  isOwnerObjectiveCategory,
  isOwnerObjectiveLifecycle,
  isOwnerObjectiveRole,
  createOwnerObjective,
} from "@/domain/entities/owner-objective";
export type { OwnerPhilosophy } from "@/domain/entities/owner-philosophy";
export {
  OWNER_PHILOSOPHIES,
  DEFAULT_OWNER_PHILOSOPHY,
  OWNER_PATIENCE_MIN,
  OWNER_PATIENCE_MAX,
  isOwnerPhilosophy,
} from "@/domain/entities/owner-philosophy";
export type {
  OwnerNotification,
  OwnerNotificationInput,
  OwnerNotificationSeverity,
  OwnerNotificationType,
} from "@/domain/entities/owner-notification";
export {
  OWNER_NOTIFICATION_TYPES,
  OWNER_NOTIFICATION_SEVERITIES,
  isOwnerNotificationType,
  isOwnerNotificationSeverity,
  createOwnerNotification,
} from "@/domain/entities/owner-notification";
export type {
  NarrativeCategory,
  NarrativeEvidence,
  NarrativeMonthSnapshot,
  NarrativeSeverity,
  NarrativeSituation,
  NarrativeSituationAction,
  NarrativeSituationInput,
  NarrativeSituationRelated,
  NarrativeSituationStatus,
  NarrativeSituationUpdate,
  NarrativeState,
} from "@/domain/entities/narrative-situation";
export {
  NARRATIVE_CATEGORIES,
  NARRATIVE_SEVERITIES,
  NARRATIVE_SITUATION_STATUSES,
  NARRATIVE_UPDATES_MAX,
  NARRATIVE_SITUATIONS_MAX,
  NARRATIVE_SNAPSHOTS_MAX,
  isNarrativeCategory,
  isNarrativeSeverity,
  isNarrativeSituationStatus,
  createNarrativeSituation,
  createEmptyNarrativeState,
} from "@/domain/entities/narrative-situation";
