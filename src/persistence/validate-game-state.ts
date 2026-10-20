import { isJerseyNumber } from "@/domain/jersey-number";
import {
  type GameMode,
  type GameState,
  GAME_STATE_SCHEMA_VERSION,
} from "@/state/game-state";
import { parseCalendarDate } from "@/domain/calendar-date";
import { validateGameSettings } from "@/domain/game-settings-validation";
import { participationStateErrors } from "@/domain/participation";
import {
  SEASON_PHASES,
  type SeasonPhase,
  OFFSEASON_STAGES,
  type OffseasonStage,
} from "@/domain/entities/season";
import { isLeaguePhaseId, LEAGUE_PHASE_IDS } from "@/systems/phase-engine";
import { isAiProfile, isOwnershipAxis } from "@/domain/entities/franchise-ops";
import {
  isStaffRole,
  STAFF_ROLES,
  assertStaffShape,
  type Staff,
} from "@/domain/entities/staff";
import { assertContractShape } from "@/domain/entities/contract";
import { asContractId, asPlayerId, asTeamId, asOfferId } from "@/domain/ids";
import {
  assertFreeAgencyOfferShape,
  type FreeAgencyOfferStatus,
  isOpenOffer,
} from "@/domain/entities/free-agency-offer";
import {
  isDraftLifecycleStatus,
  isDraftProspectStatus,
  isDraftOrderSlotStatus,
} from "@/domain/entities/draft";
import {
  type TradeBlockAsset,
  isTradeBlockStatus,
} from "@/domain/entities/trade-block";
import type { PlayoffTournament } from "@/domain/entities/playoffs";
import {
  fail,
  assertRecord,
  assertNonEmptyString,
  assertNumber,
} from "@/persistence/validate-game-state/primitives";
import { validateFantasyDraft } from "@/persistence/validate-game-state/fantasy-draft";
import {
  validateScheduledEvents,
  validatePendingOwnerDecision,
  validateOwnerDecisionRecord,
  validatePendingDraftClassDecision,
} from "@/persistence/validate-game-state/decisions";
import {
  validatePlayoffs,
  validateEventLog,
  validateGame,
  validatePlayByPlayLogs,
  validatePlayoffReferences,
} from "@/persistence/validate-game-state/competition";
import { validateOwnedFranchiseState } from "@/persistence/validate-game-state/owned-franchise";
import {
  validateTeamFinanceBooksByYear,
  validateTeamFinanceBooksByMonth,
  validateCashLedgerByMonth,
} from "@/persistence/validate-game-state/finances";

const GAME_MODES: readonly GameMode[] = ["owner"];

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
    "fantasyDraft",
    "scheduledEvents",
    "playerPortraits",
  ] as const) {
    if (!(key in world)) {
      fail(`world missing required field "${key}".`);
    }
  }

  assertRecord(world.calendar, "world.calendar");
  assertNonEmptyString(
    world.calendar.currentDate,
    "world.calendar.currentDate",
  );
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
    fail(
      "world.calendar.lastSimulatedDate must be a YYYY-MM-DD string or null.",
    );
  }

  if (world.calendar.lastSimulatedWeekId === null) {
    // ok
  } else if (typeof world.calendar.lastSimulatedWeekId === "string") {
    assertNonEmptyString(
      world.calendar.lastSimulatedWeekId,
      "world.calendar.lastSimulatedWeekId",
    );
  } else {
    fail(
      "world.calendar.lastSimulatedWeekId must be a non-empty string or null.",
    );
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
  assertRecord(world.staffMarket, "world.staffMarket");
  assertRecord(world.staffMarket.offers, "world.staffMarket.offers");
  assertRecord(world.draftPicks, "world.draftPicks");
  assertRecord(world.drafts, "world.drafts");
  if (world.fantasyDraft !== null && world.fantasyDraft !== undefined) {
    validateFantasyDraft(world.fantasyDraft, world, fail);
  } else if (world.fantasyDraft === undefined) {
    fail("world.fantasyDraft must be present (null or FantasyDraft).");
  }
  assertRecord(world.scheduledEvents, "world.scheduledEvents");
  validateScheduledEvents(world.scheduledEvents);
  // Shape only: entries are presentation identity, and coverage is filled by
  // ensurePlayerPortraits at persist time. Invalid entries render a fallback.
  assertRecord(world.playerPortraits, "world.playerPortraits");

  const competition = state.competition;
  assertRecord(competition, "competition");
  for (const key of [
    "season",
    "phase",
    "schedule",
    "games",
    "playByPlay",
    "standings",
    "playoffs",
    "developmentLeague",
    "seasonEventLog",
    "seasonEvents",
    "aiTradeSearch",
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
      fail(
        "competition.season.regularSeasonStartDate must be a string or null.",
      );
    }
  } else if (competition.season.regularSeasonStartDate === undefined) {
    fail(
      "competition.season.regularSeasonStartDate is required (string or null).",
    );
  }

  assertOptionalCalendarDate(
    competition.season.offseasonStageEnteredDate,
    "competition.season.offseasonStageEnteredDate",
  );
  assertOptionalCalendarDate(
    competition.season.freeAgencyExtendedUntil,
    "competition.season.freeAgencyExtendedUntil",
  );
  assertOptionalCalendarDate(
    competition.season.tradeDeadlineDate ?? null,
    "competition.season.tradeDeadlineDate",
  );
  if (
    competition.season.rfaQualificationComplete !== undefined &&
    typeof competition.season.rfaQualificationComplete !== "boolean"
  ) {
    fail("competition.season.rfaQualificationComplete must be a boolean.");
  }

  assertRecord(competition.phase, "competition.phase");
  if (
    typeof competition.phase.activePhaseId !== "string" ||
    !isLeaguePhaseId(competition.phase.activePhaseId)
  ) {
    fail(
      `competition.phase.activePhaseId must be one of ${LEAGUE_PHASE_IDS.join(", ")}.`,
    );
  }
  assertNonEmptyString(
    competition.phase.enteredDate,
    "competition.phase.enteredDate",
  );
  parseCalendarDate(competition.phase.enteredDate as string);

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
  assertRecord(
    competition.standings.byTeamId,
    "competition.standings.byTeamId",
  );

  assertRecord(competition.aiTradeSearch, "competition.aiTradeSearch");
  assertRecord(
    competition.aiTradeSearch.byTeamId,
    "competition.aiTradeSearch.byTeamId",
  );
  for (const [teamId, record] of Object.entries(
    competition.aiTradeSearch.byTeamId,
  )) {
    const path = `competition.aiTradeSearch.byTeamId[${teamId}]`;
    assertRecord(record, path);
    assertNonEmptyString(record.lastSearchDate, `${path}.lastSearchDate`);
    parseCalendarDate(record.lastSearchDate);
    assertNonEmptyString(record.inputsKey, `${path}.inputsKey`);
  }

  if (competition.playoffs === null || competition.playoffs === undefined) {
    fail("competition.playoffs is required.");
  }
  assertRecord(competition.playoffs, "competition.playoffs");
  validatePlayoffs(competition.playoffs);

  if (
    competition.developmentLeague === null ||
    competition.developmentLeague === undefined
  ) {
    fail("competition.developmentLeague is required.");
  }
  assertRecord(competition.developmentLeague, "competition.developmentLeague");
  assertRecord(
    competition.developmentLeague.schedule,
    "competition.developmentLeague.schedule",
  );
  assertRecord(
    competition.developmentLeague.games,
    "competition.developmentLeague.games",
  );
  assertRecord(
    competition.developmentLeague.standings,
    "competition.developmentLeague.standings",
  );

  if (!Array.isArray(competition.seasonEventLog)) {
    fail("competition.seasonEventLog must be an array.");
  }
  validateEventLog(competition.seasonEventLog, "competition.seasonEventLog");

  assertRecord(competition.seasonEvents, "competition.seasonEvents");
  assertRecord(
    competition.seasonEvents.events,
    "competition.seasonEvents.events",
  );
  assertRecord(
    competition.seasonEvents.fanVoting,
    "competition.seasonEvents.fanVoting",
  );
  assertRecord(
    competition.seasonEvents.holidays,
    "competition.seasonEvents.holidays",
  );

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
  if (!("awards" in business) || business.awards == null) {
    fail("business.awards is required.");
  }
  assertRecord(business.awards, "business.awards");
  if (!("results" in business.awards) || business.awards.results == null) {
    fail("business.awards.results is required.");
  }
  assertRecord(business.awards.results, "business.awards.results");
  if (
    !("gameDayPromotionsByTeamId" in business) ||
    business.gameDayPromotionsByTeamId == null
  ) {
    fail("business.gameDayPromotionsByTeamId is required.");
  }
  assertRecord(
    business.gameDayPromotionsByTeamId,
    "business.gameDayPromotionsByTeamId",
  );
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
    if (!(teamId in business.gameDayPromotionsByTeamId)) {
      fail(`business.gameDayPromotionsByTeamId missing team "${teamId}".`);
    }
    const promo = (
      business.gameDayPromotionsByTeamId as Record<string, unknown>
    )[teamId];
    assertRecord(promo, `business.gameDayPromotionsByTeamId[${teamId}]`);
    if (typeof promo.committedSpend !== "number") {
      fail(
        `business.gameDayPromotionsByTeamId[${teamId}].committedSpend must be a number.`,
      );
    }
    assertRecord(
      promo.assignments,
      `business.gameDayPromotionsByTeamId[${teamId}].assignments`,
    );
    assertRecord(
      promo.results,
      `business.gameDayPromotionsByTeamId[${teamId}].results`,
    );
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
    if (ops.homeFillSeries !== undefined) {
      if (
        !Array.isArray(ops.homeFillSeries) ||
        ops.homeFillSeries.some((fill) => typeof fill !== "number")
      ) {
        fail(
          `business.franchiseOps[${teamId}].homeFillSeries must be an array of numbers.`,
        );
      }
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
    if (!isStaffRole(staffValue.role)) {
      fail(
        `world.staff[${staffId}].role must be one of ${STAFF_ROLES.join(", ")}.`,
      );
    }
    try {
      assertStaffShape(staffValue as Staff);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      fail(`world.staff[${staffId}]: ${detail}`);
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

  const participationErrors = participationStateErrors(
    user.participation,
    user.ownedTeamIds as string[],
    user.activeOwnerTeamId as string,
  );
  if (participationErrors.length > 0) {
    fail(participationErrors.join(" "));
  }

  if (
    !("pendingOwnerDecisions" in user) ||
    !Array.isArray(user.pendingOwnerDecisions)
  ) {
    fail("user.pendingOwnerDecisions must be an array.");
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

  if (
    !("pendingDraftClassDecisions" in user) ||
    user.pendingDraftClassDecisions === null ||
    typeof user.pendingDraftClassDecisions !== "object" ||
    Array.isArray(user.pendingDraftClassDecisions)
  ) {
    fail("user.pendingDraftClassDecisions must be an object.");
  } else {
    for (const [key, rawDecision] of Object.entries(
      user.pendingDraftClassDecisions as Record<string, unknown>,
    )) {
      validatePendingDraftClassDecision(
        rawDecision,
        `user.pendingDraftClassDecisions[${key}]`,
        key,
        fail,
      );
    }
  }

  assertRecord(user.franchisePhaseState, "user.franchisePhaseState");
  for (const [teamKey, entry] of Object.entries(
    user.franchisePhaseState as Record<string, unknown>,
  )) {
    assertRecord(entry, `user.franchisePhaseState[${teamKey}]`);
    if (!Array.isArray((entry as { dismissed?: unknown }).dismissed)) {
      fail(`user.franchisePhaseState[${teamKey}].dismissed must be an array.`);
    }
    for (
      let index = 0;
      index < (entry as { dismissed: unknown[] }).dismissed.length;
      index += 1
    ) {
      const dismissed = (entry as { dismissed: unknown[] }).dismissed[index];
      assertRecord(
        dismissed,
        `user.franchisePhaseState[${teamKey}].dismissed[${index}]`,
      );
      assertNonEmptyString(
        (dismissed as { taskKey?: unknown }).taskKey,
        `user.franchisePhaseState[${teamKey}].dismissed[${index}].taskKey`,
      );
      if (
        typeof (dismissed as { phaseId?: unknown }).phaseId !== "string" ||
        !isLeaguePhaseId((dismissed as { phaseId: string }).phaseId)
      ) {
        fail(
          `user.franchisePhaseState[${teamKey}].dismissed[${index}].phaseId must be a LeaguePhaseId.`,
        );
      }
    }
  }

  const teamIds = new Set(Object.keys(world.teams));
  const playerIds = new Set(Object.keys(world.players));
  const contractIds = new Set(Object.keys(business.contracts));
  const gameIds = new Set(Object.keys(competition.games));
  const seasonId = competition.season.id;

  for (const ownedId of ownedTeamIdSet) {
    if (!teamIds.has(ownedId)) {
      fail(`user.ownedTeamIds entry "${ownedId}" is missing from world.teams.`);
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
    if (!isJerseyNumber(playerValue.jerseyNumber)) {
      fail(
        `world.players[${playerId}].jerseyNumber must be an integer from 0 to 99.`,
      );
    }
    if (playerValue.jerseyTeamId !== undefined) {
      assertNonEmptyString(
        playerValue.jerseyTeamId,
        `world.players[${playerId}].jerseyTeamId`,
      );
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

  for (const [contractId, contractValue] of Object.entries(
    business.contracts,
  )) {
    assertRecord(contractValue, `business.contracts[${contractId}]`);
    assertNonEmptyString(
      contractValue.id,
      `business.contracts[${contractId}].id`,
    );
    if (contractValue.id !== contractId) {
      fail(
        `business.contracts key "${contractId}" does not match contract.id.`,
      );
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
    const businessFundsValue =
      typeof financeValue.businessFunds === "number"
        ? financeValue.businessFunds
        : financeValue.cash;
    assertNumber(
      businessFundsValue,
      `business.finances[${financeKey}].businessFunds`,
    );
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
    const ledger =
      financeValue.businessFundsLedgerByMonth ?? financeValue.cashLedgerByMonth;
    assertRecord(
      ledger,
      `business.finances[${financeKey}].businessFundsLedgerByMonth`,
    );
    validateCashLedgerByMonth(
      ledger as Record<string, unknown>,
      `business.finances[${financeKey}].businessFundsLedgerByMonth`,
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
      const signedPlayer = world.players[offerValue.playerId as string];
      assertRecord(signedPlayer, `world.players[${offerValue.playerId}]`);
      if (!contractIds.has(acceptedContractId)) {
        // Retirement (and custom-content edits) delete the contract while the
        // accepted offer stays as history. Only a live binding must resolve.
        if (signedPlayer.contractId === acceptedContractId) {
          fail(
            `business.freeAgency.offers[${offerId}].contractId "${acceptedContractId}" is missing from business.contracts.`,
          );
        }
        continue;
      }
      const linkedContract = business.contracts[acceptedContractId];
      assertRecord(linkedContract, `business.contracts[${acceptedContractId}]`);
      if (linkedContract.playerId !== offerValue.playerId) {
        fail(
          `business.freeAgency.offers[${offerId}] accepted contract playerId must match offer.playerId.`,
        );
      }
      // A trade moves the contract (same id) to the acquiring team, so the
      // current holder may differ from the signing team. Live membership is
      // checked against the holder, which must be a real team.
      const holderTeamId = linkedContract.teamId as string;
      if (
        holderTeamId !== offerValue.teamId &&
        !(holderTeamId in world.teams)
      ) {
        fail(
          `business.freeAgency.offers[${offerId}] accepted contract teamId must match offer.teamId or a team that acquired the contract.`,
        );
      }
      // Accepted offers are historical records. Live membership invariants apply
      // only while the offer's contract is still the player's current binding.
      // After expiration/release/re-sign, player.contractId diverges — that is valid.
      if (signedPlayer.contractId === acceptedContractId) {
        if (signedPlayer.teamId !== holderTeamId) {
          fail(
            `business.freeAgency.offers[${offerId}] accepted: player.teamId must equal the contract's team.`,
          );
        }
        const holderTeam = world.teams[holderTeamId];
        assertRecord(holderTeam, `world.teams[${holderTeamId}]`);
        if (!Array.isArray(holderTeam.roster)) {
          fail(`world.teams[${holderTeamId}].roster must be an array.`);
        }
        if (!(holderTeam.roster as unknown[]).includes(offerValue.playerId)) {
          fail(
            `business.freeAgency.offers[${offerId}] accepted: player must be on the contract team's roster.`,
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

  // DL-assigned players: franchise ownership via teamId, not on Team.roster
  for (const [playerId, playerValue] of Object.entries(
    world.players as Record<string, { teamId?: string | null }>,
  )) {
    const dl = (
      playerValue as {
        developmentLeague?: { status?: string; parentTeamId?: string | null };
      }
    ).developmentLeague;
    if (dl?.status !== "assigned") {
      continue;
    }
    if (rosterMembership.has(playerId)) {
      fail(
        `Player "${playerId}" is Development League–assigned but still appears on a top-league roster.`,
      );
    }
    if (playerValue.teamId == null) {
      fail(
        `Player "${playerId}" is Development League–assigned but has null teamId.`,
      );
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
    assertNumber(
      pickValue.seasonYear,
      `world.draftPicks[${pickId}].seasonYear`,
    );
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
        if (draftValue.status === "active" && worldPlayer.teamId == null) {
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

    if (draftValue.teamDraftState === undefined) {
      fail(`world.drafts[${draftId}].teamDraftState is required.`);
    } else {
      assertRecord(
        draftValue.teamDraftState,
        `world.drafts[${draftId}].teamDraftState`,
      );
    }
    if (!Array.isArray(draftValue.pickResults)) {
      fail(`world.drafts[${draftId}].pickResults must be an array.`);
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

  for (const [blockTeamId, blockValue] of Object.entries(
    business.tradeBlocks,
  )) {
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
    assertRecord(
      standingValue,
      `competition.standings.byTeamId[${standingKey}]`,
    );
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
    validateGame(gameKey, gameValue, seasonId, teamIds, playerIds);
  }
  validatePlayByPlayLogs(state as GameState);

  validatePlayoffReferences(
    competition.playoffs as PlayoffTournament,
    teamIds,
    gameIds,
  );
}
