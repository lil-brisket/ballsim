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
export type { Coach } from "@/domain/entities/coach";
export type { Staff, StaffRole } from "@/domain/entities/staff";
export type { Contract } from "@/domain/entities/contract";
export type {
  Game,
  GameInput,
  GameStatus,
  GameScore,
  GameEvent,
  GameEventType,
  GamePlayerStats,
} from "@/domain/entities/game";
export {
  GAME_STATUSES,
  GAME_EVENT_TYPES,
  createGame,
  createEmptyGamePlayerStats,
} from "@/domain/entities/game";
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
export type { Season, SeasonPhase } from "@/domain/entities/season";
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
export type { TeamFinances } from "@/domain/entities/finances";
export type { Calendar } from "@/domain/entities/calendar";
export type {
  OwnerObjective,
  OwnerObjectiveInput,
  OwnerObjectiveType,
} from "@/domain/entities/owner-objective";
export {
  OWNER_OBJECTIVE_TYPES,
  isOwnerObjectiveType,
  createOwnerObjective,
} from "@/domain/entities/owner-objective";
