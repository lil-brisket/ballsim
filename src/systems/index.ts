export { generateRosters } from "@/systems/roster-generation";
export {
  generateLeague,
  deriveLeagueAbbreviation,
  type LeagueGenerationConfig,
  type GeneratedLeague,
} from "@/systems/league-generation";
export {
  DEFAULT_ROSTER_SIZE,
  rosterPositionForSlot,
} from "@/systems/roster-generation-config";
export {
  createRosterRulesConfig,
  validateRosterRulesConfig,
  validateRosterSize,
  validateRoster,
  validateStartingLineup,
  validateBench,
  validateInactivePlayers,
  type RosterRulesConfig,
  type RosterRulesConfigInput,
  type RosterAssignment,
} from "@/systems/roster-rules";
export {
  generatePlayer,
  generatePlayerWithRng,
  type GeneratePlayerOptions,
} from "@/systems/player-generation";
export { developPlayer } from "@/systems/player-development";
export {
  SHOT_RESOLUTION_CONFIG,
  SHOT_TYPES,
  type ShotType,
} from "@/systems/shot-resolution-config";
export {
  calculateShotProbability,
  resolveShot,
  type ResolveShotInput,
  type ShotResolution,
} from "@/systems/shot-resolution";
export {
  REBOUND_RESOLUTION_CONFIG,
  POSITION_REBOUND_MODIFIERS,
} from "@/systems/rebound-resolution-config";
export {
  playerReboundBaseStrength,
  resolveRebound,
  type ReboundType,
  type ResolveReboundInput,
  type ReboundCandidateScore,
  type ReboundResult,
} from "@/systems/rebound-resolution";
export { PASS_RESOLUTION_CONFIG } from "@/systems/pass-resolution-config";
export {
  calculatePassProbabilities,
  resolvePass,
  type ResolvePassInput,
  type PassProbabilities,
  type PassResolution,
} from "@/systems/pass-resolution";
export {
  FOUL_RESOLUTION_CONFIG,
  type FoulRules,
} from "@/systems/foul-resolution-config";
export {
  resolveFoul,
  validateFoulRules,
  type ResolveFoulInput,
  type FoulResolution,
} from "@/systems/foul-resolution";
export { FREE_THROW_RESOLUTION_CONFIG } from "@/systems/free-throw-resolution-config";
export {
  calculateFreeThrowProbability,
  resolveFreeThrow,
  type ResolveFreeThrowInput,
  type FreeThrowResult,
} from "@/systems/free-throw-resolution";
export {
  resolvePossessionDecision,
  type PossessionDecision,
  type PossessionDecisionContext,
  type ResolvedPossessionDecision,
} from "@/systems/possession-decision";
export {
  applyPossessionResolution,
  addTouch,
  type PlayerStatsDelta,
} from "@/systems/possession-stats";
export {
  resolvePossession,
  type ResolvePossessionInput,
  type PossessionStep,
  type NextPossession,
  type PossessionResolution,
} from "@/systems/possession-resolution";
export {
  generateSchedule,
  generateSeasonSchedule,
} from "@/systems/schedule-generation";
export {
  MIN_TEAM_COUNT,
  defaultSeasonLength,
  expectedRoundCount,
  validateSeasonScheduleConfig,
  type SeasonScheduleConfig,
  type SeasonScheduleAssignment,
} from "@/systems/schedule-generation-config";
export { validateSeasonSchedule } from "@/systems/schedule-validation";
export { advanceCalendar } from "@/systems/calendar";
export {
  simulateGame,
  simulateGamesForDate,
  requestPossessionSeconds,
  type SimulateGameContext,
} from "@/systems/game-simulation";
export {
  GAME_SIMULATION_CONFIG,
  mergeGameSimulationConfig,
  type GameSimulationConfig,
} from "@/systems/game-simulation-config";
export {
  createGameClock,
  consumeTime,
  resetPeriodClock,
  isPeriodOver,
  type GameClock,
} from "@/systems/game-clock";
export { choosePossessionDecision, getShotSelectionWeights } from "@/systems/possession-decision-selection";
export type {
  ShotSelectionModifiers,
  ShotSelectionWeight,
} from "@/systems/possession-decision-selection";
export {
  PLAYER_USAGE_CONFIG,
  USAGE_SCORE_FLOOR,
  mergePlayerUsageConfig,
  type PlayerUsageConfig,
} from "@/systems/player-usage-config";
export {
  scoringAbility,
  creationAbility,
  calculateUsageScore,
  roleMultiplier,
  computeShotWeight,
  computePassWeight,
  computeInvolvementWeight,
  assignOffensiveRoles,
  buildOffensiveUsageProfiles,
  normalizeShares,
  normalizeUsageProfiles,
  pickByWeight,
  pickWeightedPlayer,
  type PlayerUsageProfile,
  type NormalizedUsageShares,
} from "@/systems/player-usage";
export { updateStandings } from "@/systems/standings";
export {
  bootstrapWorld,
  runWorldPipeline,
  type WorldPipelineCommand,
} from "@/systems/world-pipeline";
