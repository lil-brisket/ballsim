/**
 * New-game city selection for Owner Mode.
 *
 * Invariants:
 * - Does not create or delete teams (teamCount unchanged).
 * - Occupied city: only controlledTeamId changes; no team mutation.
 * - Available city: only the placeholder (current controlledTeamId) city/abbr mutate.
 * - Rejects after citySelectionConfirmed or after first time advance.
 */
import {
  isCityInArea,
  normalizeCityName,
} from "@/data/league/city-locations";
import type { LeagueArea } from "@/domain/game-settings";
import type { TeamId } from "@/domain/ids";
import { validateTeamNickname } from "@/domain/team-nickname";
import type { GameState } from "@/state/game-state";
import { uniqueTeamAbbreviation } from "@/systems/team-abbreviation";

export type ApplyOwnerCitySelectionResult =
  | { ok: true; state: GameState }
  | { ok: false; error: string };

function leagueAreaFromState(state: GameState): LeagueArea {
  return state.settings.league.area ?? "north_america";
}

function findTeamByCity(
  state: GameState,
  canonicalCity: string,
): { teamId: TeamId; city: string; abbreviation: string } | null {
  for (const [teamId, team] of Object.entries(state.world.teams)) {
    const teamCity = normalizeCityName(team.city);
    if (teamCity === canonicalCity) {
      return {
        teamId: teamId as TeamId,
        city: team.city,
        abbreviation: team.abbreviation,
      };
    }
  }
  return null;
}

/**
 * Pure state transition for owner city selection on the new-game pick screen.
 */
export function applyOwnerCitySelection(
  state: GameState,
  cityInput: string,
  options?: { nickname?: string },
): ApplyOwnerCitySelectionResult {
  if (state.user.citySelectionConfirmed) {
    return {
      ok: false,
      error: "City selection is already confirmed for this save.",
    };
  }

  if (state.world.calendar.lastSimulatedDate !== null) {
    return {
      ok: false,
      error:
        "Team selection is locked after the first time advance for this save.",
    };
  }

  const area = leagueAreaFromState(state);
  const canonicalCity = normalizeCityName(cityInput);
  if (canonicalCity === null) {
    return { ok: false, error: `Unknown city "${cityInput}".` };
  }

  if (!isCityInArea(canonicalCity, area)) {
    return {
      ok: false,
      error: `City "${canonicalCity}" is not in the ${area} league area pool.`,
    };
  }

  const occupied = findTeamByCity(state, canonicalCity);
  const placeholderId = state.user.controlledTeamId;
  const placeholder = state.world.teams[placeholderId];
  if (!placeholder) {
    return {
      ok: false,
      error: `Placeholder team "${placeholderId}" is missing from world.teams.`,
    };
  }

  if (occupied) {
    return {
      ok: true,
      state: {
        ...state,
        user: {
          ...state.user,
          controlledTeamId: occupied.teamId,
          citySelectionConfirmed: true,
        },
      },
    };
  }

  const usedAbbreviations = new Set(
    Object.values(state.world.teams)
      .filter((team) => team.id !== placeholderId)
      .map((team) => team.abbreviation),
  );
  let abbreviation: string;
  try {
    abbreviation = uniqueTeamAbbreviation(canonicalCity, usedAbbreviations);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  let nextName = placeholder.name;
  if (options?.nickname !== undefined) {
    const existingTeams = Object.values(state.world.teams).map((team) => ({
      id: team.id,
      city: team.city,
      name: team.name,
    }));
    const nick = validateTeamNickname(options.nickname, {
      city: canonicalCity,
      existingTeams,
      excludeTeamId: placeholderId,
    });
    if (!nick.ok) {
      return { ok: false, error: nick.error };
    }
    nextName = nick.value;
  }

  const nextTeams = { ...state.world.teams };
  nextTeams[placeholderId] = {
    ...placeholder,
    city: canonicalCity,
    name: nextName,
    abbreviation,
  };

  const cities = Object.values(nextTeams).map((team) =>
    normalizeCityName(team.city),
  );
  const uniqueCities = new Set(cities);
  if (uniqueCities.size !== cities.length) {
    return {
      ok: false,
      error: "Relocation would produce duplicate city assignments.",
    };
  }

  return {
    ok: true,
    state: {
      ...state,
      world: {
        ...state.world,
        teams: nextTeams,
      },
      user: {
        ...state.user,
        controlledTeamId: placeholderId,
        citySelectionConfirmed: true,
      },
    },
  };
}
