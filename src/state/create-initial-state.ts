import { createEmptyPlayoffTournament } from "@/domain/entities/playoffs";
import { createEmptyTeamStanding } from "@/domain/entities/standings";
import {
  createTeam,
  NEUTRAL_TEAM_PLAY_STYLE,
} from "@/domain/entities/team";
import { DEFAULT_COACHING_PHILOSOPHY } from "@/domain/coaching/coaching-philosophy";
import { createSeededRng } from "@/domain/rng";
import {
  cloneGameSettings,
  CBL_GAME_SETTINGS,
  DEFAULT_GAME_SETTINGS,
  isSupportedTeamCount,
  type GameSettings,
} from "@/domain/game-settings";
import { validateGameSettings } from "@/domain/game-settings-validation";
import { DEFAULT_BUSINESS_FUNDS } from "@/systems/business-funds-config";
import {
  asArenaId,
  asConferenceId,
  asDivisionId,
  asLeagueId,
  asSaveId,
  asSeasonId,
  asTeamId,
  type ConferenceId,
  type DivisionId,
  type TeamId,
} from "@/domain/ids";
import {
  EMPTY_STAFF_MARKET,
  GAME_STATE_SCHEMA_VERSION,
  type GameState,
} from "@/state/game-state";
import { createDefaultOwnedFranchiseState } from "@/state/owned-franchise-state";
import { createPhaseEBusinessDefaults } from "@/state/phase-e-defaults";
import { generateLeague } from "@/systems/league-generation";
import { leagueGenerationConfigFromSettings } from "@/systems/league-shape";
import { generateLeagueStaff } from "@/systems/staff-generation";
import { resolvePaletteIdFromBranding } from "@/domain/entities/team-branding";
import { paletteLogoKey } from "@/domain/team-identity";
import { deriveDefaultTeamBranding } from "@/systems/team-branding-generation";

export type CreateInitialGameStateInput = {
  saveId: string;
  rngSeed?: number;
  nowIso?: string;
  /** Career configuration; defaults to Standard (30/82/16). */
  settings?: GameSettings;
};

function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function bootstrapTeam(
  id: TeamId,
  divisionId: DivisionId,
  conferenceId: ConferenceId,
  city: string,
  name: string,
  abbreviation: string,
  usedPaletteLogoKeys?: Set<string>,
) {
  const branding = deriveDefaultTeamBranding(
    id,
    city,
    name,
    usedPaletteLogoKeys,
  );
  const paletteId = resolvePaletteIdFromBranding(branding);
  if (paletteId && usedPaletteLogoKeys) {
    usedPaletteLogoKeys.add(paletteLogoKey(paletteId, branding.logoId));
  }
  return createTeam({
    id,
    divisionId,
    conferenceId,
    city,
    name,
    abbreviation,
    roster: [],
    staff: [],
    finances: {},
    arenaId: asArenaId(`arena_${id}`),
    reputation: 50,
    playStyle: { ...NEUTRAL_TEAM_PLAY_STYLE },
    coachingPhilosophy: { ...DEFAULT_COACHING_PHILOSOPHY },
    branding,
  });
}

/**
 * Production Owner Mode new-game universe from GameSettings.
 * Defaults to Standard (30 teams). Pass CBL_GAME_SETTINGS for 12-team tests.
 * Application bootstrap fills players/contracts via generateRosters.
 * Placeholder activeOwnerTeamId is the first sorted team id until city/team selection.
 */
export function createInitialGameState(
  input: CreateInitialGameStateInput,
): GameState {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const saveId = asSaveId(input.saveId);
  const rngSeed = input.rngSeed ?? 1;
  const rng = createSeededRng(rngSeed);

  const settingsInput = cloneGameSettings(input.settings ?? DEFAULT_GAME_SETTINGS);
  const validated = validateGameSettings(settingsInput, {
    mode: isSupportedTeamCount(settingsInput.league.teamCount)
      ? "newSave"
      : "persisted",
  });
  if (!validated.ok) {
    throw new Error(
      `Invalid GameSettings: ${validated.errors.join("; ")}`,
    );
  }
  const settings = validated.settings;

  const generated = generateLeague(
    leagueGenerationConfigFromSettings({
      leagueId: `league_${saveId}`,
      leagueName: "Continental Basketball League",
      leagueAbbreviation: "CBL",
      teamCount: settings.league.teamCount,
      conferenceCount: settings.league.conferenceCount,
      divisionsEnabled: settings.league.divisionsEnabled,
      rosterSize: 0,
      area: settings.league.area ?? "north_america",
    }),
    rng,
  );

  const teams = Object.fromEntries(
    generated.teams.map((team) => [team.id, team]),
  );
  const conferences = Object.fromEntries(
    generated.conferences.map((conference) => [conference.id, conference]),
  );
  const divisions = Object.fromEntries(
    generated.divisions.map((division) => [division.id, division]),
  );

  const teamIds = Object.keys(teams).sort() as TeamId[];
  const activeOwnerTeamId = teamIds[0]!;

  const finances = Object.fromEntries(
    teamIds.map((teamId) => [
      teamId,
      {
        teamId,
        businessFunds: DEFAULT_BUSINESS_FUNDS,
        payroll: 0,
        booksByYear: {},
        attendanceByYear: {},
        booksByMonth: {},
        businessFundsLedgerByMonth: {},
      },
    ]),
  );

  const standings = {
    byTeamId: Object.fromEntries(
      teamIds.map((teamId) => [teamId, createEmptyTeamStanding(teamId)]),
    ),
  };

  const seasonId = asSeasonId(`season_${saveId}_2026`);
  const startingSeasonYear = 2026;
  const phaseE = createPhaseEBusinessDefaults(teamIds, rngSeed, startingSeasonYear);

  let state: GameState = {
    meta: {
      saveId,
      schemaVersion: GAME_STATE_SCHEMA_VERSION,
      createdAt: nowIso,
      updatedAt: nowIso,
      rngSeed,
      rngState: rng.getState(),
    },
    settings: cloneGameSettings(settings),
    world: {
      calendar: {
        currentDate: "2026-10-01",
        lastSimulatedDate: null,
        lastSimulatedWeekId: null,
        lastSimulatedMonthId: null,
      },
      league: generated.league,
      conferences,
      divisions,
      teams,
      players: {},
      coaches: {},
      staff: {},
      staffMarket: EMPTY_STAFF_MARKET,
      draftPicks: {},
      drafts: {},
      fantasyDraft: null,
      scheduledEvents: {},
    },
    competition: {
      season: {
        id: seasonId,
        year: startingSeasonYear,
        phase: "preseason",
        offseasonStage: "none",
        regularSeasonStartDate: null,
        tradeDeadlineDate: null,
        rfaQualificationComplete: false,
        offseasonStageEnteredDate: null,
        freeAgencyExtendedUntil: null,
      },
      phase: {
        activePhaseId: "preseason.preparation",
        enteredDate: `${startingSeasonYear}-10-01`,
      },
      schedule: {
        seasonId,
        gameIds: [],
        gameIdsByDate: {},
      },
      games: {},
      standings,
      playoffs: createEmptyPlayoffTournament(),
      seasonEventLog: [],
    },
    business: {
      contracts: {},
      finances,
      freeAgency: {
        offers: {},
      },
      rfaStatuses: {},
      tradeBlocks: {},
      ...phaseE,
    },
    user: {
      ownedTeamIds: [activeOwnerTeamId],
      activeOwnerTeamId,
      ownedFranchises: {
        [activeOwnerTeamId]: createDefaultOwnedFranchiseState({
          seasonYear: startingSeasonYear,
          currentDate: `${startingSeasonYear}-10-01`,
          citySelectionConfirmed: false,
          franchiseIdentityConfirmed: false,
        }),
      },
      mode: "owner",
      pendingOwnerDecisions: [],
      ownerDecisionHistory: [],
      franchisePhaseState: {
        [activeOwnerTeamId]: { dismissed: [] },
      },
    },
  };

  state = generateLeagueStaff(state, rng);
  return {
    ...state,
    meta: {
      ...state.meta,
      rngState: rng.getState(),
    },
  };
}

/** Convenience for tests that need the classic 12-team CBL. */
export function createCblInitialGameState(
  input: Omit<CreateInitialGameStateInput, "settings">,
): GameState {
  return createInitialGameState({
    ...input,
    settings: CBL_GAME_SETTINGS,
  });
}

/**
 * Four-team fixture for small-league tests (4-team playoffs).
 * Not used for production Owner Mode new games.
 */
export function createFourTeamInitialGameState(
  input: CreateInitialGameStateInput,
): GameState {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const saveId = asSaveId(input.saveId);
  const rngSeed = input.rngSeed ?? 1;

  const leagueId = asLeagueId(createId("league"));
  const eastId = asConferenceId(createId("conf"));
  const westId = asConferenceId(createId("conf"));
  const eastNorthId = asDivisionId(createId("div"));
  const eastSouthId = asDivisionId(createId("div"));
  const westNorthId = asDivisionId(createId("div"));
  const westSouthId = asDivisionId(createId("div"));

  const userTeamId = asTeamId(createId("team"));
  const rivalTeamId = asTeamId(createId("team"));
  const westTeamAId = asTeamId(createId("team"));
  const westTeamBId = asTeamId(createId("team"));

  const seasonId = asSeasonId(createId("season"));

  const usedPaletteLogoKeys = new Set<string>();
  const teams = {
    [userTeamId]: bootstrapTeam(
      userTeamId,
      eastNorthId,
      eastId,
      "Harbor",
      "Titans",
      "HAR",
      usedPaletteLogoKeys,
    ),
    [rivalTeamId]: bootstrapTeam(
      rivalTeamId,
      eastNorthId,
      eastId,
      "Summit",
      "Wolves",
      "SUM",
      usedPaletteLogoKeys,
    ),
    [westTeamAId]: bootstrapTeam(
      westTeamAId,
      westNorthId,
      westId,
      "Canyon",
      "Coyotes",
      "CAN",
      usedPaletteLogoKeys,
    ),
    [westTeamBId]: bootstrapTeam(
      westTeamBId,
      westSouthId,
      westId,
      "Pacific",
      "Breakers",
      "PAC",
      usedPaletteLogoKeys,
    ),
  };

  const finances = Object.fromEntries(
    Object.keys(teams).map((teamId) => [
      teamId,
      {
        teamId: teamId as TeamId,
        businessFunds: DEFAULT_BUSINESS_FUNDS,
        payroll: 0,
        booksByYear: {},
        attendanceByYear: {},
        booksByMonth: {},
        businessFundsLedgerByMonth: {},
      },
    ]),
  );

  const standings = {
    byTeamId: Object.fromEntries(
      Object.keys(teams).map((teamId) => [
        teamId,
        createEmptyTeamStanding(teamId as TeamId),
      ]),
    ),
  };

  const teamIds = Object.keys(teams) as TeamId[];
  const startingSeasonYear = 2026;
  const phaseE = createPhaseEBusinessDefaults(teamIds, rngSeed, startingSeasonYear);

  const fourTeamSettings: GameSettings = input.settings ?? {
    league: {
      teamCount: 4,
      conferenceCount: 2,
      divisionsEnabled: false,
      area: "north_america",
    },
    injuryFrequency: "medium",
    ownership: { controlledTeamCount: 1 },
    regularSeason: {
      gamesPerTeam: 14,
      tradeDeadlineRule: {
        kind: "fraction_of_season_span",
        seasonSpanFraction: 0.55,
      },
    },
    playoffs: {
      playoffTeams: 4,
      seriesLength: 7,
      playInEnabled: false,
    },
    simulation: {
      frequency: "daily",
    },
    ai: {
      difficulty: "normal",
      managementPreset: DEFAULT_GAME_SETTINGS.ai.managementPreset,
      assistance: { ...DEFAULT_GAME_SETTINGS.ai.assistance },
    },
    financialRules: {
      salaryCapEnabled: true,
      salaryCap: DEFAULT_GAME_SETTINGS.financialRules.salaryCap,
      staffBudget: DEFAULT_GAME_SETTINGS.financialRules.staffBudget,
      luxuryTaxEnabled: true,
      revenueSharingEnabled: true,
    },
    draft: {
      mode: "standard",
      type: "snake",
      timerSeconds: null,
      orderMode: "random",
      userPickPosition: null,
      randomizeUserPick: false,
    },
    history: {
      mode: "new",
    },
    offseason: {
      freeAgency: { ...DEFAULT_GAME_SETTINGS.offseason.freeAgency },
    },
  };

  return {
    meta: {
      saveId,
      schemaVersion: GAME_STATE_SCHEMA_VERSION,
      createdAt: nowIso,
      updatedAt: nowIso,
      rngSeed,
      rngState: rngSeed,
    },
    settings: cloneGameSettings(fourTeamSettings),
    world: {
      calendar: {
        currentDate: "2026-10-01",
        lastSimulatedDate: null,
        lastSimulatedWeekId: null,
        lastSimulatedMonthId: null,
      },
      league: {
        id: leagueId,
        name: "Continental Basketball League",
        abbreviation: "CBL",
        conferenceIds: [eastId, westId],
      },
      conferences: {
        [eastId]: {
          id: eastId,
          leagueId,
          name: "Eastern Conference",
          divisionIds: [eastNorthId, eastSouthId],
        },
        [westId]: {
          id: westId,
          leagueId,
          name: "Western Conference",
          divisionIds: [westNorthId, westSouthId],
        },
      },
      divisions: {
        [eastNorthId]: {
          id: eastNorthId,
          conferenceId: eastId,
          name: "North",
          teamIds: [userTeamId, rivalTeamId],
        },
        [eastSouthId]: {
          id: eastSouthId,
          conferenceId: eastId,
          name: "South",
          teamIds: [],
        },
        [westNorthId]: {
          id: westNorthId,
          conferenceId: westId,
          name: "North",
          teamIds: [westTeamAId],
        },
        [westSouthId]: {
          id: westSouthId,
          conferenceId: westId,
          name: "South",
          teamIds: [westTeamBId],
        },
      },
      teams,
      players: {},
      coaches: {},
      staff: {},
      staffMarket: EMPTY_STAFF_MARKET,
      draftPicks: {},
      drafts: {},
      fantasyDraft: null,
      scheduledEvents: {},
    },
    competition: {
      season: {
        id: seasonId,
        year: startingSeasonYear,
        phase: "preseason",
        offseasonStage: "none",
        regularSeasonStartDate: null,
        tradeDeadlineDate: null,
        rfaQualificationComplete: false,
        offseasonStageEnteredDate: null,
        freeAgencyExtendedUntil: null,
      },
      phase: {
        activePhaseId: "preseason.preparation",
        enteredDate: `${startingSeasonYear}-10-01`,
      },
      schedule: {
        seasonId,
        gameIds: [],
        gameIdsByDate: {},
      },
      games: {},
      standings,
      playoffs: createEmptyPlayoffTournament(),
      seasonEventLog: [],
    },
    business: {
      contracts: {},
      finances,
      freeAgency: {
        offers: {},
      },
      rfaStatuses: {},
      tradeBlocks: {},
      ...phaseE,
    },
    user: {
      ownedTeamIds: [userTeamId],
      activeOwnerTeamId: userTeamId,
      ownedFranchises: {
        [userTeamId]: createDefaultOwnedFranchiseState({
          seasonYear: startingSeasonYear,
          currentDate: `${startingSeasonYear}-10-01`,
          citySelectionConfirmed: true,
          franchiseIdentityConfirmed: true,
          aiAssistance: { ...fourTeamSettings.ai.assistance },
          managementPreset: fourTeamSettings.ai.managementPreset,
        }),
      },
      mode: "owner",
      pendingOwnerDecisions: [],
      ownerDecisionHistory: [],
      franchisePhaseState: {
        [userTeamId]: { dismissed: [] },
      },
    },
  };
}
