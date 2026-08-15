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
import { GAME_STATUSES, type Game } from "@/domain/entities/game";
import type { PlayoffTournament } from "@/domain/entities/playoffs";
import {
  isOwnerObjectiveType,
  OWNER_OBJECTIVE_TYPES,
} from "@/domain/entities/owner-objective";
import {
  isTradeBlockStatus,
  type TradeBlockAsset,
} from "@/domain/entities/trade-block";
import type { SeasonPhase } from "@/domain/entities/season";
import type { GameState, GameMode } from "@/state/game-state";
import { GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";
import {
  asContractId,
  asOfferId,
  asPlayerId,
  asTeamId,
} from "@/domain/ids";

const SEASON_PHASES: readonly SeasonPhase[] = [
  "preseason",
  "regular",
  "playoffs",
  "offseason",
];

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

/**
 * Validates structural and referential integrity of a GameState at the
 * persistence boundary. Does not mutate input. Throws on failure.
 */
export function validateGameState(state: unknown): asserts state is GameState {
  assertRecord(state, "GameState");

  for (const key of ["meta", "world", "competition", "business", "user"] as const) {
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

  const competition = state.competition;
  assertRecord(competition, "competition");
  for (const key of [
    "season",
    "schedule",
    "games",
    "standings",
    "playoffs",
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

  const user = state.user;
  assertRecord(user, "user");
  if (!("controlledTeamId" in user) || user.controlledTeamId == null) {
    fail("user.controlledTeamId is required.");
  }
  assertNonEmptyString(user.controlledTeamId, "user.controlledTeamId");
  if (
    typeof user.mode !== "string" ||
    !GAME_MODES.includes(user.mode as GameMode)
  ) {
    fail(`user.mode must be one of ${GAME_MODES.join(", ")}.`);
  }
  if (!("objectives" in user) || !Array.isArray(user.objectives)) {
    fail("user.objectives must be an array.");
  }
  validateOwnerObjectives(user.objectives);

  const teamIds = new Set(Object.keys(world.teams));
  const playerIds = new Set(Object.keys(world.players));
  const contractIds = new Set(Object.keys(business.contracts));
  const gameIds = new Set(Object.keys(competition.games));
  const seasonId = competition.season.id;

  if (!teamIds.has(user.controlledTeamId)) {
    fail(
      `user.controlledTeamId "${user.controlledTeamId}" is missing from world.teams.`,
    );
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
      if (signedPlayer.contractId !== acceptedContractId) {
        fail(
          `business.freeAgency.offers[${offerId}] accepted: player.contractId must equal offer.contractId.`,
        );
      }
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

  const rosterMembership = new Map<string, string>();
  for (const [teamId, teamValue] of Object.entries(world.teams)) {
    assertRecord(teamValue, `world.teams[${teamId}]`);
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
        if (worldPlayer.teamId == null) {
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

    if (typeof objectiveValue.completed !== "boolean") {
      fail(`${path}.completed must be a boolean.`);
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

    const booksPath = `${path}[${yearKey}]`;
    assertRecord(booksValue, booksPath);
    assertRecord(booksValue.revenue, `${booksPath}.revenue`);
    assertRecord(booksValue.expenses, `${booksPath}.expenses`);

    for (const category of [
      "tickets",
      "sponsorships",
      "merchandise",
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
      "operations",
      "marketing",
    ] as const) {
      assertNonNegativeIntegerMoney(
        booksValue.expenses[category],
        `${booksPath}.expenses.${category}`,
      );
    }
  }
}
