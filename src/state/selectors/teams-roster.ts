import {
  type TeamBrandingView,
  toBrandingView,
} from "@/state/team-branding-view";
import type { PlayerPortraitAssignment } from "@/domain/entities/player-portrait";
import type { GameState } from "@/state/game-state";
import type { Team } from "@/domain/entities/team";
import {
  normalizeCityName,
  getCitiesForArea,
  formatCityLocation,
} from "@/data/league/city-locations";
import { getActiveOwnedFranchise } from "@/state/owner-context";
import {
  getContractSalaryForYear,
  getContractStatus,
  isContractActive,
} from "@/domain/entities/contract";
import { selectPlayerPortrait } from "@/state/player-portrait-selectors";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import { createEmptyTeamStanding } from "@/domain/entities/standings";
import type { PlayerId } from "@/domain/ids";
import { listFreeAgents } from "@/systems/free-agency";
import { draftYearForSeason } from "@/systems/draft";
import { draftClassIdFor } from "@/domain/entities/draft";

export type TeamListEntry = {
  id: string;
  city: string;
  name: string;
  abbreviation: string;
  conferenceId: string;
  divisionId: string;
  conferenceName: string;
  divisionName: string;
  branding: TeamBrandingView | null;
};

export type CityPickOption = {
  city: string;
  lat: number;
  lng: number;
  country: string;
  subdivision?: string;
  locationLabel: string;
  occupied: boolean;
  teamId?: string;
  nickname?: string;
};

export type RosterPlayerView = {
  playerId: string;
  /** Persisted portrait (world.playerPortraits); null → initials fallback. */
  portrait: PlayerPortraitAssignment | null;
  firstName: string;
  lastName: string;
  position: string;
  age: number;
  overall: number;
  contractSalary: number | null;
  contractEndYear: number | null;
  contractYearsRemaining: number | null;
  injuryKind: string;
  developmentStage: string;
};

export type StandingRowView = {
  teamId: string;
  abbreviation: string;
  city: string;
  name: string;
  wins: number;
  losses: number;
  isUserTeam: boolean;
  rank: number;
  branding: TeamBrandingView | null;
};

export type PlayerDetailView = {
  playerId: string;
  /** Persisted portrait (world.playerPortraits); null → initials fallback. */
  portrait: PlayerPortraitAssignment | null;
  firstName: string;
  lastName: string;
  position: string;
  age: number;
  heightInches: number;
  weightPounds: number;
  nationality: string;
  archetype: string;
  overall: number;
  potentialOverall: number;
  teamId: string | null;
  teamName: string | null;
  teamBranding: TeamBrandingView | null;
  onControlledRoster: boolean;
  injuryKind: string;
  developmentStage: string;
  attributes: Record<string, number>;
  contract: {
    contractId: string;
    salary: number | null;
    startYear: number;
    endYear: number;
    yearsRemaining: number;
    status: string;
  } | null;
  seasonStats: {
    games: number;
    points: number;
    rebounds: number;
    assists: number;
    steals: number;
    blocks: number;
    turnovers: number;
    minutes: number;
  };
};

export function getControlledTeam(state: GameState): Team {
  const team = state.world.teams[state.user.activeOwnerTeamId];
  if (!team) {
    throw new Error(
      `Controlled team ${state.user.activeOwnerTeamId} is missing from world.teams.`,
    );
  }
  return team;
}

export function listTeamsForSelection(state: GameState): TeamListEntry[] {
  const entries: TeamListEntry[] = [];
  for (const team of Object.values(state.world.teams)) {
    const conference = state.world.conferences[team.conferenceId];
    const division = state.world.divisions[team.divisionId];
    entries.push({
      id: team.id,
      city: team.city,
      name: team.name,
      abbreviation: team.abbreviation,
      conferenceId: team.conferenceId,
      divisionId: team.divisionId,
      conferenceName: conference?.name ?? "",
      divisionName: division?.name ?? "",
      branding: toBrandingView(team.branding),
    });
  }
  entries.sort((a, b) => {
    const keyA = `${a.city} ${a.name}`;
    const keyB = `${b.city} ${b.name}`;
    return keyA < keyB ? -1 : keyA > keyB ? 1 : 0;
  });
  return entries;
}

/**
 * Full regional city pool for new-game map/list pick.
 * Markets stay unoccupied until citySelectionConfirmed.
 */
export function listCitiesForTeamPick(state: GameState): CityPickOption[] {
  const area = state.settings.league.area ?? "north_america";
  const byNormalizedCity = new Map<
    string,
    { teamId: string; nickname: string }
  >();
  for (const team of Object.values(state.world.teams)) {
    const key = normalizeCityName(team.city);
    if (key !== null) {
      byNormalizedCity.set(key, { teamId: team.id, nickname: team.name });
    }
  }

  const marketsOpen = !getActiveOwnedFranchise(state).citySelectionConfirmed;
  const options: CityPickOption[] = getCitiesForArea(area).map((city) => {
    const occupant = byNormalizedCity.get(city.name);
    const location = {
      country: city.country,
      subdivision: city.subdivision,
      locationLabel: formatCityLocation(city),
    };
    if (!marketsOpen && occupant) {
      return {
        city: city.name,
        lat: city.lat,
        lng: city.lng,
        ...location,
        occupied: true,
        teamId: occupant.teamId,
        nickname: occupant.nickname,
      };
    }
    return {
      city: city.name,
      lat: city.lat,
      lng: city.lng,
      ...location,
      occupied: false,
    };
  });

  options.sort((a, b) => (a.city < b.city ? -1 : a.city > b.city ? 1 : 0));
  return options;
}

export function toRosterView(state: GameState): RosterPlayerView[] {
  const team = getControlledTeam(state);
  const year = state.competition.season.year;
  const rows: RosterPlayerView[] = [];
  for (const playerId of team.roster) {
    const player = state.world.players[playerId];
    if (!player) {
      continue;
    }
    const contract = player.contractId
      ? state.business.contracts[player.contractId]
      : undefined;
    const salary =
      contract !== undefined
        ? (getContractSalaryForYear(contract, year) ?? null)
        : null;
    const yearsRemaining =
      contract !== undefined ? Math.max(0, contract.endYear - year + 1) : null;
    rows.push({
      playerId: player.id,
      portrait: selectPlayerPortrait(state, player.id),
      firstName: player.firstName,
      lastName: player.lastName,
      position: player.position,
      age: player.age,
      overall: calculatePlayerOverall(player.position, player.attributes),
      contractSalary: salary,
      contractEndYear: contract?.endYear ?? null,
      contractYearsRemaining: yearsRemaining,
      injuryKind: player.availability,
      developmentStage: player.development.stage,
    });
  }
  rows.sort((a, b) => b.overall - a.overall);
  return rows;
}

export function toStandingsView(state: GameState): StandingRowView[] {
  const owned = new Set(state.user.ownedTeamIds);
  const rows: StandingRowView[] = [];
  for (const team of Object.values(state.world.teams)) {
    const standing =
      state.competition.standings.byTeamId[team.id] ??
      createEmptyTeamStanding(team.id);
    rows.push({
      teamId: team.id,
      abbreviation: team.abbreviation,
      city: team.city,
      name: team.name,
      wins: standing.wins,
      losses: standing.losses,
      isUserTeam: owned.has(team.id),
      rank: 0,
      branding: toBrandingView(team.branding),
    });
  }
  rows.sort((a, b) => {
    if (b.wins !== a.wins) {
      return b.wins - a.wins;
    }
    if (a.losses !== b.losses) {
      return a.losses - b.losses;
    }
    return a.abbreviation.localeCompare(b.abbreviation);
  });
  return rows.map((row, index) => ({ ...row, rank: index + 1 }));
}

export function isPlayerInOwnerScope(
  state: GameState,
  playerId: PlayerId,
): boolean {
  const team = getControlledTeam(state);
  if (team.roster.includes(playerId)) {
    return true;
  }
  if (listFreeAgents(state).playerIds.includes(playerId)) {
    return true;
  }
  const draftYear = draftYearForSeason(state.competition.season.year);
  const draftClass = state.world.drafts[draftClassIdFor(draftYear)];
  if (draftClass?.prospects[playerId]) {
    return true;
  }
  if (draftClass?.selections.some((s) => s.playerId === playerId)) {
    return true;
  }
  return false;
}

export function toPlayerDetailView(
  state: GameState,
  playerId: PlayerId,
): PlayerDetailView | null {
  const player = state.world.players[playerId];
  if (player) {
    return playerEntityToDetail(
      state,
      player,
      getControlledTeam(state).roster.includes(playerId),
    );
  }
  const draftYear = draftYearForSeason(state.competition.season.year);
  const draftClass = state.world.drafts[draftClassIdFor(draftYear)];
  const draftProspect = draftClass?.prospects[playerId];
  if (draftProspect) {
    return playerEntityToDetail(state, draftProspect.player, false);
  }
  return null;
}

function playerEntityToDetail(
  state: GameState,
  player: GameState["world"]["players"][string],
  onControlledRoster: boolean,
): PlayerDetailView {
  const year = state.competition.season.year;
  const team = player.teamId ? state.world.teams[player.teamId] : undefined;
  const contract = player.contractId
    ? state.business.contracts[player.contractId]
    : undefined;

  const seasonStats = {
    games: 0,
    points: 0,
    rebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    minutes: 0,
  };
  for (const game of Object.values(state.competition.games)) {
    if (game.status !== "final") {
      continue;
    }
    const row = game.playerStats.find((stat) => stat.playerId === player.id);
    if (!row) {
      continue;
    }
    seasonStats.games += 1;
    seasonStats.points += row.points;
    seasonStats.rebounds += row.rebounds;
    seasonStats.assists += row.assists;
    seasonStats.steals += row.steals;
    seasonStats.blocks += row.blocks;
    seasonStats.turnovers += row.turnovers;
    seasonStats.minutes += row.minutes;
  }

  return {
    playerId: player.id,
    portrait: selectPlayerPortrait(state, player.id),
    firstName: player.firstName,
    lastName: player.lastName,
    position: player.position,
    age: player.age,
    heightInches: player.heightInches,
    weightPounds: player.weightPounds,
    nationality: player.nationality,
    archetype: player.archetype,
    overall: calculatePlayerOverall(player.position, player.attributes),
    potentialOverall: player.potential.overall,
    teamId: player.teamId,
    teamName: team ? `${team.city} ${team.name}` : null,
    teamBranding: toBrandingView(team?.branding),
    onControlledRoster,
    injuryKind: player.availability,
    developmentStage: player.development.stage,
    attributes: { ...player.attributes },
    contract: contract
      ? {
          contractId: contract.id,
          salary: getContractSalaryForYear(contract, year) ?? null,
          startYear: contract.startYear,
          endYear: contract.endYear,
          yearsRemaining: Math.max(0, contract.endYear - year + 1),
          status: getContractStatus(contract, year),
        }
      : null,
    seasonStats,
  };
}

export function playerHasActiveContract(
  state: GameState,
  playerId: PlayerId,
): boolean {
  const player = state.world.players[playerId];
  if (!player?.contractId) {
    return false;
  }
  const contract = state.business.contracts[player.contractId];
  if (!contract) {
    return false;
  }
  return isContractActive(contract, state.competition.season.year);
}
