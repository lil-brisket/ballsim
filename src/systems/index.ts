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
  recommendRosterManagement,
  reconcileRosterManagement,
  getEmergencyLineup,
  getRegulationTeamMinutesTarget,
  validatePlannedMinutes,
} from "@/systems/roster-management";
export {
  getPlayerAvailability,
  isPlayerAvailable,
} from "@/systems/player-availability";
export {
  applyRotationSubstitutions,
} from "@/systems/rotation-simulation";
export {
  generatePlayer,
  generatePlayerWithRng,
  type GeneratePlayerOptions,
} from "@/systems/player-generation";
export { developPlayer } from "@/systems/player-development";
export {
  processSeasonPlayerDevelopment,
  combinedDevelopmentMultiplier,
} from "@/systems/season-player-development";
export {
  processWeeklyPlayerPayroll,
  PLAYER_PAYROLL_WEEKS_PER_YEAR,
} from "@/systems/player-payroll";
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
  simulateScheduledGame,
  requestPossessionSeconds,
  type SimulateGameContext,
} from "@/systems/game-simulation";
export {
  GAME_SIMULATION_CONFIG,
  mergeGameSimulationConfig,
  type GameSimulationConfig,
} from "@/systems/game-simulation-config";
export {
  MIN_PLAYOFF_LEAGUE_SIZE,
  MAX_PLAYOFF_FIELD_SIZE,
  SERIES_WINS_TO_CLINCH,
  SUPPORTED_PLAYOFF_FIELD_SIZES,
  getPlayoffTeamCount,
  getLegacyPlayoffTeamCount,
  getHomeTeamForGame,
  type HomeCourtSeriesParticipants,
} from "@/systems/playoff-config";
export { qualifyAndSeed } from "@/systems/playoff-qualification";
export {
  bracketSeedOrder,
  generateBracket,
} from "@/systems/playoff-bracket";
export {
  recordSeriesGameResult,
  isSeriesComplete,
  seriesGamesPlayed,
} from "@/systems/playoff-series";
export {
  createNextPlayoffGame,
  nextPlayoffGameDate,
} from "@/systems/playoff-scheduling";
export {
  startPlayoffs,
  simulateNextPlayoffGame,
  simulatePlayoffs,
} from "@/systems/playoff-simulation";
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
export { calculateStandings, updateStandings, rebuildStandings, compareStandings } from "@/systems/standings";
export type { CalculateStandingsOptions } from "@/systems/standings";
export { simulateSeason } from "@/systems/season-simulation";
export {
  bootstrapWorld,
  runWorldPipeline,
  type WorldPipelineCommand,
} from "@/systems/world-pipeline";
export {
  advanceSimulation,
  transitionPhase,
  isValidPhaseTransition,
  VALID_PHASE_TRANSITIONS,
  processSeasonLifecycle,
  isRegularSeasonComplete,
  enterOffseasonFromPostseason,
  processOffseasonLifecycle,
  advanceOffseasonStage,
  initializeNewSeason,
  scheduleEvent,
  processScheduledEvents,
  registerScheduledEventHandler,
  runDailyPipeline,
  runWeeklyPipeline,
  runOwnerGameplay,
  SEASON_LIFECYCLE_CONFIG,
  getCalendarContext,
  lifecycleIdentity,
  type AdvanceSimulationResult,
  type AdvanceSimulationOptions,
  type OwnerGameplayResult,
  type CalendarContext,
} from "@/systems/simulation";
export { ensureDraftPicks } from "@/systems/world-pipeline";
export {
  FREE_AGENCY_INTEREST_CONFIG,
  type FreeAgencyInterestConfig,
} from "@/systems/free-agency-config";
export {
  acceptOffer,
  defaultEvaluatePlayerInterest,
  getFreeAgent,
  getPlayerInterest,
  isFreeAgent,
  listFreeAgents,
  makeOffer,
  negotiateOffer,
  rejectOffer,
  releaseExpiredContracts,
  releasePlayerToFreeAgency,
  withdrawOffer,
  type FreeAgencyWriteOptions,
  type FreeAgentPoolView,
  type MakeOfferInput,
} from "@/systems/free-agency";
export {
  TRADE_ROSTER_RULES,
  TRADE_SALARY_MATCHING_PERCENT,
  TRADE_FINDER_MAX_CANDIDATES,
  DRAFT_PICK_VALUE_ROUND_1,
  DRAFT_PICK_VALUE_ROUND_2,
  TRADE_BLOCK_VALUE_BONUS,
} from "@/systems/trades-config";
export {
  calculateDraftPickValue,
  applyTradeSalaryRule,
  validateTrade,
  executeTrade,
  getTradeBlock,
  addToTradeBlock,
  removeFromTradeBlock,
  findTrades,
  evaluateTradeOffer,
  generateAiTradeProposal,
  type TradeValidationResult,
  type TradeExecutionResult,
  type FindTradesInput,
  type TradeFinderCandidate,
  type TradeOfferEvaluation,
} from "@/systems/trades";
export {
  generateDraftPicksForSeason,
  mergeDraftPicksForSeason,
  DRAFT_PICK_HORIZON_YEARS,
} from "@/domain/draft-picks/generate-draft-picks";
export {
  MIN_DRAFT_PROSPECT_AGE,
  MAX_DRAFT_PROSPECT_AGE,
  DRAFT_EXTRA_PROSPECTS_PER_TEAM,
  DRAFT_SCOUT_ATTRIBUTE_NOISE,
  DRAFT_SCOUT_RANK_NOISE,
  DRAFT_ROOKIE_CONTRACT_YEARS,
} from "@/systems/draft-config";
export {
  createDraft,
  activateDraft,
  completeDraft,
  validateDraftSelection,
  makeDraftSelection,
  generateDraftOrder,
  draftYearForSeason,
  countDraftPicksForYear,
  type MakeDraftSelectionInput,
  type DraftSelectionResult,
  type DraftValidationResult,
  type DraftValidationIssue,
} from "@/systems/draft";
export {
  attributeBasedAnnualSalary,
  ATTRIBUTE_SALARY_BASE,
  ATTRIBUTE_SALARY_PER_MEAN_POINT,
} from "@/systems/attribute-salary";
export {
  recordRevenue,
  recordExpense,
  applyCashAndBooksImpact,
  applyCashOnlyImpact,
  getFinancialStatement,
  getTotalRevenue,
  getTotalExpenses,
  getNetIncome,
} from "@/systems/team-finances";
export {
  generateOwnerObjectives,
  evaluateOwnerObjectives,
  resolveSeasonObjectives,
} from "@/systems/owner-objectives";
export {
  getOwnerObjectiveDefinition,
  definitionAppliesCashConsequence,
  evaluateOwnerObjectiveMetric,
  getTeamPlayoffSeed,
  countCareerChampionships,
  countCareerPlayoffAppearances,
} from "@/systems/owner-objective-definitions";
export {
  OWNER_PHILOSOPHY_PROFILES,
  getOwnerPhilosophyProfile,
  getDefaultOwnerMandateProfile,
  clampOwnerPatience,
  defaultOwnerPatience,
  mandatePriorityLabels,
} from "@/systems/owner-philosophy-config";
export {
  applyConfirmControlledFranchises,
  type ControlledFranchiseIdentityInput,
  type ConfirmControlledFranchisesResult,
} from "@/systems/confirm-controlled-franchises";
export { buildOwnershipExpectations } from "@/systems/ownership-expectations";
export {
  recordOwnershipEvidence,
  processOwnershipConfidence,
  appendOwnershipSeasonNote,
  confidenceAlignmentScore,
  deriveAlignmentScore,
} from "@/systems/ownership-confidence-engine";
export { evaluateStrategicPosture } from "@/systems/ownership-strategic-posture";
export {
  scoreTradeDecision,
  scoreFreeAgentSigning,
  scoreDraftSelection,
  scoreFacilityUpgrade,
  scoreMarketingBudgetChange,
} from "@/systems/ownership-alignment-signals";
export {
  OWNER_OBJECTIVE_STRONG_OVERALL,
  OWNER_OBJECTIVE_MID_OVERALL,
  OWNER_OBJECTIVE_WIN_TARGET_MID,
  OWNER_OBJECTIVE_WIN_TARGET_WEAK,
  OWNER_OBJECTIVE_PAYROLL_LIMIT,
  OWNER_OBJECTIVE_CASH_CONSEQUENCE_TYPES,
  objectiveAppliesCashConsequence,
  OWNER_STREAK_NOTIFICATION_THRESHOLD,
  SIGNIFICANT_FINANCIAL_CHANGE,
  GAMEPLAY_LOSS_EXPENSE,
  GAMEPLAY_PLAYOFF_QUALIFICATION_REVENUE,
  GAMEPLAY_PLAYOFF_SERIES_WIN_REVENUE,
  GAMEPLAY_OBJECTIVE_REWARD,
  GAMEPLAY_OBJECTIVE_PENALTY,
} from "@/systems/owner-objectives-config";
export {
  applyGameplayFinancialConsequences,
  hasAppliedGameplayConsequence,
  withAppliedGameplayConsequence,
} from "@/systems/gameplay-financial-consequences";
export { generateOwnerNotifications } from "@/systems/owner-notifications";
export {
  calculateFinancialHealth,
  isCapitalSpendingRestricted,
} from "@/systems/financial-health";
export { projectCashHorizon } from "@/systems/cash-projection";
export {
  runEconomyScenario,
  applyEconomyScenario,
  bootstrapEconomyScenario,
  assertCashFlowInvariants,
  ECONOMY_SCENARIOS,
} from "@/systems/economy/scenario-harness";
export {
  runAiTeamDecisions,
  isUserControlledTeam,
} from "@/systems/ai-team-decisions";
