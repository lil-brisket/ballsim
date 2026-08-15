import { createEmptyPlayoffTournament } from "@/domain/entities/playoffs";
import { createEmptyTeamStanding } from "@/domain/entities/standings";
import {
  createTeam,
  NEUTRAL_TEAM_PLAY_STYLE,
} from "@/domain/entities/team";
import { DEFAULT_COACHING_PHILOSOPHY } from "@/domain/coaching/coaching-philosophy";
import { createSeededRng } from "@/domain/rng";
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
import { generateLeagueStaff } from "@/systems/staff-generation";

export type CreateInitialGameStateInput = {
  saveId: string;
  rngSeed?: number;
  nowIso?: string;
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
 * Production Owner Mode new-game universe: 12 teams (2×2×3), empty rosters.
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

  const generated = generateLeague(
    {
      leagueId: `league_${saveId}`,
      leagueName: "Continental Basketball League",
      leagueAbbreviation: "CBL",
      conferenceCount: 2,
      divisionsPerConference: 2,
      teamsPerDivision: 3,
      rosterSize: 0,
    },
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
      },
    ]),
  );

  const standings = {
    byTeamId: Object.fromEntries(
      teamIds.map((teamId) => [teamId, createEmptyTeamStanding(teamId)]),
    ),
  };

  const seasonId = asSeasonId(`season_${saveId}_2026`);
  const phaseE = createPhaseEBusinessDefaults(teamIds);

  let state: GameState = {
    meta: {
      saveId,
      schemaVersion: GAME_STATE_SCHEMA_VERSION,
      createdAt: nowIso,
      updatedAt: nowIso,
      rngSeed,
      rngState: rng.getState(),
    },
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

/**
 * Four-team fixture for tests that assert the no-playoff path
 * (getPlayoffTeamCount(4) === 0 → regular → postseason).
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
  const phaseE = createPhaseEBusinessDefaults(teamIds);

  return {
    meta: {
      saveId,
      schemaVersion: GAME_STATE_SCHEMA_VERSION,
      createdAt: nowIso,
      updatedAt: nowIso,
      rngSeed,
      rngState: rngSeed,
    },
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
      objectives: [],
      notifications: [],
      eventLog: [],
      appliedGameplayConsequenceKeys: {},
    },
  };
}
