import { parseCalendarDate } from "@/domain/calendar-date";
import {
  isDraftLifecycleStatus,
  isDraftOrderSlotStatus,
  isDraftProspectStatus,
} from "@/domain/entities/draft";
import { assertContractShape } from "@/domain/entities/contract";
import {
  assertFreeAgencyOfferShape,
  isOpenOffer,
  type FreeAgencyOfferStatus,
} from "@/domain/entities/free-agency-offer";
import {
  GAME_COMPETITION_TYPES,
  GAME_STATUSES,
  type Game,
  type GameCompetitionType,
  type GameTeamSnapshot,
} from "@/domain/entities/game";
import type { PlayoffTournament } from "@/domain/entities/playoffs";
import {
  isOwnerObjectiveCategory,
  isOwnerObjectiveLifecycle,
  isOwnerObjectiveRole,
  isOwnerObjectiveStatus,
  isOwnerObjectiveType,
  OWNER_OBJECTIVE_CATEGORIES,
  OWNER_OBJECTIVE_LIFECYCLES,
  OWNER_OBJECTIVE_ROLES,
  OWNER_OBJECTIVE_STATUSES,
  OWNER_OBJECTIVE_TYPES,
} from "@/domain/entities/owner-objective";
import {
  isAiProfile,
  isOwnershipAxis,
} from "@/domain/entities/franchise-ops";
import {
  OWNER_PATIENCE_MAX,
  OWNER_PATIENCE_MIN,
} from "@/domain/entities/owner-philosophy";
import {
  isAiManagementPreset,
  MANAGEMENT_PHASE_KEYS,
} from "@/domain/ai-management-presets";
import {
  ALIGNMENT_DIMENSIONS,
  ALIGNMENT_EVIDENCE_DIRECTIONS,
  ALIGNMENT_EVIDENCE_KINDS,
  ALIGNMENT_EVIDENCE_SIGNIFICANCES,
  isAlignmentDimension,
  isAlignmentEvidenceDirection,
  isAlignmentEvidenceKind,
  isAlignmentEvidenceSignificance,
  isOwnershipMood,
  OWNERSHIP_EVIDENCE_RING_MAX,
  OWNERSHIP_MOODS,
  OWNERSHIP_SEASON_NOTES_MAX,
  type AlignmentEvidence,
  type OwnershipConfidenceState,
  type OwnershipSeasonNote,
  type StrategicReversal,
} from "@/domain/entities/ownership-confidence";
import {
  isOwnerNotificationSeverity,
  isOwnerNotificationType,
  OWNER_NOTIFICATION_SEVERITIES,
  OWNER_NOTIFICATION_TYPES,
} from "@/domain/entities/owner-notification";
import {
  isNarrativeCategory,
  isNarrativeSeverity,
  isNarrativeSituationStatus,
  NARRATIVE_CATEGORIES,
  NARRATIVE_SEVERITIES,
  NARRATIVE_SITUATION_STATUSES,
  NARRATIVE_SNAPSHOTS_MAX,
  NARRATIVE_SITUATIONS_MAX,
  NARRATIVE_UPDATES_MAX,
  type NarrativeEvidence,
} from "@/domain/entities/narrative-situation";
import {
  DOMAIN_EVENT_TYPES,
  isDomainEventType,
} from "@/domain/events";
import {
  isTradeBlockStatus,
  type TradeBlockAsset,
} from "@/domain/entities/trade-block";
import type {
  OffseasonStage,
  SeasonPhase,
} from "@/domain/entities/season";
import {
  OFFSEASON_STAGES,
  SEASON_PHASES,
} from "@/domain/entities/season";
import {
  SCHEDULED_EVENT_STATUSES,
  SCHEDULED_EVENT_TYPES,
  type ScheduledEventStatus,
  type ScheduledEventType,
} from "@/domain/entities/scheduled-event";
import type { GameState, GameMode } from "@/state/game-state";
import { GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";
import { validateGameSettings } from "@/domain/game-settings-validation";
import {
  asContractId,
  asOfferId,
  asPlayerId,
  asScheduledEventId,
  asTeamId,
} from "@/domain/ids";

const GAME_MODES: readonly GameMode[] = ["owner"];

const PLAYOFF_TOURNAMENT_STATUSES = [
  "not_started",
  "in_progress",
  "complete",
] as const;

const PLAYOFF_SERIES_STATUSES = ["pending", "active", "complete"] as const;

function fail(message: string): never {
  throw new Error(`Invalid GameState: ${message}`);
}

function assertRecord(value: unknown, path: string): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(`${path} must be an object.`);
  }
}

function assertNonEmptyString(value: unknown, path: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    fail(`${path} must be a non-empty string.`);
  }
}

function assertNumber(value: unknown, path: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(`${path} must be a finite number.`);
  }
}

/** Null or a parseable YYYY-MM-DD calendar date. */
function assertOptionalCalendarDate(value: unknown, path: string): void {
  if (value === undefined) {
    fail(`${path} is required (string or null).`);
  }
  if (value === null) {
    return;
  }
  if (typeof value !== "string") {
    fail(`${path} must be a YYYY-MM-DD string or null.`);
  }
  parseCalendarDate(value);
}

/**
 * Validates structural and referential integrity of a GameState at the
 * persistence boundary. Throws on failure.
 *
 * Settings are normalized to canonical form via {@link validateGameSettings}
 * (fixed FA duration, play-in off, injury frequency migration, etc.).
 */
export function validateGameState(state: unknown): asserts state is GameState {
  assertRecord(state, "GameState");

  for (const key of [
    "meta",
    "settings",
    "world",
    "competition",
    "business",
    "user",
  ] as const) {
    if (!(key in state)) {
      fail(`missing required root field "${key}".`);
    }
  }

  const meta = state.meta;
  assertRecord(meta, "meta");
  assertNonEmptyString(meta.saveId, "meta.saveId");
  assertNumber(meta.schemaVersion, "meta.schemaVersion");
  if (meta.schemaVersion !== GAME_STATE_SCHEMA_VERSION) {
    fail(
      `meta.schemaVersion must be ${GAME_STATE_SCHEMA_VERSION}; got ${meta.schemaVersion}.`,
    );
  }
  assertNonEmptyString(meta.createdAt, "meta.createdAt");
  assertNonEmptyString(meta.updatedAt, "meta.updatedAt");
  assertNumber(meta.rngSeed, "meta.rngSeed");
  if (!Number.isInteger(meta.rngSeed)) {
    fail("meta.rngSeed must be an integer.");
  }
  assertNumber(meta.rngState, "meta.rngState");
  if (!Number.isInteger(meta.rngState)) {
    fail("meta.rngState must be an integer.");
  }

  const settingsResult = validateGameSettings(state.settings, {
    mode: "persisted",
  });
  if (!settingsResult.ok) {
    fail(`settings: ${settingsResult.errors.join("; ")}`);
  }
  // Canonicalize settings so legacy / tampered fields converge on invariants.
  (state as { settings: typeof settingsResult.settings }).settings =
    settingsResult.settings;
  // Intentionally do NOT require settings.league.teamCount === live team count
  // (expansion / relocation may change world.teams after career creation).

  const world = state.world;
  assertRecord(world, "world");
  for (const key of [
    "calendar",
    "league",
    "conferences",
    "divisions",
    "teams",
    "players",
    "coaches",
    "staff",
    "draftPicks",
    "drafts",
    "scheduledEvents",
  ] as const) {
    if (!(key in world)) {
      fail(`world missing required field "${key}".`);
    }
  }

  assertRecord(world.calendar, "world.calendar");
  assertNonEmptyString(world.calendar.currentDate, "world.calendar.currentDate");
  try {
    parseCalendarDate(world.calendar.currentDate);
  } catch (error) {
    fail(
      error instanceof Error
        ? `world.calendar.currentDate: ${error.message}`
        : "world.calendar.currentDate is invalid.",
    );
  }

  if (world.calendar.lastSimulatedDate === null) {
    // ok — never simulated
  } else if (typeof world.calendar.lastSimulatedDate === "string") {
    assertNonEmptyString(
      world.calendar.lastSimulatedDate,
      "world.calendar.lastSimulatedDate",
    );
    try {
      parseCalendarDate(world.calendar.lastSimulatedDate);
    } catch (error) {
      fail(
        error instanceof Error
          ? `world.calendar.lastSimulatedDate: ${error.message}`
          : "world.calendar.lastSimulatedDate is invalid.",
      );
    }
  } else {
    fail("world.calendar.lastSimulatedDate must be a YYYY-MM-DD string or null.");
  }

  if (world.calendar.lastSimulatedWeekId === null) {
    // ok
  } else if (typeof world.calendar.lastSimulatedWeekId === "string") {
    assertNonEmptyString(
      world.calendar.lastSimulatedWeekId,
      "world.calendar.lastSimulatedWeekId",
    );
  } else {
    fail("world.calendar.lastSimulatedWeekId must be a non-empty string or null.");
  }

  if (world.calendar.lastSimulatedMonthId === null) {
    // ok
  } else if (typeof world.calendar.lastSimulatedMonthId === "string") {
    assertNonEmptyString(
      world.calendar.lastSimulatedMonthId,
      "world.calendar.lastSimulatedMonthId",
    );
  } else {
    fail(
      "world.calendar.lastSimulatedMonthId must be a non-empty string or null.",
    );
  }

  assertRecord(world.league, "world.league");
  assertNonEmptyString(world.league.id, "world.league.id");
  assertRecord(world.conferences, "world.conferences");
  assertRecord(world.divisions, "world.divisions");
  assertRecord(world.teams, "world.teams");
  assertRecord(world.players, "world.players");
  assertRecord(world.coaches, "world.coaches");
  assertRecord(world.staff, "world.staff");
  assertRecord(world.draftPicks, "world.draftPicks");
  assertRecord(world.drafts, "world.drafts");
  assertRecord(world.scheduledEvents, "world.scheduledEvents");
  validateScheduledEvents(world.scheduledEvents);

  const competition = state.competition;
  assertRecord(competition, "competition");
  for (const key of [
    "season",
    "schedule",
    "games",
    "standings",
    "playoffs",
    "seasonEventLog",
  ] as const) {
    if (!(key in competition)) {
      fail(`competition missing required field "${key}".`);
    }
  }

  assertRecord(competition.season, "competition.season");
  assertNonEmptyString(competition.season.id, "competition.season.id");
  assertNumber(competition.season.year, "competition.season.year");
  if (
    typeof competition.season.phase !== "string" ||
    !SEASON_PHASES.includes(competition.season.phase as SeasonPhase)
  ) {
    fail(
      `competition.season.phase must be one of ${SEASON_PHASES.join(", ")}.`,
    );
  }
  if (
    typeof competition.season.offseasonStage !== "string" ||
    !OFFSEASON_STAGES.includes(
      competition.season.offseasonStage as OffseasonStage,
    )
  ) {
    fail(
      `competition.season.offseasonStage must be one of ${OFFSEASON_STAGES.join(", ")}.`,
    );
  }
  if (
    competition.season.regularSeasonStartDate !== null &&
    competition.season.regularSeasonStartDate !== undefined
  ) {
    if (typeof competition.season.regularSeasonStartDate !== "string") {
      fail("competition.season.regularSeasonStartDate must be a string or null.");
    }
  } else if (competition.season.regularSeasonStartDate === undefined) {
    fail("competition.season.regularSeasonStartDate is required (string or null).");
  }

  assertOptionalCalendarDate(
    competition.season.offseasonStageEnteredDate,
    "competition.season.offseasonStageEnteredDate",
  );
  assertOptionalCalendarDate(
    competition.season.freeAgencyExtendedUntil,
    "competition.season.freeAgencyExtendedUntil",
  );

  assertRecord(competition.schedule, "competition.schedule");
  assertNonEmptyString(
    competition.schedule.seasonId,
    "competition.schedule.seasonId",
  );
  if (competition.schedule.seasonId !== competition.season.id) {
    fail("competition.schedule.seasonId must match competition.season.id.");
  }
  if (!Array.isArray(competition.schedule.gameIds)) {
    fail("competition.schedule.gameIds must be an array.");
  }

  assertRecord(competition.games, "competition.games");
  assertRecord(competition.standings, "competition.standings");
  assertRecord(competition.standings.byTeamId, "competition.standings.byTeamId");

  if (competition.playoffs === null || competition.playoffs === undefined) {
    fail("competition.playoffs is required.");
  }
  assertRecord(competition.playoffs, "competition.playoffs");
  validatePlayoffs(competition.playoffs);

  if (!Array.isArray(competition.seasonEventLog)) {
    fail("competition.seasonEventLog must be an array.");
  }
  validateEventLog(competition.seasonEventLog, "competition.seasonEventLog");

  const business = state.business;
  assertRecord(business, "business");
  if (
    !("contracts" in business) ||
    !("finances" in business) ||
    !("freeAgency" in business) ||
    !("tradeBlocks" in business)
  ) {
    fail(
      "business must include contracts, finances, freeAgency, and tradeBlocks.",
    );
  }
  assertRecord(business.contracts, "business.contracts");
  assertRecord(business.finances, "business.finances");
  assertRecord(business.freeAgency, "business.freeAgency");
  if (!("offers" in business.freeAgency)) {
    fail("business.freeAgency.offers is required.");
  }
  assertRecord(business.freeAgency.offers, "business.freeAgency.offers");
  assertRecord(business.tradeBlocks, "business.tradeBlocks");

  const staffContracts = (business as Record<string, unknown>).staffContracts;
  const sponsorships = (business as Record<string, unknown>).sponsorships;
  const franchiseOps = (business as Record<string, unknown>).franchiseOps;
  const relocationByTeamId = (business as Record<string, unknown>)
    .relocationByTeamId;
  const franchiseHistory = (business as Record<string, unknown>)
    .franchiseHistory;
  if (staffContracts == null) {
    fail("business.staffContracts is required.");
  }
  if (sponsorships == null) {
    fail("business.sponsorships is required.");
  }
  if (franchiseOps == null) {
    fail("business.franchiseOps is required.");
  }
  if (relocationByTeamId == null) {
    fail("business.relocationByTeamId is required.");
  }
  if (franchiseHistory == null) {
    fail("business.franchiseHistory is required.");
  }
  const franchiseReportCache = (business as Record<string, unknown>)
    .franchiseReportCache;
  if (franchiseReportCache == null) {
    fail("business.franchiseReportCache is required.");
  }
  const gameArchive = (business as Record<string, unknown>).gameArchive;
  if (gameArchive == null) {
    fail("business.gameArchive is required.");
  }
  const playerHistory = (business as Record<string, unknown>).playerHistory;
  if (playerHistory == null) {
    fail("business.playerHistory is required.");
  }
  assertRecord(staffContracts, "business.staffContracts");
  assertRecord(sponsorships, "business.sponsorships");
  assertRecord(franchiseOps, "business.franchiseOps");
  assertRecord(relocationByTeamId, "business.relocationByTeamId");
  assertRecord(franchiseHistory, "business.franchiseHistory");
  assertRecord(franchiseReportCache, "business.franchiseReportCache");
  assertRecord(gameArchive, "business.gameArchive");
  assertRecord(playerHistory, "business.playerHistory");
  if (!("leagueEconomy" in business) || business.leagueEconomy == null) {
    fail("business.leagueEconomy is required.");
  }
  assertRecord(business.leagueEconomy, "business.leagueEconomy");
  if (!("expansion" in business) || business.expansion == null) {
    fail("business.expansion is required.");
  }
  assertRecord(business.expansion, "business.expansion");

  for (const teamId of Object.keys(world.teams)) {
    if (!(teamId in franchiseOps)) {
      fail(`business.franchiseOps missing team "${teamId}".`);
    }
    const ops = (franchiseOps as Record<string, unknown>)[teamId];
    assertRecord(ops, `business.franchiseOps[${teamId}]`);
    if (!isAiProfile(ops.aiProfile)) {
      fail(
        `business.franchiseOps[${teamId}].aiProfile must be a valid AiProfile.`,
      );
    }
    if (!isOwnershipAxis(ops.spendingTolerance)) {
      fail(
        `business.franchiseOps[${teamId}].spendingTolerance must be an integer 1–99.`,
      );
    }
    if (!isOwnershipAxis(ops.patience)) {
      fail(
        `business.franchiseOps[${teamId}].patience must be an integer 1–99.`,
      );
    }
    if (!isOwnershipAxis(ops.riskTolerance)) {
      fail(
        `business.franchiseOps[${teamId}].riskTolerance must be an integer 1–99.`,
      );
    }
    if (!(teamId in relocationByTeamId)) {
      fail(`business.relocationByTeamId missing team "${teamId}".`);
    }
    if (!(teamId in franchiseHistory)) {
      fail(`business.franchiseHistory missing team "${teamId}".`);
    }
  }

  for (const [historyTeamId, historyValue] of Object.entries(
    franchiseHistory as Record<string, unknown>,
  )) {
    assertRecord(historyValue, `business.franchiseHistory[${historyTeamId}]`);
    if (!Array.isArray(historyValue.seasons)) {
      fail(
        `business.franchiseHistory[${historyTeamId}].seasons must be an array.`,
      );
    }
    for (let index = 0; index < historyValue.seasons.length; index += 1) {
      const season = historyValue.seasons[index];
      assertRecord(
        season,
        `business.franchiseHistory[${historyTeamId}].seasons[${index}]`,
      );
      const attendancePath = `business.franchiseHistory[${historyTeamId}].seasons[${index}].attendance`;
      if (!("attendance" in season)) {
        fail(`${attendancePath} is required.`);
      }
      if (
        season.attendance !== null &&
        (typeof season.attendance !== "number" ||
          !Number.isFinite(season.attendance))
      ) {
        fail(`${attendancePath} must be a finite number or null.`);
      }
    }
  }

  for (const [staffId, staffValue] of Object.entries(world.staff)) {
    assertRecord(staffValue, `world.staff[${staffId}]`);
    assertNonEmptyString(staffValue.id, `world.staff[${staffId}].id`);
    if (staffValue.id !== staffId) {
      fail(`world.staff key "${staffId}" does not match staff.id.`);
    }
    if (
      typeof staffValue.role !== "string" ||
      ![
        "general_manager",
        "head_coach",
        "assistant_coach",
        "scout",
        "trainer",
        "finance",
        "marketing",
      ].includes(staffValue.role)
    ) {
      fail(`world.staff[${staffId}].role is invalid.`);
    }
    assertIntegerInRange(staffValue.quality, 1, 99, `world.staff[${staffId}].quality`);
    if (
      typeof staffValue.experience !== "number" ||
      !Number.isInteger(staffValue.experience) ||
      staffValue.experience < 0
    ) {
      fail(`world.staff[${staffId}].experience must be a non-negative integer.`);
    }
    if (staffValue.teamId !== null) {
      assertNonEmptyString(staffValue.teamId, `world.staff[${staffId}].teamId`);
      if (!(staffValue.teamId in world.teams)) {
        fail(
          `world.staff[${staffId}].teamId "${staffValue.teamId}" is missing from world.teams.`,
        );
      }
    }
  }

  for (const [teamId, teamValue] of Object.entries(world.teams)) {
    assertRecord(teamValue, `world.teams[${teamId}]`);
    for (const staffId of teamValue.staff as string[]) {
      if (!(staffId in world.staff)) {
        fail(
          `world.teams[${teamId}].staff contains "${staffId}" missing from world.staff.`,
        );
      }
    }
  }

  const user = state.user;
  assertRecord(user, "user");
  if (
    typeof user.mode !== "string" ||
    !GAME_MODES.includes(user.mode as GameMode)
  ) {
    fail(`user.mode must be one of ${GAME_MODES.join(", ")}.`);
  }

  if (!("ownedTeamIds" in user) || !Array.isArray(user.ownedTeamIds)) {
    fail("user.ownedTeamIds must be a non-empty array.");
  }
  if ((user.ownedTeamIds as unknown[]).length < 1) {
    fail("user.ownedTeamIds must contain at least one team id.");
  }
  for (let i = 0; i < (user.ownedTeamIds as unknown[]).length; i += 1) {
    assertNonEmptyString(
      (user.ownedTeamIds as unknown[])[i],
      `user.ownedTeamIds[${i}]`,
    );
  }
  const ownedTeamIdSet = new Set(user.ownedTeamIds as string[]);
  if (ownedTeamIdSet.size !== (user.ownedTeamIds as unknown[]).length) {
    fail("user.ownedTeamIds must not contain duplicates.");
  }

  if (!("activeOwnerTeamId" in user) || user.activeOwnerTeamId == null) {
    fail("user.activeOwnerTeamId is required.");
  }
  assertNonEmptyString(user.activeOwnerTeamId, "user.activeOwnerTeamId");
  if (!ownedTeamIdSet.has(user.activeOwnerTeamId as string)) {
    fail(
      `user.activeOwnerTeamId "${user.activeOwnerTeamId}" must be in user.ownedTeamIds.`,
    );
  }

  if (
    !("ownedFranchises" in user) ||
    user.ownedFranchises == null ||
    typeof user.ownedFranchises !== "object" ||
    Array.isArray(user.ownedFranchises)
  ) {
    fail("user.ownedFranchises must be a record.");
  }
  const ownedFranchises = user.ownedFranchises as Record<string, unknown>;
  for (const teamId of ownedTeamIdSet) {
    if (!(teamId in ownedFranchises)) {
      fail(`user.ownedFranchises missing entry for owned team "${teamId}".`);
    }
  }
  for (const franchiseKey of Object.keys(ownedFranchises)) {
    if (!ownedTeamIdSet.has(franchiseKey)) {
      fail(
        `user.ownedFranchises key "${franchiseKey}" is not in user.ownedTeamIds.`,
      );
    }
    validateOwnedFranchiseState(
      ownedFranchises[franchiseKey],
      `user.ownedFranchises[${franchiseKey}]`,
      fail,
    );
  }

  if (
    !("pendingOwnerDecisions" in user) ||
    !Array.isArray(user.pendingOwnerDecisions)
  ) {
    fail("user.pendingOwnerDecisions must be an array.");
  } else if ((user.pendingOwnerDecisions as unknown[]).length > 1) {
    fail("user.pendingOwnerDecisions may contain at most one active decision.");
  } else {
    for (
      let index = 0;
      index < (user.pendingOwnerDecisions as unknown[]).length;
      index += 1
    ) {
      validatePendingOwnerDecision(
        (user.pendingOwnerDecisions as unknown[])[index],
        `user.pendingOwnerDecisions[${index}]`,
        fail,
      );
    }
  }

  if (
    !("ownerDecisionHistory" in user) ||
    !Array.isArray(user.ownerDecisionHistory)
  ) {
    fail("user.ownerDecisionHistory must be an array.");
  } else {
    for (
      let index = 0;
      index < (user.ownerDecisionHistory as unknown[]).length;
      index += 1
    ) {
      validateOwnerDecisionRecord(
        (user.ownerDecisionHistory as unknown[])[index],
        `user.ownerDecisionHistory[${index}]`,
        fail,
      );
    }
  }

  const teamIds = new Set(Object.keys(world.teams));
  const playerIds = new Set(Object.keys(world.players));
  const contractIds = new Set(Object.keys(business.contracts));
  const gameIds = new Set(Object.keys(competition.games));
  const seasonId = competition.season.id;

  for (const ownedId of ownedTeamIdSet) {
    if (!teamIds.has(ownedId)) {
      fail(
        `user.ownedTeamIds entry "${ownedId}" is missing from world.teams.`,
      );
    }
  }

  for (const [playerId, playerValue] of Object.entries(world.players)) {
    assertRecord(playerValue, `world.players[${playerId}]`);
    assertNonEmptyString(playerValue.id, `world.players[${playerId}].id`);
    if (playerValue.id !== playerId) {
      fail(`world.players key "${playerId}" does not match player.id.`);
    }
    if (playerValue.teamId != null) {
      assertNonEmptyString(
        playerValue.teamId,
        `world.players[${playerId}].teamId`,
      );
      if (!teamIds.has(playerValue.teamId)) {
        fail(
          `world.players[${playerId}].teamId "${playerValue.teamId}" is missing from world.teams.`,
        );
      }
    }
    if (playerValue.contractId != null) {
      assertNonEmptyString(
        playerValue.contractId,
        `world.players[${playerId}].contractId`,
      );
      if (!contractIds.has(playerValue.contractId)) {
        fail(
          `world.players[${playerId}].contractId "${playerValue.contractId}" is missing from business.contracts.`,
        );
      }
      const linkedContract = business.contracts[playerValue.contractId];
      assertRecord(
        linkedContract,
        `business.contracts[${playerValue.contractId}]`,
      );
      if (linkedContract.playerId !== playerId) {
        fail(
          `world.players[${playerId}].contractId "${playerValue.contractId}" must reference a contract whose playerId matches the player.`,
        );
      }
    }
  }

  for (const [contractId, contractValue] of Object.entries(business.contracts)) {
    assertRecord(contractValue, `business.contracts[${contractId}]`);
    assertNonEmptyString(
      contractValue.id,
      `business.contracts[${contractId}].id`,
    );
    if (contractValue.id !== contractId) {
      fail(`business.contracts key "${contractId}" does not match contract.id.`);
    }
    assertNonEmptyString(
      contractValue.playerId,
      `business.contracts[${contractId}].playerId`,
    );
    assertNonEmptyString(
      contractValue.teamId,
      `business.contracts[${contractId}].teamId`,
    );
    if (!playerIds.has(contractValue.playerId)) {
      fail(
        `business.contracts[${contractId}].playerId "${contractValue.playerId}" is missing from world.players.`,
      );
    }
    if (!teamIds.has(contractValue.teamId)) {
      fail(
        `business.contracts[${contractId}].teamId "${contractValue.teamId}" is missing from world.teams.`,
      );
    }
    try {
      assertContractShape({
        id: asContractId(contractValue.id as string),
        playerId: asPlayerId(contractValue.playerId as string),
        teamId: asTeamId(contractValue.teamId as string),
        startYear: contractValue.startYear as number,
        endYear: contractValue.endYear as number,
        salaryByYear: contractValue.salaryByYear as Record<string, number>,
        teamOption: contractValue.teamOption as
          | {
              year: number;
              salary: number;
              status: "pending" | "exercised" | "declined";
            }
          | undefined,
        playerOption: contractValue.playerOption as
          | {
              year: number;
              salary: number;
              status: "pending" | "exercised" | "declined";
            }
          | undefined,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      fail(`business.contracts[${contractId}]: ${detail}`);
    }
  }

  for (const [financeKey, financeValue] of Object.entries(business.finances)) {
    assertRecord(financeValue, `business.finances[${financeKey}]`);
    assertNonEmptyString(
      financeValue.teamId,
      `business.finances[${financeKey}].teamId`,
    );
    if (!teamIds.has(financeKey) || financeValue.teamId !== financeKey) {
      fail(
        `business.finances entry "${financeKey}" must key and teamId match an existing team.`,
      );
    }
    assertNumber(financeValue.cash, `business.finances[${financeKey}].cash`);
    assertNumber(
      financeValue.payroll,
      `business.finances[${financeKey}].payroll`,
    );
    assertRecord(
      financeValue.booksByYear,
      `business.finances[${financeKey}].booksByYear`,
    );
    validateTeamFinanceBooksByYear(
      financeValue.booksByYear,
      `business.finances[${financeKey}].booksByYear`,
    );
    assertRecord(
      financeValue.attendanceByYear,
      `business.finances[${financeKey}].attendanceByYear`,
    );
    for (const [yearKey, attendance] of Object.entries(
      financeValue.attendanceByYear as Record<string, unknown>,
    )) {
      if (typeof attendance !== "number" || !Number.isFinite(attendance)) {
        fail(
          `business.finances[${financeKey}].attendanceByYear["${yearKey}"] must be a finite number.`,
        );
      }
    }
    assertRecord(
      financeValue.booksByMonth,
      `business.finances[${financeKey}].booksByMonth`,
    );
    validateTeamFinanceBooksByMonth(
      financeValue.booksByMonth,
      `business.finances[${financeKey}].booksByMonth`,
    );
    assertRecord(
      financeValue.cashLedgerByMonth,
      `business.finances[${financeKey}].cashLedgerByMonth`,
    );
    validateCashLedgerByMonth(
      financeValue.cashLedgerByMonth,
      `business.finances[${financeKey}].cashLedgerByMonth`,
    );
  }

  const openOfferPairs = new Set<string>();
  for (const [offerId, offerValue] of Object.entries(
    business.freeAgency.offers,
  )) {
    assertRecord(offerValue, `business.freeAgency.offers[${offerId}]`);
    assertNonEmptyString(
      offerValue.id,
      `business.freeAgency.offers[${offerId}].id`,
    );
    if (offerValue.id !== offerId) {
      fail(
        `business.freeAgency.offers key "${offerId}" does not match offer.id.`,
      );
    }
    assertNonEmptyString(
      offerValue.playerId,
      `business.freeAgency.offers[${offerId}].playerId`,
    );
    assertNonEmptyString(
      offerValue.teamId,
      `business.freeAgency.offers[${offerId}].teamId`,
    );
    if (!playerIds.has(offerValue.playerId as string)) {
      fail(
        `business.freeAgency.offers[${offerId}].playerId "${offerValue.playerId}" is missing from world.players.`,
      );
    }
    if (!teamIds.has(offerValue.teamId as string)) {
      fail(
        `business.freeAgency.offers[${offerId}].teamId "${offerValue.teamId}" is missing from world.teams.`,
      );
    }

    const terms = offerValue.terms;
    assertRecord(terms, `business.freeAgency.offers[${offerId}].terms`);

    try {
      assertFreeAgencyOfferShape({
        id: asOfferId(offerValue.id as string),
        playerId: asPlayerId(offerValue.playerId as string),
        teamId: asTeamId(offerValue.teamId as string),
        terms: {
          id: asContractId(terms.id as string),
          playerId: asPlayerId(terms.playerId as string),
          teamId: asTeamId(terms.teamId as string),
          startYear: terms.startYear as number,
          endYear: terms.endYear as number,
          salaryByYear: terms.salaryByYear as Record<string, number>,
          teamOption: terms.teamOption as
            | {
                year: number;
                salary: number;
                status: "pending" | "exercised" | "declined";
              }
            | undefined,
          playerOption: terms.playerOption as
            | {
                year: number;
                salary: number;
                status: "pending" | "exercised" | "declined";
              }
            | undefined,
        },
        status: offerValue.status as FreeAgencyOfferStatus,
        contractId:
          offerValue.contractId === undefined
            ? undefined
            : asContractId(offerValue.contractId as string),
        createdOn: offerValue.createdOn as string,
        updatedOn: offerValue.updatedOn as string,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      fail(`business.freeAgency.offers[${offerId}]: ${detail}`);
    }

    if (isOpenOffer(offerValue.status as FreeAgencyOfferStatus)) {
      const pairKey = `${offerValue.playerId}|${offerValue.teamId}`;
      if (openOfferPairs.has(pairKey)) {
        fail(
          `business.freeAgency.offers has multiple open offers for player "${offerValue.playerId}" and team "${offerValue.teamId}".`,
        );
      }
      openOfferPairs.add(pairKey);
    }

    if (offerValue.status === "accepted") {
      const acceptedContractId = offerValue.contractId as string;
      if (!contractIds.has(acceptedContractId)) {
        fail(
          `business.freeAgency.offers[${offerId}].contractId "${acceptedContractId}" is missing from business.contracts.`,
        );
      }
      const linkedContract = business.contracts[acceptedContractId];
      assertRecord(
        linkedContract,
        `business.contracts[${acceptedContractId}]`,
      );
      if (linkedContract.playerId !== offerValue.playerId) {
        fail(
          `business.freeAgency.offers[${offerId}] accepted contract playerId must match offer.playerId.`,
        );
      }
      if (linkedContract.teamId !== offerValue.teamId) {
        fail(
          `business.freeAgency.offers[${offerId}] accepted contract teamId must match offer.teamId.`,
        );
      }
      const signedPlayer = world.players[offerValue.playerId as string];
      assertRecord(
        signedPlayer,
        `world.players[${offerValue.playerId}]`,
      );
      // Accepted offers are historical records. Live membership invariants apply
      // only while the offer's contract is still the player's current binding.
      // After expiration/release/re-sign, player.contractId diverges — that is valid.
      if (signedPlayer.contractId === acceptedContractId) {
        if (signedPlayer.teamId !== offerValue.teamId) {
          fail(
            `business.freeAgency.offers[${offerId}] accepted: player.teamId must equal offer.teamId.`,
          );
        }
        const signingTeam = world.teams[offerValue.teamId as string];
        assertRecord(signingTeam, `world.teams[${offerValue.teamId}]`);
        if (!Array.isArray(signingTeam.roster)) {
          fail(`world.teams[${offerValue.teamId}].roster must be an array.`);
        }
        if (!(signingTeam.roster as unknown[]).includes(offerValue.playerId)) {
          fail(
            `business.freeAgency.offers[${offerId}] accepted: player must be on signing team roster.`,
          );
        }
      }
    }
  }

  const rosterMembership = new Map<string, string>();
  for (const [teamId, teamValue] of Object.entries(world.teams)) {
    assertRecord(teamValue, `world.teams[${teamId}]`);
    assertRecord(teamValue.branding, `world.teams[${teamId}].branding`);
    assertNonEmptyString(
      teamValue.branding.primaryColor,
      `world.teams[${teamId}].branding.primaryColor`,
    );
    assertNonEmptyString(
      teamValue.branding.secondaryColor,
      `world.teams[${teamId}].branding.secondaryColor`,
    );
    assertNonEmptyString(
      teamValue.branding.accentColor,
      `world.teams[${teamId}].branding.accentColor`,
    );
    assertNonEmptyString(
      teamValue.branding.logoId,
      `world.teams[${teamId}].branding.logoId`,
    );
    if (
      teamValue.rosterManagement === null ||
      typeof teamValue.rosterManagement !== "object" ||
      Array.isArray(teamValue.rosterManagement)
    ) {
      fail(`world.teams[${teamId}].rosterManagement must be an object.`);
    }
    if (!Array.isArray(teamValue.roster)) {
      fail(`world.teams[${teamId}].roster must be an array.`);
    }
    for (const rosterPlayerId of teamValue.roster as unknown[]) {
      if (typeof rosterPlayerId !== "string" || rosterPlayerId.length === 0) {
        fail(
          `world.teams[${teamId}].roster entries must be non-empty strings.`,
        );
      }
      if (!playerIds.has(rosterPlayerId)) {
        fail(
          `world.teams[${teamId}].roster entry "${rosterPlayerId}" is missing from world.players.`,
        );
      }
      const existingTeamId = rosterMembership.get(rosterPlayerId);
      if (existingTeamId !== undefined) {
        fail(
          `Player "${rosterPlayerId}" appears on multiple team rosters ("${existingTeamId}" and "${teamId}").`,
        );
      }
      rosterMembership.set(rosterPlayerId, teamId);
    }
  }

  const draftPickIds = new Set(Object.keys(world.draftPicks));
  for (const [pickId, pickValue] of Object.entries(world.draftPicks)) {
    assertRecord(pickValue, `world.draftPicks[${pickId}]`);
    assertNonEmptyString(pickValue.id, `world.draftPicks[${pickId}].id`);
    if (pickValue.id !== pickId) {
      fail(`world.draftPicks key "${pickId}" does not match draftPick.id.`);
    }
    assertNonEmptyString(
      pickValue.originalTeamId,
      `world.draftPicks[${pickId}].originalTeamId`,
    );
    assertNonEmptyString(
      pickValue.ownerTeamId,
      `world.draftPicks[${pickId}].ownerTeamId`,
    );
    if (!teamIds.has(pickValue.originalTeamId as string)) {
      fail(
        `world.draftPicks[${pickId}].originalTeamId "${pickValue.originalTeamId}" is missing from world.teams.`,
      );
    }
    if (!teamIds.has(pickValue.ownerTeamId as string)) {
      fail(
        `world.draftPicks[${pickId}].ownerTeamId "${pickValue.ownerTeamId}" is missing from world.teams.`,
      );
    }
    assertNumber(pickValue.seasonYear, `world.draftPicks[${pickId}].seasonYear`);
    if (!Number.isInteger(pickValue.seasonYear)) {
      fail(`world.draftPicks[${pickId}].seasonYear must be an integer.`);
    }
    if (pickValue.round !== 1 && pickValue.round !== 2) {
      fail(`world.draftPicks[${pickId}].round must be 1 or 2.`);
    }
  }

  const selectedPlayerIds = new Set<string>();
  for (const [draftId, draftValue] of Object.entries(world.drafts)) {
    assertRecord(draftValue, `world.drafts[${draftId}]`);
    assertNonEmptyString(draftValue.id, `world.drafts[${draftId}].id`);
    if (draftValue.id !== draftId) {
      fail(`world.drafts key "${draftId}" does not match draft.id.`);
    }
    assertNumber(draftValue.seasonYear, `world.drafts[${draftId}].seasonYear`);
    if (!Number.isInteger(draftValue.seasonYear)) {
      fail(`world.drafts[${draftId}].seasonYear must be an integer.`);
    }
    if (!isDraftLifecycleStatus(draftValue.status)) {
      fail(`world.drafts[${draftId}].status is invalid.`);
    }
    assertRecord(draftValue.prospects, `world.drafts[${draftId}].prospects`);
    if (!Array.isArray(draftValue.order)) {
      fail(`world.drafts[${draftId}].order must be an array.`);
    }
    if (!Array.isArray(draftValue.scouting)) {
      fail(`world.drafts[${draftId}].scouting must be an array.`);
    }
    if (!Array.isArray(draftValue.selections)) {
      fail(`world.drafts[${draftId}].selections must be an array.`);
    }

    const prospectIds = new Set(Object.keys(draftValue.prospects));
    for (const [prospectId, prospectValue] of Object.entries(
      draftValue.prospects as Record<string, Record<string, unknown>>,
    )) {
      assertRecord(
        prospectValue,
        `world.drafts[${draftId}].prospects[${prospectId}]`,
      );
      assertNonEmptyString(
        prospectValue.playerId,
        `world.drafts[${draftId}].prospects[${prospectId}].playerId`,
      );
      if (prospectValue.playerId !== prospectId) {
        fail(
          `world.drafts[${draftId}].prospects key "${prospectId}" does not match prospect.playerId.`,
        );
      }
      assertRecord(
        prospectValue.player,
        `world.drafts[${draftId}].prospects[${prospectId}].player`,
      );
      const prospectPlayer = prospectValue.player as Record<string, unknown>;
      assertNonEmptyString(
        prospectPlayer.id,
        `world.drafts[${draftId}].prospects[${prospectId}].player.id`,
      );
      if (prospectPlayer.id !== prospectValue.playerId) {
        fail(
          `world.drafts[${draftId}].prospects[${prospectId}].playerId must equal player.id.`,
        );
      }
      if (prospectPlayer.teamId != null) {
        fail(
          `world.drafts[${draftId}].prospects[${prospectId}].player.teamId must be null.`,
        );
      }
      if (prospectPlayer.contractId != null) {
        fail(
          `world.drafts[${draftId}].prospects[${prospectId}].player.contractId must be null.`,
        );
      }
      assertNumber(
        prospectValue.ranking,
        `world.drafts[${draftId}].prospects[${prospectId}].ranking`,
      );
      if (
        !Number.isInteger(prospectValue.ranking) ||
        (prospectValue.ranking as number) < 1
      ) {
        fail(
          `world.drafts[${draftId}].prospects[${prospectId}].ranking must be an integer >= 1.`,
        );
      }
      if (!isDraftProspectStatus(prospectValue.status)) {
        fail(
          `world.drafts[${draftId}].prospects[${prospectId}].status is invalid.`,
        );
      }
      if (prospectValue.status === "selected") {
        if (selectedPlayerIds.has(prospectId)) {
          fail(
            `Draft selected player "${prospectId}" appears more than once across drafts.`,
          );
        }
        selectedPlayerIds.add(prospectId);
        if (!playerIds.has(prospectId)) {
          fail(
            `world.drafts[${draftId}] selected prospect "${prospectId}" is missing from world.players.`,
          );
        }
        const worldPlayer = world.players[prospectId] as {
          teamId: string | null;
        };
        // Active drafts require the draftee to be on a team. Completed drafts are
        // historical — players may later become free agents (teamId null).
        if (
          draftValue.status === "active" &&
          worldPlayer.teamId == null
        ) {
          fail(
            `world.drafts[${draftId}] selected prospect "${prospectId}" must have a teamId on world.players.`,
          );
        }
      } else if (playerIds.has(prospectId)) {
        fail(
          `world.drafts[${draftId}] eligible prospect "${prospectId}" must not appear in world.players.`,
        );
      }
    }

    const orderPickIds = new Set<string>();
    for (let index = 0; index < draftValue.order.length; index += 1) {
      const slot = draftValue.order[index] as Record<string, unknown>;
      assertRecord(slot, `world.drafts[${draftId}].order[${index}]`);
      assertNonEmptyString(
        slot.draftPickId,
        `world.drafts[${draftId}].order[${index}].draftPickId`,
      );
      const draftPickId = slot.draftPickId as string;
      if (!draftPickIds.has(draftPickId)) {
        fail(
          `world.drafts[${draftId}].order[${index}].draftPickId "${draftPickId}" is missing from world.draftPicks.`,
        );
      }
      if (orderPickIds.has(draftPickId)) {
        fail(
          `world.drafts[${draftId}].order duplicates draftPickId "${draftPickId}".`,
        );
      }
      orderPickIds.add(draftPickId);
      const pickAsset = world.draftPicks[draftPickId] as {
        seasonYear: number;
        round: number;
      };
      if (pickAsset.seasonYear !== draftValue.seasonYear) {
        fail(
          `world.drafts[${draftId}].order[${index}] pick year must match draft.seasonYear.`,
        );
      }
      assertNumber(
        slot.overallPick,
        `world.drafts[${draftId}].order[${index}].overallPick`,
      );
      if (
        !Number.isInteger(slot.overallPick) ||
        (slot.overallPick as number) < 1
      ) {
        fail(
          `world.drafts[${draftId}].order[${index}].overallPick must be an integer >= 1.`,
        );
      }
      if (slot.round !== 1 && slot.round !== 2) {
        fail(`world.drafts[${draftId}].order[${index}].round must be 1 or 2.`);
      }
      if (slot.round !== pickAsset.round) {
        fail(
          `world.drafts[${draftId}].order[${index}].round must match draftPick.round.`,
        );
      }
      assertNonEmptyString(
        slot.ownerTeamId,
        `world.drafts[${draftId}].order[${index}].ownerTeamId`,
      );
      if (!teamIds.has(slot.ownerTeamId as string)) {
        fail(
          `world.drafts[${draftId}].order[${index}].ownerTeamId is missing from world.teams.`,
        );
      }
      if (!isDraftOrderSlotStatus(slot.status)) {
        fail(`world.drafts[${draftId}].order[${index}].status is invalid.`);
      }
      if (slot.status === "used") {
        assertNonEmptyString(
          slot.selectedPlayerId,
          `world.drafts[${draftId}].order[${index}].selectedPlayerId`,
        );
        if (!prospectIds.has(slot.selectedPlayerId as string)) {
          fail(
            `world.drafts[${draftId}].order[${index}].selectedPlayerId is not in draft prospects.`,
          );
        }
      }
    }

    for (let index = 0; index < draftValue.scouting.length; index += 1) {
      const report = draftValue.scouting[index] as Record<string, unknown>;
      assertRecord(report, `world.drafts[${draftId}].scouting[${index}]`);
      assertNonEmptyString(
        report.teamId,
        `world.drafts[${draftId}].scouting[${index}].teamId`,
      );
      if (!teamIds.has(report.teamId as string)) {
        fail(
          `world.drafts[${draftId}].scouting[${index}].teamId is missing from world.teams.`,
        );
      }
      assertNonEmptyString(
        report.prospectPlayerId,
        `world.drafts[${draftId}].scouting[${index}].prospectPlayerId`,
      );
      if (!prospectIds.has(report.prospectPlayerId as string)) {
        fail(
          `world.drafts[${draftId}].scouting[${index}].prospectPlayerId is not in draft prospects.`,
        );
      }
      assertRecord(
        report.estimatedAttributes,
        `world.drafts[${draftId}].scouting[${index}].estimatedAttributes`,
      );
      assertNumber(
        report.estimatedPotentialOverall,
        `world.drafts[${draftId}].scouting[${index}].estimatedPotentialOverall`,
      );
      assertNumber(
        report.projectedRank,
        `world.drafts[${draftId}].scouting[${index}].projectedRank`,
      );
    }

    for (let index = 0; index < draftValue.selections.length; index += 1) {
      const selection = draftValue.selections[index] as Record<string, unknown>;
      assertRecord(selection, `world.drafts[${draftId}].selections[${index}]`);
      assertNonEmptyString(
        selection.draftClassId,
        `world.drafts[${draftId}].selections[${index}].draftClassId`,
      );
      if (selection.draftClassId !== draftId) {
        fail(
          `world.drafts[${draftId}].selections[${index}].draftClassId must match draft id.`,
        );
      }
      assertNonEmptyString(
        selection.draftPickId,
        `world.drafts[${draftId}].selections[${index}].draftPickId`,
      );
      if (!orderPickIds.has(selection.draftPickId as string)) {
        fail(
          `world.drafts[${draftId}].selections[${index}].draftPickId is not in draft order.`,
        );
      }
      assertNonEmptyString(
        selection.teamId,
        `world.drafts[${draftId}].selections[${index}].teamId`,
      );
      if (!teamIds.has(selection.teamId as string)) {
        fail(
          `world.drafts[${draftId}].selections[${index}].teamId is missing from world.teams.`,
        );
      }
      assertNonEmptyString(
        selection.playerId,
        `world.drafts[${draftId}].selections[${index}].playerId`,
      );
      if (!prospectIds.has(selection.playerId as string)) {
        fail(
          `world.drafts[${draftId}].selections[${index}].playerId is not in draft prospects.`,
        );
      }
      if (!playerIds.has(selection.playerId as string)) {
        fail(
          `world.drafts[${draftId}].selections[${index}].playerId is missing from world.players.`,
        );
      }
    }
  }

  for (const [blockTeamId, blockValue] of Object.entries(business.tradeBlocks)) {
    assertRecord(blockValue, `business.tradeBlocks[${blockTeamId}]`);
    assertNonEmptyString(
      blockValue.teamId,
      `business.tradeBlocks[${blockTeamId}].teamId`,
    );
    if (blockValue.teamId !== blockTeamId) {
      fail(
        `business.tradeBlocks key "${blockTeamId}" does not match tradeBlock.teamId.`,
      );
    }
    if (!teamIds.has(blockTeamId)) {
      fail(
        `business.tradeBlocks[${blockTeamId}] team is missing from world.teams.`,
      );
    }
    if (!Array.isArray(blockValue.assets)) {
      fail(`business.tradeBlocks[${blockTeamId}].assets must be an array.`);
    }
    for (let index = 0; index < blockValue.assets.length; index += 1) {
      const asset = blockValue.assets[index] as TradeBlockAsset;
      assertRecord(
        asset,
        `business.tradeBlocks[${blockTeamId}].assets[${index}]`,
      );
      if (
        typeof asset.status !== "string" ||
        !isTradeBlockStatus(asset.status)
      ) {
        fail(
          `business.tradeBlocks[${blockTeamId}].assets[${index}].status is invalid.`,
        );
      }
      if (asset.kind === "player") {
        assertNonEmptyString(
          asset.playerId,
          `business.tradeBlocks[${blockTeamId}].assets[${index}].playerId`,
        );
        if (!playerIds.has(asset.playerId)) {
          fail(
            `business.tradeBlocks[${blockTeamId}] player "${asset.playerId}" is missing from world.players.`,
          );
        }
        const player = world.players[asset.playerId] as {
          teamId: string | null;
        };
        if (player.teamId !== blockTeamId) {
          fail(
            `business.tradeBlocks[${blockTeamId}] player "${asset.playerId}" is not owned by that team.`,
          );
        }
      } else if (asset.kind === "draftPick") {
        assertNonEmptyString(
          asset.draftPickId,
          `business.tradeBlocks[${blockTeamId}].assets[${index}].draftPickId`,
        );
        if (!draftPickIds.has(asset.draftPickId)) {
          fail(
            `business.tradeBlocks[${blockTeamId}] pick "${asset.draftPickId}" is missing from world.draftPicks.`,
          );
        }
        const pick = world.draftPicks[asset.draftPickId] as {
          ownerTeamId: string;
        };
        if (pick.ownerTeamId !== blockTeamId) {
          fail(
            `business.tradeBlocks[${blockTeamId}] pick "${asset.draftPickId}" is not owned by that team.`,
          );
        }
      } else {
        fail(
          `business.tradeBlocks[${blockTeamId}].assets[${index}].kind must be "player" or "draftPick".`,
        );
      }
    }
  }

  for (const [standingKey, standingValue] of Object.entries(
    competition.standings.byTeamId,
  )) {
    assertRecord(standingValue, `competition.standings.byTeamId[${standingKey}]`);
    assertNonEmptyString(
      standingValue.teamId,
      `competition.standings.byTeamId[${standingKey}].teamId`,
    );
    if (!teamIds.has(standingKey) || standingValue.teamId !== standingKey) {
      fail(
        `competition.standings.byTeamId entry "${standingKey}" must key and teamId match an existing team.`,
      );
    }
  }

  for (const gameId of competition.schedule.gameIds) {
    if (typeof gameId !== "string" || gameId.length === 0) {
      fail("competition.schedule.gameIds entries must be non-empty strings.");
    }
    if (!gameIds.has(gameId)) {
      fail(
        `competition.schedule.gameIds entry "${gameId}" is missing from competition.games.`,
      );
    }
  }

  for (const [gameKey, gameValue] of Object.entries(competition.games)) {
    validateGame(
      gameKey,
      gameValue,
      seasonId,
      teamIds,
      playerIds,
    );
  }

  validatePlayoffReferences(
    competition.playoffs as PlayoffTournament,
    teamIds,
    gameIds,
  );
}

function validateGame(
  gameKey: string,
  gameValue: unknown,
  seasonId: string,
  teamIds: Set<string>,
  playerIds: Set<string>,
): void {
  assertRecord(gameValue, `competition.games[${gameKey}]`);
  const game = gameValue as Partial<Game>;
  assertNonEmptyString(game.id, `competition.games[${gameKey}].id`);
  if (game.id !== gameKey) {
    fail(`competition.games key "${gameKey}" does not match game.id.`);
  }
  assertNonEmptyString(game.seasonId, `competition.games[${gameKey}].seasonId`);
  if (game.seasonId !== seasonId) {
    fail(
      `competition.games[${gameKey}].seasonId must match competition.season.id.`,
    );
  }
  assertNonEmptyString(game.date, `competition.games[${gameKey}].date`);
  try {
    parseCalendarDate(game.date);
  } catch (error) {
    fail(
      error instanceof Error
        ? `competition.games[${gameKey}].date: ${error.message}`
        : `competition.games[${gameKey}].date is invalid.`,
    );
  }
  assertNonEmptyString(
    game.homeTeamId,
    `competition.games[${gameKey}].homeTeamId`,
  );
  assertNonEmptyString(
    game.awayTeamId,
    `competition.games[${gameKey}].awayTeamId`,
  );
  if (!teamIds.has(game.homeTeamId)) {
    fail(
      `competition.games[${gameKey}].homeTeamId "${game.homeTeamId}" is missing from world.teams.`,
    );
  }
  if (!teamIds.has(game.awayTeamId)) {
    fail(
      `competition.games[${gameKey}].awayTeamId "${game.awayTeamId}" is missing from world.teams.`,
    );
  }
  if (
    typeof game.status !== "string" ||
    !GAME_STATUSES.includes(game.status as (typeof GAME_STATUSES)[number])
  ) {
    fail(
      `competition.games[${gameKey}].status must be one of ${GAME_STATUSES.join(", ")}.`,
    );
  }

  if (
    typeof game.competitionType !== "string" ||
    !GAME_COMPETITION_TYPES.includes(
      game.competitionType as GameCompetitionType,
    )
  ) {
    fail(
      `competition.games[${gameKey}].competitionType must be one of ${GAME_COMPETITION_TYPES.join(", ")}.`,
    );
  }

  validateTeamSnapshotField(
    game.homeTeamSnapshot,
    `competition.games[${gameKey}].homeTeamSnapshot`,
    game.homeTeamId,
    teamIds,
  );
  validateTeamSnapshotField(
    game.awayTeamSnapshot,
    `competition.games[${gameKey}].awayTeamSnapshot`,
    game.awayTeamId,
    teamIds,
  );

  if (!Array.isArray(game.playerStats)) {
    fail(`competition.games[${gameKey}].playerStats must be an array.`);
  }
  for (const [index, stats] of game.playerStats.entries()) {
    assertRecord(stats, `competition.games[${gameKey}].playerStats[${index}]`);
    assertNonEmptyString(
      stats.playerId,
      `competition.games[${gameKey}].playerStats[${index}].playerId`,
    );
    if (!playerIds.has(stats.playerId as string)) {
      fail(
        `competition.games[${gameKey}].playerStats[${index}].playerId "${stats.playerId}" is missing from world.players.`,
      );
    }
    if (stats.teamId != null) {
      assertNonEmptyString(
        stats.teamId,
        `competition.games[${gameKey}].playerStats[${index}].teamId`,
      );
      if (!teamIds.has(stats.teamId as string)) {
        fail(
          `competition.games[${gameKey}].playerStats[${index}].teamId "${stats.teamId}" is missing from world.teams.`,
        );
      }
      if (
        stats.teamId !== game.homeTeamId &&
        stats.teamId !== game.awayTeamId
      ) {
        fail(
          `competition.games[${gameKey}].playerStats[${index}].teamId must be home or away team.`,
        );
      }
    }
    if (stats.firstName != null && typeof stats.firstName !== "string") {
      fail(
        `competition.games[${gameKey}].playerStats[${index}].firstName must be a string or null.`,
      );
    }
    if (stats.lastName != null && typeof stats.lastName !== "string") {
      fail(
        `competition.games[${gameKey}].playerStats[${index}].lastName must be a string or null.`,
      );
    }
  }

  if (!Array.isArray(game.events)) {
    fail(`competition.games[${gameKey}].events must be an array.`);
  }
  for (const [index, event] of game.events.entries()) {
    assertRecord(event, `competition.games[${gameKey}].events[${index}]`);
    if (event.playerId != null) {
      assertNonEmptyString(
        event.playerId,
        `competition.games[${gameKey}].events[${index}].playerId`,
      );
      if (!playerIds.has(event.playerId as string)) {
        fail(
          `competition.games[${gameKey}].events[${index}].playerId "${event.playerId}" is missing from world.players.`,
        );
      }
    }
    if (event.teamId != null) {
      assertNonEmptyString(
        event.teamId,
        `competition.games[${gameKey}].events[${index}].teamId`,
      );
      if (!teamIds.has(event.teamId as string)) {
        fail(
          `competition.games[${gameKey}].events[${index}].teamId "${event.teamId}" is missing from world.teams.`,
        );
      }
    }
  }
}

function validateTeamSnapshotField(
  snapshot: GameTeamSnapshot | null | undefined,
  fieldPath: string,
  expectedTeamId: string | undefined,
  teamIds: Set<string>,
): void {
  if (snapshot == null) {
    return;
  }
  assertRecord(snapshot, fieldPath);
  assertNonEmptyString(snapshot.teamId, `${fieldPath}.teamId`);
  assertNonEmptyString(snapshot.city, `${fieldPath}.city`);
  assertNonEmptyString(snapshot.name, `${fieldPath}.name`);
  assertNonEmptyString(snapshot.abbreviation, `${fieldPath}.abbreviation`);
  assertRecord(snapshot.branding, `${fieldPath}.branding`);
  assertNonEmptyString(
    snapshot.branding.primaryColor,
    `${fieldPath}.branding.primaryColor`,
  );
  assertNonEmptyString(
    snapshot.branding.secondaryColor,
    `${fieldPath}.branding.secondaryColor`,
  );
  assertNonEmptyString(
    snapshot.branding.accentColor,
    `${fieldPath}.branding.accentColor`,
  );
  assertNonEmptyString(
    snapshot.branding.logoId,
    `${fieldPath}.branding.logoId`,
  );
  if (!teamIds.has(snapshot.teamId)) {
    fail(`${fieldPath}.teamId "${snapshot.teamId}" is missing from world.teams.`);
  }
  if (expectedTeamId != null && snapshot.teamId !== expectedTeamId) {
    fail(`${fieldPath}.teamId must match the game's team id.`);
  }
}

function validatePlayoffs(playoffs: Record<string, unknown>): void {
  if (
    typeof playoffs.status !== "string" ||
    !PLAYOFF_TOURNAMENT_STATUSES.includes(
      playoffs.status as (typeof PLAYOFF_TOURNAMENT_STATUSES)[number],
    )
  ) {
    fail(
      `competition.playoffs.status must be one of ${PLAYOFF_TOURNAMENT_STATUSES.join(", ")}.`,
    );
  }
  assertNumber(playoffs.fieldSize, "competition.playoffs.fieldSize");
  if (!Array.isArray(playoffs.qualifiedTeams)) {
    fail("competition.playoffs.qualifiedTeams must be an array.");
  }
  if (!Array.isArray(playoffs.series)) {
    fail("competition.playoffs.series must be an array.");
  }
  for (const [index, series] of playoffs.series.entries()) {
    assertRecord(series, `competition.playoffs.series[${index}]`);
    assertNonEmptyString(
      series.id,
      `competition.playoffs.series[${index}].id`,
    );
    if (
      typeof series.status !== "string" ||
      !PLAYOFF_SERIES_STATUSES.includes(
        series.status as (typeof PLAYOFF_SERIES_STATUSES)[number],
      )
    ) {
      fail(
        `competition.playoffs.series[${index}].status must be one of ${PLAYOFF_SERIES_STATUSES.join(", ")}.`,
      );
    }
  }
}

function validatePlayoffReferences(
  playoffs: PlayoffTournament,
  teamIds: Set<string>,
  gameIds: Set<string>,
): void {
  for (const [index, seed] of playoffs.qualifiedTeams.entries()) {
    if (!teamIds.has(seed.teamId)) {
      fail(
        `competition.playoffs.qualifiedTeams[${index}].teamId "${seed.teamId}" is missing from world.teams.`,
      );
    }
  }

  if (playoffs.championTeamId != null && !teamIds.has(playoffs.championTeamId)) {
    fail(
      `competition.playoffs.championTeamId "${playoffs.championTeamId}" is missing from world.teams.`,
    );
  }

  const seriesIds = new Set(playoffs.series.map((series) => series.id));

  for (const series of playoffs.series) {
    if (
      series.higherSeedTeamId != null &&
      !teamIds.has(series.higherSeedTeamId)
    ) {
      fail(
        `competition.playoffs.series "${series.id}" higherSeedTeamId is missing from world.teams.`,
      );
    }
    if (
      series.lowerSeedTeamId != null &&
      !teamIds.has(series.lowerSeedTeamId)
    ) {
      fail(
        `competition.playoffs.series "${series.id}" lowerSeedTeamId is missing from world.teams.`,
      );
    }
    if (series.winnerTeamId != null && !teamIds.has(series.winnerTeamId)) {
      fail(
        `competition.playoffs.series "${series.id}" winnerTeamId is missing from world.teams.`,
      );
    }
    for (const gameId of series.gameIds) {
      if (!gameIds.has(gameId)) {
        fail(
          `competition.playoffs.series "${series.id}" gameId "${gameId}" is missing from competition.games.`,
        );
      }
    }
    if (series.feederSeriesIds) {
      for (const feederId of series.feederSeriesIds) {
        if (!seriesIds.has(feederId)) {
          fail(
            `competition.playoffs.series "${series.id}" feederSeriesId "${feederId}" is missing from series.`,
          );
        }
      }
    }
    for (const teamId of Object.keys(series.wins)) {
      if (!teamIds.has(teamId)) {
        fail(
          `competition.playoffs.series "${series.id}" wins key "${teamId}" is missing from world.teams.`,
        );
      }
    }
  }
}

/**
 * Structural validation only — no objective-type-specific business rules.
 */
function validateOwnershipConfidence(confidence: OwnershipConfidenceState): void {
  const path = "user.ownershipConfidence";
  if (
    typeof confidence.mood !== "string" ||
    !isOwnershipMood(confidence.mood)
  ) {
    fail(`${path}.mood must be one of ${OWNERSHIP_MOODS.join(", ")}.`);
  }
  assertNumber(confidence.concernLevel, `${path}.concernLevel`);
  if (
    !Number.isFinite(confidence.concernLevel) ||
    confidence.concernLevel < 0 ||
    confidence.concernLevel > 100
  ) {
    fail(`${path}.concernLevel must be between 0 and 100.`);
  }
  assertNumber(confidence.alignmentScore, `${path}.alignmentScore`);
  if (
    !Number.isFinite(confidence.alignmentScore) ||
    confidence.alignmentScore < 0 ||
    confidence.alignmentScore > 100
  ) {
    fail(`${path}.alignmentScore must be between 0 and 100.`);
  }
  if (!Array.isArray(confidence.recentEvidence)) {
    fail(`${path}.recentEvidence must be an array.`);
  }
  if (confidence.recentEvidence.length > OWNERSHIP_EVIDENCE_RING_MAX) {
    fail(
      `${path}.recentEvidence must have at most ${OWNERSHIP_EVIDENCE_RING_MAX} entries.`,
    );
  }
  for (const [index, evidence] of confidence.recentEvidence.entries()) {
    validateAlignmentEvidence(evidence, `${path}.recentEvidence[${index}]`);
  }
  if (!Array.isArray(confidence.recentHelping)) {
    fail(`${path}.recentHelping must be an array.`);
  }
  if (!Array.isArray(confidence.recentHurting)) {
    fail(`${path}.recentHurting must be an array.`);
  }
  for (const [index, line] of confidence.recentHelping.entries()) {
    assertNonEmptyString(line, `${path}.recentHelping[${index}]`);
  }
  for (const [index, line] of confidence.recentHurting.entries()) {
    assertNonEmptyString(line, `${path}.recentHurting[${index}]`);
  }
  assertNonEmptyString(
    confidence.lastConfidenceChangeOn,
    `${path}.lastConfidenceChangeOn`,
  );
  if (confidence.lastPostureCheckOn !== undefined) {
    assertNonEmptyString(
      confidence.lastPostureCheckOn,
      `${path}.lastPostureCheckOn`,
    );
  }
  if (confidence.lastReversal !== undefined) {
    validateStrategicReversal(confidence.lastReversal, `${path}.lastReversal`);
  }
  if (!Array.isArray(confidence.seasonNotes)) {
    fail(`${path}.seasonNotes must be an array.`);
  }
  if (confidence.seasonNotes.length > OWNERSHIP_SEASON_NOTES_MAX) {
    fail(
      `${path}.seasonNotes must have at most ${OWNERSHIP_SEASON_NOTES_MAX} entries.`,
    );
  }
  for (const [index, note] of confidence.seasonNotes.entries()) {
    validateOwnershipSeasonNote(note, `${path}.seasonNotes[${index}]`);
  }
}

function validateAlignmentEvidence(
  evidence: AlignmentEvidence,
  path: string,
): void {
  assertNonEmptyString(evidence.id, `${path}.id`);
  assertNonEmptyString(evidence.occurredOn, `${path}.occurredOn`);
  if (
    typeof evidence.kind !== "string" ||
    !isAlignmentEvidenceKind(evidence.kind)
  ) {
    fail(
      `${path}.kind must be one of ${ALIGNMENT_EVIDENCE_KINDS.join(", ")}.`,
    );
  }
  if (
    typeof evidence.significance !== "string" ||
    !isAlignmentEvidenceSignificance(evidence.significance)
  ) {
    fail(
      `${path}.significance must be one of ${ALIGNMENT_EVIDENCE_SIGNIFICANCES.join(", ")}.`,
    );
  }
  if (
    typeof evidence.direction !== "string" ||
    !isAlignmentEvidenceDirection(evidence.direction)
  ) {
    fail(
      `${path}.direction must be one of ${ALIGNMENT_EVIDENCE_DIRECTIONS.join(", ")}.`,
    );
  }
  assertNonEmptyString(evidence.summary, `${path}.summary`);
  if (evidence.detail !== undefined) {
    assertNonEmptyString(evidence.detail, `${path}.detail`);
  }
  if (
    typeof evidence.dimension !== "string" ||
    !isAlignmentDimension(evidence.dimension)
  ) {
    fail(
      `${path}.dimension must be one of ${ALIGNMENT_DIMENSIONS.join(", ")}.`,
    );
  }
}

function validateStrategicReversal(
  reversal: StrategicReversal,
  path: string,
): void {
  assertNonEmptyString(reversal.priorDirection, `${path}.priorDirection`);
  assertNonEmptyString(reversal.newDirection, `${path}.newDirection`);
  if (typeof reversal.acknowledged !== "boolean") {
    fail(`${path}.acknowledged must be a boolean.`);
  }
  assertNonEmptyString(reversal.summary, `${path}.summary`);
  assertNonEmptyString(reversal.occurredOn, `${path}.occurredOn`);
}

function validateOwnershipSeasonNote(
  note: OwnershipSeasonNote,
  path: string,
): void {
  assertNumber(note.seasonYear, `${path}.seasonYear`);
  if (!Number.isInteger(note.seasonYear)) {
    fail(`${path}.seasonYear must be an integer.`);
  }
  if (typeof note.mood !== "string" || !isOwnershipMood(note.mood)) {
    fail(`${path}.mood must be one of ${OWNERSHIP_MOODS.join(", ")}.`);
  }
  assertNonEmptyString(note.mandateSummary, `${path}.mandateSummary`);
}

function validateOwnerObjectives(objectives: unknown[]): void {
  const seenIds = new Set<string>();

  for (const [index, objectiveValue] of objectives.entries()) {
    const path = `user.objectives[${index}]`;
    assertRecord(objectiveValue, path);
    assertNonEmptyString(objectiveValue.id, `${path}.id`);
    if (seenIds.has(objectiveValue.id)) {
      fail(`user.objectives contains duplicate id "${objectiveValue.id}".`);
    }
    seenIds.add(objectiveValue.id);

    if (
      typeof objectiveValue.type !== "string" ||
      !isOwnerObjectiveType(objectiveValue.type)
    ) {
      fail(
        `${path}.type must be one of ${OWNER_OBJECTIVE_TYPES.join(", ")}.`,
      );
    }

    assertNonEmptyString(objectiveValue.description, `${path}.description`);
    if (objectiveValue.description.trim().length === 0) {
      fail(`${path}.description cannot be whitespace-only.`);
    }

    if (
      typeof objectiveValue.status !== "string" ||
      !isOwnerObjectiveStatus(objectiveValue.status)
    ) {
      fail(
        `${path}.status must be one of ${OWNER_OBJECTIVE_STATUSES.join(", ")}.`,
      );
    }

    assertNumber(objectiveValue.seasonYear, `${path}.seasonYear`);
    if (!Number.isInteger(objectiveValue.seasonYear)) {
      fail(`${path}.seasonYear must be an integer.`);
    }

    if (typeof objectiveValue.consequenceApplied !== "boolean") {
      fail(`${path}.consequenceApplied must be a boolean.`);
    }

    if (
      typeof objectiveValue.category !== "string" ||
      !isOwnerObjectiveCategory(objectiveValue.category)
    ) {
      fail(
        `${path}.category must be one of ${OWNER_OBJECTIVE_CATEGORIES.join(", ")}.`,
      );
    }

    if (
      typeof objectiveValue.lifecycle !== "string" ||
      !isOwnerObjectiveLifecycle(objectiveValue.lifecycle)
    ) {
      fail(
        `${path}.lifecycle must be one of ${OWNER_OBJECTIVE_LIFECYCLES.join(", ")}.`,
      );
    }

    if (
      typeof objectiveValue.role !== "string" ||
      !isOwnerObjectiveRole(objectiveValue.role)
    ) {
      fail(
        `${path}.role must be one of ${OWNER_OBJECTIVE_ROLES.join(", ")}.`,
      );
    }

    if (objectiveValue.target !== undefined) {
      assertNumber(objectiveValue.target, `${path}.target`);
    }

    if (objectiveValue.progress !== undefined) {
      assertNumber(objectiveValue.progress, `${path}.progress`);
      if (objectiveValue.progress < 0) {
        fail(`${path}.progress must be >= 0.`);
      }
    }

    if (objectiveValue.horizonYears !== undefined) {
      assertNumber(objectiveValue.horizonYears, `${path}.horizonYears`);
      if (
        !Number.isInteger(objectiveValue.horizonYears) ||
        objectiveValue.horizonYears < 1
      ) {
        fail(`${path}.horizonYears must be an integer >= 1.`);
      }
    }

    if (objectiveValue.baseline !== undefined) {
      assertNumber(objectiveValue.baseline, `${path}.baseline`);
    }
  }
}

function validateOwnerNotifications(notifications: unknown[]): void {
  const seenIds = new Set<string>();
  const seenDedupeKeys = new Set<string>();

  for (const [index, notificationValue] of notifications.entries()) {
    const path = `user.notifications[${index}]`;
    assertRecord(notificationValue, path);
    assertNonEmptyString(notificationValue.id, `${path}.id`);
    if (seenIds.has(notificationValue.id)) {
      fail(`user.notifications contains duplicate id "${notificationValue.id}".`);
    }
    seenIds.add(notificationValue.id);

    if (
      typeof notificationValue.type !== "string" ||
      !isOwnerNotificationType(notificationValue.type)
    ) {
      fail(
        `${path}.type must be one of ${OWNER_NOTIFICATION_TYPES.join(", ")}.`,
      );
    }

    assertNonEmptyString(notificationValue.title, `${path}.title`);
    assertNonEmptyString(notificationValue.message, `${path}.message`);
    assertNonEmptyString(notificationValue.occurredOn, `${path}.occurredOn`);
    parseCalendarDate(notificationValue.occurredOn);

    if (
      typeof notificationValue.severity !== "string" ||
      !isOwnerNotificationSeverity(notificationValue.severity)
    ) {
      fail(
        `${path}.severity must be one of ${OWNER_NOTIFICATION_SEVERITIES.join(", ")}.`,
      );
    }

    if (typeof notificationValue.read !== "boolean") {
      fail(`${path}.read must be a boolean.`);
    }

    assertNonEmptyString(notificationValue.dedupeKey, `${path}.dedupeKey`);
    if (seenDedupeKeys.has(notificationValue.dedupeKey)) {
      fail(
        `user.notifications contains duplicate dedupeKey "${notificationValue.dedupeKey}".`,
      );
    }
    seenDedupeKeys.add(notificationValue.dedupeKey);

    if (notificationValue.relatedObjectiveId !== undefined) {
      assertNonEmptyString(
        notificationValue.relatedObjectiveId,
        `${path}.relatedObjectiveId`,
      );
    }
    if (notificationValue.relatedTeamId !== undefined) {
      assertNonEmptyString(
        notificationValue.relatedTeamId,
        `${path}.relatedTeamId`,
      );
    }
    if (notificationValue.relatedSituationId !== undefined) {
      assertNonEmptyString(
        notificationValue.relatedSituationId,
        `${path}.relatedSituationId`,
      );
    }
  }
}

function validateNarrativeState(value: unknown): void {
  assertRecord(value, "user.narrative");
  if (!Array.isArray(value.situations)) {
    fail("user.narrative.situations must be an array.");
  }
  if (value.situations.length > NARRATIVE_SITUATIONS_MAX) {
    fail(
      `user.narrative.situations length must be <= ${NARRATIVE_SITUATIONS_MAX}.`,
    );
  }
  if (!Array.isArray(value.snapshots)) {
    fail("user.narrative.snapshots must be an array.");
  }
  if (value.snapshots.length > NARRATIVE_SNAPSHOTS_MAX) {
    fail(
      `user.narrative.snapshots length must be <= ${NARRATIVE_SNAPSHOTS_MAX}.`,
    );
  }
  if (
    value.cooldowns == null ||
    typeof value.cooldowns !== "object" ||
    Array.isArray(value.cooldowns)
  ) {
    fail("user.narrative.cooldowns must be a record.");
  }

  const seenIds = new Set<string>();
  for (const [index, situationValue] of (
    value.situations as unknown[]
  ).entries()) {
    const path = `user.narrative.situations[${index}]`;
    validateNarrativeSituation(situationValue, path, seenIds);
  }

  for (const [index, snapshotValue] of (
    value.snapshots as unknown[]
  ).entries()) {
    const path = `user.narrative.snapshots[${index}]`;
    validateNarrativeMonthSnapshot(snapshotValue, path);
  }

  for (const [key, until] of Object.entries(
    value.cooldowns as Record<string, unknown>,
  )) {
    if (typeof key !== "string" || key.trim().length === 0) {
      fail("user.narrative.cooldowns keys must be non-empty.");
    }
    if (typeof until !== "string" || until.trim().length === 0) {
      fail(`user.narrative.cooldowns["${key}"] must be a non-empty date.`);
    }
    parseCalendarDate(until);
  }
}

function validateNarrativeSituation(
  value: unknown,
  path: string,
  seenIds: Set<string>,
): void {
  assertRecord(value, path);
  assertNonEmptyString(value.id, `${path}.id`);
  if (seenIds.has(value.id)) {
    fail(`user.narrative.situations contains duplicate id "${value.id}".`);
  }
  seenIds.add(value.id);
  assertNonEmptyString(value.detectorKey, `${path}.detectorKey`);
  if (typeof value.category !== "string" || !isNarrativeCategory(value.category)) {
    fail(
      `${path}.category must be one of ${NARRATIVE_CATEGORIES.join(", ")}.`,
    );
  }
  if (typeof value.severity !== "string" || !isNarrativeSeverity(value.severity)) {
    fail(
      `${path}.severity must be one of ${NARRATIVE_SEVERITIES.join(", ")}.`,
    );
  }
  if (
    typeof value.status !== "string" ||
    !isNarrativeSituationStatus(value.status)
  ) {
    fail(
      `${path}.status must be one of ${NARRATIVE_SITUATION_STATUSES.join(", ")}.`,
    );
  }
  assertNumber(value.stage, `${path}.stage`);
  if (!Number.isInteger(value.stage) || (value.stage as number) < 0) {
    fail(`${path}.stage must be a non-negative integer.`);
  }
  assertNonEmptyString(value.title, `${path}.title`);
  assertNonEmptyString(value.summary, `${path}.summary`);
  assertNonEmptyString(value.body, `${path}.body`);
  assertNonEmptyString(value.createdOn, `${path}.createdOn`);
  parseCalendarDate(value.createdOn as string);
  assertNonEmptyString(value.updatedOn, `${path}.updatedOn`);
  parseCalendarDate(value.updatedOn as string);
  if (value.expiresOn !== undefined) {
    assertNonEmptyString(value.expiresOn, `${path}.expiresOn`);
    parseCalendarDate(value.expiresOn as string);
  }
  validateNarrativeEvidence(value.evidence, `${path}.evidence`);
  if (!Array.isArray(value.updates)) {
    fail(`${path}.updates must be an array.`);
  }
  if ((value.updates as unknown[]).length > NARRATIVE_UPDATES_MAX) {
    fail(`${path}.updates length must be <= ${NARRATIVE_UPDATES_MAX}.`);
  }
  for (const [uIndex, updateValue] of (value.updates as unknown[]).entries()) {
    validateNarrativeUpdate(updateValue, `${path}.updates[${uIndex}]`);
  }
  if (value.actions !== undefined) {
    if (!Array.isArray(value.actions)) {
      fail(`${path}.actions must be an array.`);
    }
    for (const [aIndex, actionValue] of (value.actions as unknown[]).entries()) {
      const actionPath = `${path}.actions[${aIndex}]`;
      assertRecord(actionValue, actionPath);
      assertNonEmptyString(actionValue.id, `${actionPath}.id`);
      assertNonEmptyString(actionValue.label, `${actionPath}.label`);
      if (actionValue.href !== undefined) {
        assertNonEmptyString(actionValue.href, `${actionPath}.href`);
      }
      if (actionValue.effectSummary !== undefined) {
        assertNonEmptyString(
          actionValue.effectSummary,
          `${actionPath}.effectSummary`,
        );
      }
    }
  }
  if (value.related !== undefined) {
    assertRecord(value.related, `${path}.related`);
  }
  if (value.relatedNotificationId !== undefined) {
    assertNonEmptyString(
      value.relatedNotificationId,
      `${path}.relatedNotificationId`,
    );
  }
}

function validateNarrativeUpdate(value: unknown, path: string): void {
  assertRecord(value, path);
  assertNonEmptyString(value.occurredOn, `${path}.occurredOn`);
  parseCalendarDate(value.occurredOn as string);
  if (typeof value.severity !== "string" || !isNarrativeSeverity(value.severity)) {
    fail(
      `${path}.severity must be one of ${NARRATIVE_SEVERITIES.join(", ")}.`,
    );
  }
  assertNonEmptyString(value.title, `${path}.title`);
  assertNonEmptyString(value.summary, `${path}.summary`);
  validateNarrativeEvidence(value.evidence, `${path}.evidence`);
}

function validateNarrativeEvidence(value: unknown, path: string): void {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    fail(`${path} must be a record.`);
  }
  for (const [key, entry] of Object.entries(value as NarrativeEvidence)) {
    if (typeof key !== "string" || key.trim().length === 0) {
      fail(`${path} keys must be non-empty.`);
    }
    const t = typeof entry;
    if (t !== "number" && t !== "boolean" && t !== "string") {
      fail(`${path}["${key}"] must be number, boolean, or string.`);
    }
  }
}

function validateNarrativeMonthSnapshot(value: unknown, path: string): void {
  assertRecord(value, path);
  assertNonEmptyString(value.monthId, `${path}.monthId`);
  assertNumber(value.attendanceAvg, `${path}.attendanceAvg`);
  assertNumber(value.fillRatePct, `${path}.fillRatePct`);
  assertNumber(value.ticketMerchRevenue, `${path}.ticketMerchRevenue`);
  assertNumber(value.fanSentiment, `${path}.fanSentiment`);
  assertNumber(value.reputation, `${path}.reputation`);
  assertNumber(value.mediaAttention, `${path}.mediaAttention`);
  assertNumber(value.cash, `${path}.cash`);
  assertNonEmptyString(value.healthBand, `${path}.healthBand`);
  assertNumber(value.wins, `${path}.wins`);
  assertNumber(value.losses, `${path}.losses`);
  assertNumber(value.franchiseValue, `${path}.franchiseValue`);
}

function validateEventLog(
  events: unknown[],
  pathPrefix = "user.eventLog",
): void {
  const seenIds = new Set<string>();
  for (const [index, eventValue] of events.entries()) {
    const path = `${pathPrefix}[${index}]`;
    assertRecord(eventValue, path);
    assertNonEmptyString(eventValue.id, `${path}.id`);
    if (seenIds.has(eventValue.id)) {
      fail(`${pathPrefix} contains duplicate id "${eventValue.id}".`);
    }
    seenIds.add(eventValue.id);

    if (
      typeof eventValue.type !== "string" ||
      !isDomainEventType(eventValue.type)
    ) {
      fail(
        `${path}.type must be one of ${DOMAIN_EVENT_TYPES.join(", ")}.`,
      );
    }

    assertNonEmptyString(eventValue.occurredOn, `${path}.occurredOn`);
    parseCalendarDate(eventValue.occurredOn);

    if (
      eventValue.payload == null ||
      typeof eventValue.payload !== "object" ||
      Array.isArray(eventValue.payload)
    ) {
      fail(`${path}.payload must be a record.`);
    }
  }
}

const BOOKS_BY_YEAR_KEY_PATTERN = /^\d+$/;

function assertNonNegativeIntegerMoney(value: unknown, path: string): void {
  assertNumber(value, path);
  if (!Number.isInteger(value)) {
    fail(`${path} must be an integer.`);
  }
  if (value < 0) {
    fail(`${path} must be >= 0.`);
  }
}

function assertIntegerInRange(
  value: unknown,
  min: number,
  max: number,
  path: string,
): asserts value is number {
  assertNumber(value, path);
  if (!Number.isInteger(value)) {
    fail(`${path} must be an integer.`);
  }
  if (value < min || value > max) {
    fail(`${path} must be between ${min} and ${max}.`);
  }
}

function validateTeamFinanceBooksByYear(
  booksByYear: Record<string, unknown>,
  path: string,
): void {
  for (const [yearKey, booksValue] of Object.entries(booksByYear)) {
    if (!BOOKS_BY_YEAR_KEY_PATTERN.test(yearKey)) {
      fail(`${path} key "${yearKey}" must match /^\\d+$/.`);
    }
    const year = Number(yearKey);
    if (!Number.isInteger(year)) {
      fail(`${path} key "${yearKey}" must represent a finite integer year.`);
    }

    validateTeamFinanceBooksShape(booksValue, `${path}[${yearKey}]`);
  }
}

const BOOKS_BY_MONTH_KEY_PATTERN = /^\d{4}-\d{2}$/;

function validateTeamFinanceBooksByMonth(
  booksByMonth: Record<string, unknown>,
  path: string,
): void {
  for (const [monthKey, booksValue] of Object.entries(booksByMonth)) {
    if (!BOOKS_BY_MONTH_KEY_PATTERN.test(monthKey)) {
      fail(`${path} key "${monthKey}" must match YYYY-MM.`);
    }
    validateTeamFinanceBooksShape(booksValue, `${path}[${monthKey}]`);
  }
}

function validateCashLedgerByMonth(
  ledger: Record<string, unknown>,
  path: string,
): void {
  for (const [monthKey, entry] of Object.entries(ledger)) {
    if (!BOOKS_BY_MONTH_KEY_PATTERN.test(monthKey)) {
      fail(`${path} key "${monthKey}" must match YYYY-MM.`);
    }
    const entryPath = `${path}[${monthKey}]`;
    assertRecord(entry, entryPath);
    assertNumber(entry.openCash, `${entryPath}.openCash`);
    assertNonNegativeIntegerMoney(
      entry.playerPayrollOutflow,
      `${entryPath}.playerPayrollOutflow`,
    );
    assertNumber(entry.netCashChange, `${entryPath}.netCashChange`);
    if (!Number.isInteger(entry.netCashChange)) {
      fail(`${entryPath}.netCashChange must be an integer.`);
    }
  }
}

function validateTeamFinanceBooksShape(booksValue: unknown, booksPath: string): void {
  assertRecord(booksValue, booksPath);
  assertRecord(booksValue.revenue, `${booksPath}.revenue`);
  assertRecord(booksValue.expenses, `${booksPath}.expenses`);

  for (const category of [
    "tickets",
    "premium",
    "merchandise",
    "concessions",
    "sponsorships",
    "broadcast",
    "playoffs",
    "other",
  ] as const) {
    assertNonNegativeIntegerMoney(
      booksValue.revenue[category],
      `${booksPath}.revenue.${category}`,
    );
  }

  for (const category of [
    "staff",
    "facilities",
    "capital",
    "operations",
    "marketing",
  ] as const) {
    assertNonNegativeIntegerMoney(
      booksValue.expenses[category],
      `${booksPath}.expenses.${category}`,
    );
  }
}

function validateScheduledEvents(events: unknown): void {
  assertRecord(events, "world.scheduledEvents");
  for (const [key, value] of Object.entries(events)) {
    const path = `world.scheduledEvents[${key}]`;
    assertRecord(value, path);
    assertNonEmptyString(value.id, `${path}.id`);
    if (value.id !== key) {
      fail(`${path}.id must equal record key "${key}".`);
    }
    asScheduledEventId(value.id);

    if (
      typeof value.type !== "string" ||
      !(SCHEDULED_EVENT_TYPES as readonly string[]).includes(value.type)
    ) {
      fail(
        `${path}.type must be one of ${SCHEDULED_EVENT_TYPES.join(", ")}.`,
      );
    }
    void (value.type as ScheduledEventType);

    assertNonEmptyString(value.triggerDate, `${path}.triggerDate`);
    try {
      parseCalendarDate(value.triggerDate);
    } catch (error) {
      fail(
        error instanceof Error
          ? `${path}.triggerDate: ${error.message}`
          : `${path}.triggerDate is invalid.`,
      );
    }

    if (
      typeof value.status !== "string" ||
      !(SCHEDULED_EVENT_STATUSES as readonly string[]).includes(value.status)
    ) {
      fail(
        `${path}.status must be one of ${SCHEDULED_EVENT_STATUSES.join(", ")}.`,
      );
    }
    void (value.status as ScheduledEventStatus);

    assertRecord(value.payload, `${path}.payload`);
  }
}

function validatePendingOwnerDecision(
  value: unknown,
  path: string,
  failFn: (message: string) => never,
): void {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    failFn(`${path} must be an object.`);
  }
  const decision = value as Record<string, unknown>;
  assertNonEmptyString(decision.id, `${path}.id`);
  if (decision.type !== "trade_offer") {
    failFn(`${path}.type must be "trade_offer".`);
  }
  assertNonEmptyString(decision.createdOn, `${path}.createdOn`);
  parseCalendarDate(decision.createdOn as string);
  if (
    decision.blockingLevel !== "blocking" &&
    decision.blockingLevel !== "non_blocking"
  ) {
    failFn(`${path}.blockingLevel must be "blocking" or "non_blocking".`);
  }
  assertNonEmptyString(decision.primaryTeamId, `${path}.primaryTeamId`);
  if (
    !Array.isArray(decision.participantTeamIds) ||
    decision.participantTeamIds.length < 1
  ) {
    failFn(`${path}.participantTeamIds must be a non-empty array.`);
  }
  for (let i = 0; i < (decision.participantTeamIds as unknown[]).length; i += 1) {
    assertNonEmptyString(
      (decision.participantTeamIds as unknown[])[i],
      `${path}.participantTeamIds[${i}]`,
    );
  }
  if (
    !(decision.participantTeamIds as string[]).includes(
      decision.primaryTeamId as string,
    )
  ) {
    failFn(`${path}.primaryTeamId must be included in participantTeamIds.`);
  }
  validateTradeOfferDecisionPayload(decision.payload, `${path}.payload`, failFn);
}

function validateOwnerDecisionRecord(
  value: unknown,
  path: string,
  failFn: (message: string) => never,
): void {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    failFn(`${path} must be an object.`);
  }
  const record = value as Record<string, unknown>;
  assertNonEmptyString(record.id, `${path}.id`);
  if (record.type !== "trade_offer") {
    failFn(`${path}.type must be "trade_offer".`);
  }
  if (
    record.status !== "accepted" &&
    record.status !== "declined" &&
    record.status !== "delegated"
  ) {
    failFn(
      `${path}.status must be one of accepted, declined, delegated.`,
    );
  }
  if (record.decisionSource !== "owner" && record.decisionSource !== "owner_ai") {
    failFn(`${path}.decisionSource must be "owner" or "owner_ai".`);
  }
  assertNonEmptyString(record.createdOn, `${path}.createdOn`);
  parseCalendarDate(record.createdOn as string);
  assertNonEmptyString(record.resolvedOn, `${path}.resolvedOn`);
  parseCalendarDate(record.resolvedOn as string);
  assertNonEmptyString(record.fingerprint, `${path}.fingerprint`);
  if (
    record.blockingLevel !== "blocking" &&
    record.blockingLevel !== "non_blocking"
  ) {
    failFn(`${path}.blockingLevel must be "blocking" or "non_blocking".`);
  }
  assertNonEmptyString(record.primaryTeamId, `${path}.primaryTeamId`);
  if (
    !Array.isArray(record.participantTeamIds) ||
    record.participantTeamIds.length < 1
  ) {
    failFn(`${path}.participantTeamIds must be a non-empty array.`);
  }
  for (let i = 0; i < (record.participantTeamIds as unknown[]).length; i += 1) {
    assertNonEmptyString(
      (record.participantTeamIds as unknown[])[i],
      `${path}.participantTeamIds[${i}]`,
    );
  }
  if (
    !(record.participantTeamIds as string[]).includes(
      record.primaryTeamId as string,
    )
  ) {
    failFn(`${path}.primaryTeamId must be included in participantTeamIds.`);
  }
  if (record.expiresOn !== undefined) {
    assertNonEmptyString(record.expiresOn, `${path}.expiresOn`);
    parseCalendarDate(record.expiresOn as string);
  }
  validateTradeOfferDecisionPayload(record.payload, `${path}.payload`, failFn);
}

function validateOwnedFranchiseState(
  value: unknown,
  path: string,
  failFn: (message: string) => never,
): void {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    failFn(`${path} must be an object.`);
  }
  const franchise = value as Record<string, unknown>;

  assertNumber(franchise.ownerStartSeasonYear, `${path}.ownerStartSeasonYear`);
  if (
    !Number.isFinite(franchise.ownerStartSeasonYear as number) ||
    !Number.isInteger(franchise.ownerStartSeasonYear as number)
  ) {
    failFn(`${path}.ownerStartSeasonYear must be a finite integer.`);
  }
  assertNumber(franchise.ownerPatience, `${path}.ownerPatience`);
  if (
    !Number.isInteger(franchise.ownerPatience as number) ||
    (franchise.ownerPatience as number) < OWNER_PATIENCE_MIN ||
    (franchise.ownerPatience as number) > OWNER_PATIENCE_MAX
  ) {
    failFn(
      `${path}.ownerPatience must be an integer between ${OWNER_PATIENCE_MIN} and ${OWNER_PATIENCE_MAX}.`,
    );
  }
  if (
    franchise.ownershipConfidence == null ||
    typeof franchise.ownershipConfidence !== "object"
  ) {
    failFn(`${path}.ownershipConfidence is required.`);
  }
  validateOwnershipConfidence(
    franchise.ownershipConfidence as OwnershipConfidenceState,
  );

  if (!Array.isArray(franchise.objectives)) {
    failFn(`${path}.objectives must be an array.`);
  }
  validateOwnerObjectives(franchise.objectives);

  if (!Array.isArray(franchise.notifications)) {
    failFn(`${path}.notifications must be an array.`);
  }
  validateOwnerNotifications(franchise.notifications);

  if (!Array.isArray(franchise.eventLog)) {
    failFn(`${path}.eventLog must be an array.`);
  }
  validateEventLog(franchise.eventLog);

  if (
    franchise.appliedGameplayConsequenceKeys == null ||
    typeof franchise.appliedGameplayConsequenceKeys !== "object" ||
    Array.isArray(franchise.appliedGameplayConsequenceKeys)
  ) {
    failFn(`${path}.appliedGameplayConsequenceKeys must be a record.`);
  }
  for (const [key, val] of Object.entries(
    franchise.appliedGameplayConsequenceKeys as Record<string, unknown>,
  )) {
    if (key.trim().length === 0) {
      failFn(`${path}.appliedGameplayConsequenceKeys keys must be non-empty.`);
    }
    if (val !== true) {
      failFn(`${path}.appliedGameplayConsequenceKeys["${key}"] must be true.`);
    }
  }

  if (
    franchise.explicitDecisions == null ||
    typeof franchise.explicitDecisions !== "object" ||
    Array.isArray(franchise.explicitDecisions)
  ) {
    failFn(`${path}.explicitDecisions must be a record.`);
  }
  for (const [key, val] of Object.entries(
    franchise.explicitDecisions as Record<string, unknown>,
  )) {
    if (key.trim().length === 0) {
      failFn(`${path}.explicitDecisions keys must be non-empty.`);
    }
    if (val !== true) {
      failFn(`${path}.explicitDecisions["${key}"] must be true.`);
    }
  }

  if (!Array.isArray(franchise.phaseSkips)) {
    failFn(`${path}.phaseSkips must be an array.`);
  }
  for (
    let index = 0;
    index < (franchise.phaseSkips as unknown[]).length;
    index += 1
  ) {
    const entry = (franchise.phaseSkips as unknown[])[index];
    const skipPath = `${path}.phaseSkips[${index}]`;
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      failFn(`${skipPath} must be an object.`);
      continue;
    }
    const skip = entry as Record<string, unknown>;
    assertNonEmptyString(skip.phaseKey, `${skipPath}.phaseKey`);
    assertNonEmptyString(skip.skippedOn, `${skipPath}.skippedOn`);
    parseCalendarDate(skip.skippedOn as string);
    assertNonEmptyString(skip.reason, `${skipPath}.reason`);
  }

  if (
    franchise.aiAssistState == null ||
    typeof franchise.aiAssistState !== "object" ||
    Array.isArray(franchise.aiAssistState)
  ) {
    failFn(`${path}.aiAssistState must be an object.`);
  } else {
    const assist = franchise.aiAssistState as Record<string, unknown>;
    if (
      assist.resolvedNeeds == null ||
      typeof assist.resolvedNeeds !== "object" ||
      Array.isArray(assist.resolvedNeeds)
    ) {
      failFn(`${path}.aiAssistState.resolvedNeeds must be a record.`);
    }
    if (
      assist.seasonCounters == null ||
      typeof assist.seasonCounters !== "object" ||
      Array.isArray(assist.seasonCounters)
    ) {
      failFn(`${path}.aiAssistState.seasonCounters must be an object.`);
    } else {
      const counters = assist.seasonCounters as Record<string, unknown>;
      assertNumber(
        counters.seasonYear,
        `${path}.aiAssistState.seasonCounters.seasonYear`,
      );
      assertNumber(
        counters.decisions,
        `${path}.aiAssistState.seasonCounters.decisions`,
      );
      assertNumber(
        counters.rosterMoves,
        `${path}.aiAssistState.seasonCounters.rosterMoves`,
      );
      assertNumber(
        counters.freeAgentSignings,
        `${path}.aiAssistState.seasonCounters.freeAgentSignings`,
      );
    }
  }

  if (
    typeof franchise.managementPreset !== "string" ||
    !isAiManagementPreset(franchise.managementPreset)
  ) {
    failFn(`${path}.managementPreset must be a valid AI management preset.`);
  }
  if (
    franchise.aiAssistance == null ||
    typeof franchise.aiAssistance !== "object" ||
    Array.isArray(franchise.aiAssistance)
  ) {
    failFn(`${path}.aiAssistance must be an object.`);
  } else {
    const assistance = franchise.aiAssistance as Record<string, unknown>;
    for (const key of MANAGEMENT_PHASE_KEYS) {
      if (!(key in assistance)) {
        failFn(`${path}.aiAssistance.${key} is required.`);
      }
    }
  }

  if (franchise.narrative == null) {
    failFn(`${path}.narrative is required.`);
  }
  validateNarrativeState(franchise.narrative);

  if (typeof franchise.citySelectionConfirmed !== "boolean") {
    failFn(`${path}.citySelectionConfirmed must be a boolean.`);
  }
  if (typeof franchise.franchiseIdentityConfirmed !== "boolean") {
    failFn(`${path}.franchiseIdentityConfirmed must be a boolean.`);
  }
}

function validateTradeOfferDecisionPayload(
  value: unknown,
  path: string,
  failFn: (message: string) => never,
): void {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    failFn(`${path} must be an object.`);
  }
  const payload = value as Record<string, unknown>;
  assertNonEmptyString(payload.offeringTeamId, `${path}.offeringTeamId`);
  assertNonEmptyString(payload.userTeamId, `${path}.userTeamId`);
  assertNonEmptyString(payload.fingerprint, `${path}.fingerprint`);
  if (
    payload.proposal === null ||
    typeof payload.proposal !== "object" ||
    Array.isArray(payload.proposal)
  ) {
    failFn(`${path}.proposal must be an object.`);
  }
  const proposal = payload.proposal as Record<string, unknown>;
  validateTradeSide(proposal.sideA, `${path}.proposal.sideA`, failFn);
  validateTradeSide(proposal.sideB, `${path}.proposal.sideB`, failFn);
}

function validateTradeSide(
  value: unknown,
  path: string,
  failFn: (message: string) => never,
): void {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    failFn(`${path} must be an object.`);
  }
  const side = value as Record<string, unknown>;
  assertNonEmptyString(side.teamId, `${path}.teamId`);
  if (!Array.isArray(side.playerIds)) {
    failFn(`${path}.playerIds must be an array.`);
  }
  if (!Array.isArray(side.draftPickIds)) {
    failFn(`${path}.draftPickIds must be an array.`);
  }
  for (let i = 0; i < (side.playerIds as unknown[]).length; i += 1) {
    assertNonEmptyString(
      (side.playerIds as unknown[])[i],
      `${path}.playerIds[${i}]`,
    );
  }
  for (let i = 0; i < (side.draftPickIds as unknown[]).length; i += 1) {
    assertNonEmptyString(
      (side.draftPickIds as unknown[])[i],
      `${path}.draftPickIds[${i}]`,
    );
  }
}

