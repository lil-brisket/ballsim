import { createEmptyPlayoffTournament } from "@/domain/entities/playoffs";
import { createEmptyTeamStanding } from "@/domain/entities/standings";
import {
  createTeam,
  NEUTRAL_TEAM_PLAY_STYLE,
} from "@/domain/entities/team";
import { DEFAULT_COACHING_PHILOSOPHY } from "@/domain/coaching/coaching-philosophy";
import { DEFAULT_OWNER_PHILOSOPHY } from "@/domain/entities/owner-philosophy";
import { createSeededRng } from "@/domain/rng";
import {
  cloneGameSettings,
  CBL_GAME_SETTINGS,
  DEFAULT_GAME_SETTINGS,
  isSupportedTeamCount,
  type GameSettings,
} from "@/domain/game-settings";
import { validateGameSettings } from "@/domain/game-settings-validation";
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
  GAME_STATE_SCHEMA_VERSION,
  type GameState,
} from "@/state/game-state";
import { createPhaseEBusinessDefaults } from "@/state/phase-e-defaults";
import { generateLeague } from "@/systems/league-generation";
import { leagueGenerationConfigFromSettings } from "@/systems/league-shape";
import { generateLeagueStaff } from "@/systems/staff-generation";
import { defaultOwnerPatience } from "@/systems/owner-philosophy-config";

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
) {
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
  });
}

/**
 * Production Owner Mode new-game universe from GameSettings.
 * Defaults to Standard (30 teams). Pass CBL_GAME_SETTINGS for 12-team tests.
 * Application bootstrap fills players/contracts via generateRosters.
 * Placeholder controlledTeamId is the first sorted team id until selectOwnerTeam.
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
  const controlledTeamId = teamIds[0]!;

  const finances = Object.fromEntries(
    teamIds.map((teamId) => [
      teamId,
      {
        teamId,
        cash: 50_000_000,
        payroll: 0,
        booksByYear: {},
        booksByMonth: {},
        cashLedgerByMonth: {},
      },
    ]),
  );

  const standings = {
    byTeamId: Object.fromEntries(
      teamIds.map((teamId) => [teamId, createEmptyTeamStanding(teamId)]),
    ),
  };

  const seasonId = asSeasonId(`season_${saveId}_2026`);
  const phaseE = createPhaseEBusinessDefaults(teamIds, rngSeed);

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
      draftPicks: {},
      drafts: {},
      scheduledEvents: {},
    },
    competition: {
      season: {
        id: seasonId,
        year: 2026,
        phase: "preseason",
        offseasonStage: "none",
      },
      schedule: {
        seasonId,
        gameIds: [],
      },
      games: {},
      standings,
      playoffs: createEmptyPlayoffTournament(),
    },
    business: {
      contracts: {},
      finances,
      freeAgency: {
        offers: {},
      },
      tradeBlocks: {},
      ...phaseE,
    },
    user: {
      controlledTeamId,
      mode: "owner",
      ownerPhilosophy: DEFAULT_OWNER_PHILOSOPHY,
      ownerPatience: defaultOwnerPatience(DEFAULT_OWNER_PHILOSOPHY),
      objectives: [],
      notifications: [],
      eventLog: [],
      appliedGameplayConsequenceKeys: {},
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

  const teams = {
    [userTeamId]: bootstrapTeam(
      userTeamId,
      eastNorthId,
      eastId,
      "Harbor",
      "Titans",
      "HAR",
    ),
    [rivalTeamId]: bootstrapTeam(
      rivalTeamId,
      eastNorthId,
      eastId,
      "Summit",
      "Wolves",
      "SUM",
    ),
    [westTeamAId]: bootstrapTeam(
      westTeamAId,
      westNorthId,
      westId,
      "Canyon",
      "Coyotes",
      "CAN",
    ),
    [westTeamBId]: bootstrapTeam(
      westTeamBId,
      westSouthId,
      westId,
      "Pacific",
      "Breakers",
      "PAC",
    ),
  };

  const finances = Object.fromEntries(
    Object.keys(teams).map((teamId) => [
      teamId,
      {
        teamId: teamId as TeamId,
        cash: 50_000_000,
        payroll: 0,
        booksByYear: {},
        booksByMonth: {},
        cashLedgerByMonth: {},
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
  const phaseE = createPhaseEBusinessDefaults(teamIds, rngSeed);

  const fourTeamSettings: GameSettings = input.settings ?? {
    league: {
      teamCount: 4,
      conferenceCount: 2,
      divisionsEnabled: false,
    },
    regularSeason: {
      gamesPerTeam: 14,
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
    },
    financialRules: {
      salaryCapEnabled: true,
      luxuryTaxEnabled: true,
      revenueSharingEnabled: true,
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
      draftPicks: {},
      drafts: {},
      scheduledEvents: {},
    },
    competition: {
      season: {
        id: seasonId,
        year: 2026,
        phase: "preseason",
        offseasonStage: "none",
      },
      schedule: {
        seasonId,
        gameIds: [],
      },
      games: {},
      standings,
      playoffs: createEmptyPlayoffTournament(),
    },
    business: {
      contracts: {},
      finances,
      freeAgency: {
        offers: {},
      },
      tradeBlocks: {},
      ...phaseE,
    },
    user: {
      controlledTeamId: userTeamId,
      mode: "owner",
      ownerPhilosophy: DEFAULT_OWNER_PHILOSOPHY,
      ownerPatience: defaultOwnerPatience(DEFAULT_OWNER_PHILOSOPHY),
      objectives: [],
      notifications: [],
      eventLog: [],
      appliedGameplayConsequenceKeys: {},
    },
  };
}
