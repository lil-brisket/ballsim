import { CONFERENCE_NAMES } from "@/data/league/conference-names";
import { DIVISION_NAMES } from "@/data/league/division-names";
import { TEAM_CITIES } from "@/data/league/team-cities";
import { TEAM_NICKNAMES } from "@/data/league/team-nicknames";
import {
  createConference,
  type Conference,
} from "@/domain/entities/conference";
import { createDivision, type Division } from "@/domain/entities/division";
import { createLeague, type League } from "@/domain/entities/league";
import { type Player } from "@/domain/entities/player";
import { createTeam, type Team } from "@/domain/entities/team";
import {
  asArenaId,
  asConferenceId,
  asDivisionId,
  asLeagueId,
  asPlayerId,
  asTeamId,
  type ConferenceId,
  type DivisionId,
  type LeagueId,
  type PlayerId,
  type TeamId,
} from "@/domain/ids";
import type { Rng } from "@/domain/rng";
import { generatePlayerWithRng } from "@/systems/player-generation";
import {
  DEFAULT_ROSTER_SIZE,
  rosterPositionForSlot,
} from "@/systems/roster-generation-config";

const DEFAULT_LEAGUE_ID = "league_fictional";

export type LeagueGenerationConfig = {
  leagueId?: string;
  leagueName: string;
  leagueAbbreviation?: string;
  conferenceCount: number;
  divisionsPerConference: number;
  teamsPerDivision: number;
  rosterSize?: number;
};

export type GeneratedLeague = {
  league: League;
  conferences: Conference[];
  divisions: Division[];
  teams: Team[];
  players: Player[];
};

type TeamNameData = {
  city: string;
  nickname: string;
  abbreviation: string;
};

type HierarchyIds = {
  leagueId: LeagueId;
  conferenceIds: ConferenceId[];
  /** Indexed [conferenceIndex][divisionIndex] */
  divisionIds: DivisionId[][];
  /** Indexed [conferenceIndex][divisionIndex][teamIndex] */
  teamIds: TeamId[][][];
};

/**
 * Deterministically generates a complete fictional league hierarchy.
 * Composes entity factories and {@link generatePlayerWithRng}; does not
 * create GameState, contracts, schedules, or Arena entities.
 */
export function generateLeague(
  config: LeagueGenerationConfig,
  rng: Rng,
): GeneratedLeague {
  const resolved = validateConfig(config);
  const ids = assignIds(resolved);

  const conferenceNames = takeUniqueNames(
    CONFERENCE_NAMES,
    resolved.conferenceCount,
    "conference",
    rng,
  );

  const divisionNamesByConference: string[][] = [];
  for (let conferenceIndex = 0; conferenceIndex < resolved.conferenceCount; conferenceIndex += 1) {
    divisionNamesByConference.push(
      takeUniqueNames(
        DIVISION_NAMES,
        resolved.divisionsPerConference,
        "division",
        rng,
      ),
    );
  }

  const totalTeams =
    resolved.conferenceCount *
    resolved.divisionsPerConference *
    resolved.teamsPerDivision;
  const teamNames = generateTeamNames(totalTeams, rng);

  const players: Player[] = [];
  const teams: Team[] = [];
  const divisions: Division[] = [];
  const conferences: Conference[] = [];

  let teamNameIndex = 0;

  for (
    let conferenceIndex = 0;
    conferenceIndex < resolved.conferenceCount;
    conferenceIndex += 1
  ) {
    const conferenceId = ids.conferenceIds[conferenceIndex]!;
    const conferenceDivisionIds: DivisionId[] = [];

    for (
      let divisionIndex = 0;
      divisionIndex < resolved.divisionsPerConference;
      divisionIndex += 1
    ) {
      const divisionId = ids.divisionIds[conferenceIndex]![divisionIndex]!;
      const divisionTeamIds: TeamId[] = [];

      for (
        let teamIndex = 0;
        teamIndex < resolved.teamsPerDivision;
        teamIndex += 1
      ) {
        const teamId = ids.teamIds[conferenceIndex]![divisionIndex]![teamIndex]!;
        const nameData = teamNames[teamNameIndex]!;
        teamNameIndex += 1;

        const rosterPlayerIds: PlayerId[] = [];
        for (let slot = 0; slot < resolved.rosterSize; slot += 1) {
          const playerId = asPlayerId(`player_${teamId}_${slot}`);
          const player = generatePlayerWithRng(rng, {
            id: playerId,
            teamId,
            position: rosterPositionForSlot(slot),
          });
          players.push(player);
          rosterPlayerIds.push(playerId);
        }

        teams.push(
          createTeam({
            id: teamId,
            name: nameData.nickname,
            city: nameData.city,
            abbreviation: nameData.abbreviation,
            conferenceId,
            divisionId,
            roster: rosterPlayerIds,
            staff: [],
            finances: {},
            arenaId: asArenaId(`arena_${teamId}`),
            reputation: 50,
          }),
        );
        divisionTeamIds.push(teamId);
      }

      divisions.push(
        createDivision({
          id: divisionId,
          conferenceId,
          name: divisionNamesByConference[conferenceIndex]![divisionIndex]!,
          teamIds: divisionTeamIds,
        }),
      );
      conferenceDivisionIds.push(divisionId);
    }

    conferences.push(
      createConference({
        id: conferenceId,
        leagueId: ids.leagueId,
        name: conferenceNames[conferenceIndex]!,
        divisionIds: conferenceDivisionIds,
      }),
    );
  }

  const league = createLeague({
    id: ids.leagueId,
    name: resolved.leagueName,
    abbreviation: resolved.leagueAbbreviation,
    conferenceIds: ids.conferenceIds,
  });

  const result: GeneratedLeague = {
    league,
    conferences,
    divisions,
    teams,
    players,
  };
  assertGenerationIntegrity(result);
  return result;
}

type ResolvedConfig = {
  leagueId: string;
  leagueName: string;
  leagueAbbreviation: string;
  conferenceCount: number;
  divisionsPerConference: number;
  teamsPerDivision: number;
  rosterSize: number;
};

function validateConfig(config: LeagueGenerationConfig): ResolvedConfig {
  assertNonEmptyName(config.leagueName, "leagueName");

  if (config.leagueId !== undefined) {
    if (typeof config.leagueId !== "string" || config.leagueId.length === 0) {
      throw new Error("League generation leagueId must be a non-empty string.");
    }
  }

  assertPositiveInteger(config.conferenceCount, "conferenceCount");
  assertPositiveInteger(config.divisionsPerConference, "divisionsPerConference");
  assertPositiveInteger(config.teamsPerDivision, "teamsPerDivision");

  const rosterSize =
    config.rosterSize === undefined ? DEFAULT_ROSTER_SIZE : config.rosterSize;
  if (config.rosterSize !== undefined) {
    assertPositiveInteger(config.rosterSize, "rosterSize");
  }

  const leagueAbbreviation =
    config.leagueAbbreviation === undefined
      ? deriveLeagueAbbreviation(config.leagueName)
      : config.leagueAbbreviation;

  return {
    leagueId: config.leagueId ?? DEFAULT_LEAGUE_ID,
    leagueName: config.leagueName,
    leagueAbbreviation,
    conferenceCount: config.conferenceCount,
    divisionsPerConference: config.divisionsPerConference,
    teamsPerDivision: config.teamsPerDivision,
    rosterSize,
  };
}

function assertPositiveInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(
      `League generation ${field} must be a positive integer.`,
    );
  }
}

function assertNonEmptyName(value: string, field: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`League generation ${field} must be a non-empty string.`);
  }
  if (value.trim().length === 0) {
    throw new Error(
      `League generation ${field} cannot be whitespace-only.`,
    );
  }
}

function assignIds(config: ResolvedConfig): HierarchyIds {
  const leagueId = asLeagueId(config.leagueId);
  const conferenceIds: ConferenceId[] = [];
  const divisionIds: DivisionId[][] = [];
  const teamIds: TeamId[][][] = [];

  for (
    let conferenceIndex = 0;
    conferenceIndex < config.conferenceCount;
    conferenceIndex += 1
  ) {
    const conferenceId = asConferenceId(
      `conference_${leagueId}_${conferenceIndex}`,
    );
    conferenceIds.push(conferenceId);

    const conferenceDivisionIds: DivisionId[] = [];
    const conferenceTeamIds: TeamId[][] = [];

    for (
      let divisionIndex = 0;
      divisionIndex < config.divisionsPerConference;
      divisionIndex += 1
    ) {
      const divisionId = asDivisionId(
        `division_${conferenceId}_${divisionIndex}`,
      );
      conferenceDivisionIds.push(divisionId);

      const divisionTeamIds: TeamId[] = [];
      for (
        let teamIndex = 0;
        teamIndex < config.teamsPerDivision;
        teamIndex += 1
      ) {
        divisionTeamIds.push(
          asTeamId(`team_${divisionId}_${teamIndex}`),
        );
      }
      conferenceTeamIds.push(divisionTeamIds);
    }

    divisionIds.push(conferenceDivisionIds);
    teamIds.push(conferenceTeamIds);
  }

  return { leagueId, conferenceIds, divisionIds, teamIds };
}

/**
 * Deterministic abbreviation from league name words (2–4 uppercase letters),
 * falling back to the first three letters of the name.
 */
export function deriveLeagueAbbreviation(leagueName: string): string {
  const words = leagueName
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);

  if (words.length >= 2) {
    const fromWords = words
      .slice(0, 4)
      .map((word) => word[0]!.toUpperCase())
      .join("");
    if (fromWords.length >= 2) {
      return fromWords;
    }
  }

  const letters = leagueName.replace(/[^A-Za-z]/g, "").toUpperCase();
  if (letters.length >= 3) {
    return letters.slice(0, 3);
  }
  if (letters.length >= 2) {
    return letters;
  }
  return "LGE";
}

function takeUniqueNames(
  pool: readonly string[],
  count: number,
  kind: string,
  rng: Rng,
): string[] {
  if (count > pool.length) {
    throw new Error(
      `League generation ${kind} name pool exhausted: need ${count}, have ${pool.length}.`,
    );
  }

  const remaining = [...pool];
  const selected: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const name = rng.pick(remaining);
    selected.push(name);
    const removeAt = remaining.indexOf(name);
    remaining.splice(removeAt, 1);
  }
  return selected;
}

function generateTeamNames(count: number, rng: Rng): TeamNameData[] {
  if (count > TEAM_CITIES.length) {
    throw new Error(
      `League generation city name pool exhausted: need ${count}, have ${TEAM_CITIES.length}.`,
    );
  }
  if (count > TEAM_NICKNAMES.length) {
    throw new Error(
      `League generation nickname name pool exhausted: need ${count}, have ${TEAM_NICKNAMES.length}.`,
    );
  }

  const cities = takeUniqueNames(TEAM_CITIES, count, "city", rng);
  const nicknames = takeUniqueNames(TEAM_NICKNAMES, count, "nickname", rng);

  const usedAbbreviations = new Set<string>();
  const result: TeamNameData[] = [];

  for (let index = 0; index < count; index += 1) {
    const city = cities[index]!;
    const nickname = nicknames[index]!;
    const abbreviation = uniqueTeamAbbreviation(city, usedAbbreviations);
    usedAbbreviations.add(abbreviation);
    result.push({ city, nickname, abbreviation });
  }

  return result;
}

/**
 * Derives a unique 3-letter abbreviation from city with deterministic
 * collision suffixes (no RNG).
 */
function uniqueTeamAbbreviation(
  city: string,
  used: ReadonlySet<string>,
): string {
  const letters = city.replace(/[^A-Za-z]/g, "").toUpperCase();
  const base =
    letters.length >= 3
      ? letters.slice(0, 3)
      : (letters + "XXX").slice(0, 3);

  if (!used.has(base)) {
    return base;
  }

  for (let suffix = 0; suffix < 10; suffix += 1) {
    const candidate = `${base.slice(0, 2)}${suffix}`;
    if (!used.has(candidate)) {
      return candidate;
    }
  }

  for (let code = 65; code <= 90; code += 1) {
    const candidate = `${base.slice(0, 2)}${String.fromCharCode(code)}`;
    if (!used.has(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `League generation could not derive a unique abbreviation for city "${city}".`,
  );
}

function assertGenerationIntegrity(result: GeneratedLeague): void {
  const conferenceById = new Map(
    result.conferences.map((conference) => [conference.id, conference]),
  );
  const divisionById = new Map(
    result.divisions.map((division) => [division.id, division]),
  );
  const teamById = new Map(result.teams.map((team) => [team.id, team]));
  const playerById = new Map(
    result.players.map((player) => [player.id, player]),
  );

  const allIds = [
    result.league.id,
    ...result.conferences.map((conference) => conference.id),
    ...result.divisions.map((division) => division.id),
    ...result.teams.map((team) => team.id),
    ...result.players.map((player) => player.id),
  ];
  const seenIds = new Set<string>();
  for (const id of allIds) {
    if (seenIds.has(id)) {
      throw new Error(`League generation produced duplicate id "${id}".`);
    }
    seenIds.add(id);
  }

  for (const conferenceId of result.league.conferenceIds) {
    if (!conferenceById.has(conferenceId)) {
      throw new Error(
        `League generation integrity: missing conference "${conferenceId}".`,
      );
    }
  }

  for (const conference of result.conferences) {
    for (const divisionId of conference.divisionIds) {
      if (!divisionById.has(divisionId)) {
        throw new Error(
          `League generation integrity: missing division "${divisionId}".`,
        );
      }
    }
  }

  for (const division of result.divisions) {
    for (const teamId of division.teamIds) {
      if (!teamById.has(teamId)) {
        throw new Error(
          `League generation integrity: missing team "${teamId}".`,
        );
      }
    }
  }

  const rosterOwner = new Map<string, string>();
  for (const team of result.teams) {
    for (const playerId of team.roster) {
      if (!playerById.has(playerId)) {
        throw new Error(
          `League generation integrity: missing player "${playerId}".`,
        );
      }
      const previousTeam = rosterOwner.get(playerId);
      if (previousTeam !== undefined) {
        throw new Error(
          `League generation integrity: player "${playerId}" appears on teams "${previousTeam}" and "${team.id}".`,
        );
      }
      rosterOwner.set(playerId, team.id);
    }
  }

  for (const player of result.players) {
    if (player.teamId === null || !teamById.has(player.teamId)) {
      throw new Error(
        `League generation integrity: player "${player.id}" has missing team "${player.teamId}".`,
      );
    }
  }
}
