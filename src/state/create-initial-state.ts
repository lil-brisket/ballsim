import { createTeam } from "@/domain/entities/team";
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
  });
}

/**
 * Creates a minimal fictional universe for a new Owner Mode save.
 * Application bootstrap fills rosters and schedule via systems.
 */
export function createInitialGameState(
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
      },
    ]),
  );

  const standings = {
    byTeamId: Object.fromEntries(
      Object.keys(teams).map((teamId) => [
        teamId,
        { teamId: teamId as TeamId, wins: 0, losses: 0 },
      ]),
    ),
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
    world: {
      calendar: {
        currentDate: "2026-10-01",
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
    },
    competition: {
      season: {
        id: seasonId,
        year: 2026,
        phase: "preseason",
      },
      schedule: {
        seasonId,
        gameIds: [],
      },
      games: {},
      standings,
    },
    business: {
      contracts: {},
      finances,
    },
    user: {
      controlledTeamId: userTeamId,
      mode: "owner",
    },
  };
}

