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
export { generateSchedule } from "@/systems/schedule-generation";
export { advanceCalendar } from "@/systems/calendar";
export { simulateGamesForDate } from "@/systems/game-simulation";
export { updateStandings } from "@/systems/standings";
export {
  bootstrapWorld,
  runWorldPipeline,
  type WorldPipelineCommand,
} from "@/systems/world-pipeline";
