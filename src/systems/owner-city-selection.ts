/**
 * New-game city selection for Owner Mode.
 *
 * Invariants:
 * - Does not create or delete teams (teamCount unchanged).
 * - Always relocates the placeholder (current activeOwnerTeamId).
 * - If another team already sits in the chosen city, that team swaps into the
 *   placeholder's previous city so markets stay unique.
 * - Rejects after citySelectionConfirmed or after first time advance.
 */
import {
  isCityInArea,
  normalizeCityName,
} from "@/data/league/city-locations";
import type { LeagueArea } from "@/domain/game-settings";
import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import {
  getActiveOwnedFranchise,
  getActiveOwnerTeamId,
  withOwnedFranchise,
} from "@/state/owner-context";
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
 * Nickname customization happens on the subsequent team identity screen.
 */
export function applyOwnerCitySelection(
  state: GameState,
  cityInput: string,
): ApplyOwnerCitySelectionResult {
  if (getActiveOwnedFranchise(state).citySelectionConfirmed) {
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

  const occupant = findTeamByCity(state, canonicalCity);
  const placeholderId = state.user.activeOwnerTeamId;
  const placeholder = state.world.teams[placeholderId];
  if (!placeholder) {
    return {
      ok: false,
      error: `Placeholder team "${placeholderId}" is missing from world.teams.`,
    };
  }

  const nextTeams = { ...state.world.teams };
  const displacedId =
    occupant && occupant.teamId !== placeholderId ? occupant.teamId : null;
  if (displacedId) {
    const displaced = nextTeams[displacedId];
    if (!displaced) {
      return {
        ok: false,
        error: `Occupying team "${displacedId}" is missing from world.teams.`,
      };
    }
    nextTeams[displacedId] = {
      ...displaced,
      city: placeholder.city,
    };
  }

  const usedAbbreviations = new Set(
    Object.values(nextTeams)
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

  nextTeams[placeholderId] = {
    ...placeholder,
    city: canonicalCity,
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

  const withTeams: GameState = {
    ...state,
    world: {
      ...state.world,
      teams: nextTeams,
    },
  };

  return {
    ok: true,
    state: withOwnedFranchise(withTeams, placeholderId, (franchise) => ({
      ...franchise,
      citySelectionConfirmed: true,
    })),
  };
}
