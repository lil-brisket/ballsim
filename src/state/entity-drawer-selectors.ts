import {
  getContractSalaryForYear,
  getContractStatus,
} from "@/domain/entities/contract";
import {
  getStaffContractSalaryForYear,
  isStaffContractActive,
} from "@/domain/entities/staff-contract";
import { STAFF_ROLE_DISPLAY } from "@/domain/entities/staff-roles";
import type { StaffRole } from "@/domain/entities/staff";
import type { PlayerId, TeamId } from "@/domain/ids";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { GameState } from "@/state/game-state";
import { isOwnedFranchise } from "@/state/owner-context";
import { resolveTeamHref } from "@/state/resolve-team-href";
import { getControlledTeam } from "@/state/selectors";
import {
  toBrandingView,
  type TeamBrandingView,
} from "@/state/team-branding-view";
import { getTeamCapSpace, getTeamPayroll } from "@/systems/salary-cap";
import {
  bottomAttributeLabels,
  topAttributeLabels,
} from "@/systems/staff-ratings";

export type PlayerDrawerView = {
  playerId: string;
  identity: {
    firstName: string;
    lastName: string;
    position: string;
    age: number;
    overall: number;
  };
  team: {
    teamId: string | null;
    teamName: string | null;
    abbreviation: string | null;
    branding: TeamBrandingView | null;
  };
  availability: {
    status: string;
  };
  ratings: {
    keyAttributes: Array<{ attribute: string; rating: number }>;
  };
  /** Controlled-roster only. */
  contract: {
    salary: number | null;
    yearsRemaining: number;
    status: string;
  } | null;
  performance: {
    games: number;
    ppg: number | null;
    rpg: number | null;
    apg: number | null;
  };
  navigation: {
    playerHref: string;
    teamHref: string | null;
    contractHref: string | null;
    developmentHref: string | null;
  };
};

export type TeamDrawerRecentGame = {
  gameId: string;
  date: string;
  opponentAbbreviation: string;
  home: boolean;
  teamScore: number;
  opponentScore: number;
  won: boolean;
};

export type TeamDrawerTopPlayer = {
  playerId: string;
  firstName: string;
  lastName: string;
  position: string;
  overall: number;
  injuryStatus: string;
};

export type TeamDrawerView = {
  teamId: string;
  identity: {
    city: string;
    name: string;
    abbreviation: string;
    branding: TeamBrandingView | null;
    conference: string | null;
    division: string | null;
  };
  performance: {
    wins: number;
    losses: number;
    rank: number;
    streak: { type: "W" | "L" | null; count: number };
  };
  roster: {
    topPlayers: TeamDrawerTopPlayer[];
    injuryHighlights: TeamDrawerTopPlayer[];
  };
  /** Owned / controlled franchise only. */
  context: {
    payroll: number;
    capSpace: number;
    ownerStatus: "active" | "owned" | null;
  } | null;
  recentGames: TeamDrawerRecentGame[];
  navigation: {
    teamHref: string;
    rosterHref: string | null;
    scheduleHref: string;
  };
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function topAttributeEntries(
  attributes: Record<string, number>,
  limit = 5,
): Array<{ attribute: string; rating: number }> {
  return Object.entries(attributes)
    .sort((a, b) => b[1]! - a[1]!)
    .slice(0, limit)
    .map(([attribute, rating]) => ({ attribute, rating }));
}

function formatAttributeLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

/**
 * Build a player drawer view. Public fields always; contract/dev hrefs only
 * when on the controlled roster.
 */
export function toPlayerDrawerView(
  state: GameState,
  playerId: PlayerId,
  saveId: string,
): PlayerDrawerView | null {
  const player = state.world.players[playerId];
  if (!player) return null;

  const controlled = getControlledTeam(state);
  const onControlledRoster = controlled.roster.includes(playerId);
  const team = player.teamId ? state.world.teams[player.teamId] : undefined;
  const year = state.competition.season.year;
  const overall = calculatePlayerOverall(player.position, player.attributes);

  let games = 0;
  let points = 0;
  let rebounds = 0;
  let assists = 0;
  for (const game of Object.values(state.competition.games)) {
    if (game.status !== "final") continue;
    const row = game.playerStats.find((s) => s.playerId === playerId);
    if (!row) continue;
    games += 1;
    points += row.points;
    rebounds += row.rebounds;
    assists += row.assists;
  }

  let contract: PlayerDrawerView["contract"] = null;
  if (onControlledRoster && player.contractId) {
    const c = state.business.contracts[player.contractId];
    if (c) {
      contract = {
        salary: getContractSalaryForYear(c, year) ?? null,
        yearsRemaining: Math.max(0, c.endYear - year + 1),
        status: getContractStatus(c, year),
      };
    }
  }

  const teamHref = player.teamId
    ? resolveTeamHref(state, player.teamId, saveId)
    : null;

  return {
    playerId: String(playerId),
    identity: {
      firstName: player.firstName,
      lastName: player.lastName,
      position: player.position,
      age: player.age,
      overall,
    },
    team: {
      teamId: player.teamId ? String(player.teamId) : null,
      teamName: team ? `${team.city} ${team.name}` : null,
      abbreviation: team?.abbreviation ?? null,
      branding: toBrandingView(team?.branding),
    },
    availability: {
      status: player.availability,
    },
    ratings: {
      keyAttributes: topAttributeEntries(
        player.attributes as unknown as Record<string, number>,
      ).map((a) => ({
        attribute: formatAttributeLabel(a.attribute),
        rating: a.rating,
      })),
    },
    contract,
    performance: {
      games,
      ppg: games > 0 ? round1(points / games) : null,
      rpg: games > 0 ? round1(rebounds / games) : null,
      apg: games > 0 ? round1(assists / games) : null,
    },
    navigation: {
      playerHref: `/dashboard/${saveId}/players/${playerId}`,
      teamHref,
      contractHref: onControlledRoster
        ? `/dashboard/${saveId}/contracts`
        : null,
      developmentHref: onControlledRoster
        ? `/dashboard/${saveId}/development`
        : null,
    },
  };
}

function leagueRankForTeam(state: GameState, teamId: TeamId): number {
  const rows = Object.values(state.competition.standings.byTeamId).map((s) => ({
    teamId: s.teamId,
    wins: s.wins,
    losses: s.losses,
    winPercentage: s.winPercentage,
  }));
  rows.sort((a, b) => {
    if (b.winPercentage !== a.winPercentage) {
      return b.winPercentage - a.winPercentage;
    }
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.losses - b.losses;
  });
  const idx = rows.findIndex((r) => r.teamId === teamId);
  if (idx >= 0) return idx + 1;
  // Team missing from standings (preseason) — treat as unranked but valid.
  return Math.max(1, rows.length);
}

function recentGamesForTeam(
  state: GameState,
  teamId: TeamId,
  limit: number,
): TeamDrawerRecentGame[] {
  const finals = Object.values(state.competition.games)
    .filter(
      (g) =>
        g.status === "final" &&
        (g.homeTeamId === teamId || g.awayTeamId === teamId),
    )
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);

  return finals.map((game) => {
    const home = game.homeTeamId === teamId;
    const teamScore = home ? game.score.home : game.score.away;
    const opponentScore = home ? game.score.away : game.score.home;
    const opponentId = home ? game.awayTeamId : game.homeTeamId;
    const opponent = state.world.teams[opponentId];
    return {
      gameId: String(game.id),
      date: game.date,
      opponentAbbreviation: opponent?.abbreviation ?? "???",
      home,
      teamScore,
      opponentScore,
      won: teamScore > opponentScore,
    };
  });
}

/**
 * Build a team drawer view. Context (payroll/cap) only for owned franchises.
 */
export function toTeamDrawerView(
  state: GameState,
  teamId: TeamId,
  saveId: string,
): TeamDrawerView | null {
  const team = state.world.teams[teamId];
  if (!team) return null;

  const standing = state.competition.standings.byTeamId[teamId];
  const conference = state.world.conferences[team.conferenceId];
  const division = state.world.divisions[team.divisionId];
  const year = state.competition.season.year;
  const owned = isOwnedFranchise(state, teamId);
  const isActive = state.user.activeOwnerTeamId === teamId;

  const rosterPlayers: TeamDrawerTopPlayer[] = [];
  for (const pid of team.roster) {
    const p = state.world.players[pid];
    if (!p) continue;
    rosterPlayers.push({
      playerId: String(pid),
      firstName: p.firstName,
      lastName: p.lastName,
      position: p.position,
      overall: calculatePlayerOverall(p.position, p.attributes),
      injuryStatus: p.availability,
    });
  }
  rosterPlayers.sort((a, b) => b.overall - a.overall);

  const topPlayers = rosterPlayers.slice(0, 5);
  const injuryHighlights = rosterPlayers
    .filter((p) => p.injuryStatus !== "available")
    .slice(0, 3);

  let context: TeamDrawerView["context"] = null;
  if (owned) {
    context = {
      payroll: getTeamPayroll(teamId, year, state),
      capSpace: getTeamCapSpace(teamId, year, state),
      ownerStatus: isActive ? "active" : "owned",
    };
  }

  return {
    teamId: String(teamId),
    identity: {
      city: team.city,
      name: team.name,
      abbreviation: team.abbreviation,
      branding: toBrandingView(team.branding),
      conference: conference?.name ?? null,
      division: division?.name ?? null,
    },
    performance: {
      wins: standing?.wins ?? 0,
      losses: standing?.losses ?? 0,
      rank: leagueRankForTeam(state, teamId),
      streak: standing?.streak ?? { type: null, count: 0 },
    },
    roster: { topPlayers, injuryHighlights },
    context,
    recentGames: recentGamesForTeam(state, teamId, 3),
    navigation: {
      teamHref: resolveTeamHref(state, teamId, saveId),
      rosterHref: isActive ? `/dashboard/${saveId}/roster` : null,
      scheduleHref: `/dashboard/${saveId}/schedule`,
    },
  };
}

export type StaffDrawerView = {
  staffId: string;
  identity: {
    firstName: string;
    lastName: string;
    role: string;
    roleLabel: string;
    age: number;
    overall: number;
    potential: number;
  };
  development: {
    trend: string;
    morale: number;
  };
  contract: {
    salary: number | null;
    yearsRemaining: number | null;
    endYear: number | null;
  };
  strengths: string[];
  weaknesses: string[];
  navigation: {
    staffHref: string;
    staffHubHref: string;
  };
};

export function toStaffDrawerView(
  state: GameState,
  staffId: string,
  saveId: string,
): StaffDrawerView | null {
  const staff = state.world.staff[staffId];
  if (!staff) return null;

  const year = state.competition.season.year;
  const role = staff.role as StaffRole;
  const contract = Object.values(state.business.staffContracts).find(
    (c) =>
      c.staffId === staff.id &&
      (staff.teamId === null || c.teamId === staff.teamId) &&
      isStaffContractActive(c, year),
  );

  return {
    staffId: staff.id,
    identity: {
      firstName: staff.firstName,
      lastName: staff.lastName,
      role: staff.role,
      roleLabel: STAFF_ROLE_DISPLAY[role] ?? staff.role,
      age: staff.age,
      overall: staff.overall,
      potential: staff.potential,
    },
    development: {
      trend: staff.development.trend,
      morale: staff.morale,
    },
    contract: {
      salary: contract
        ? (getStaffContractSalaryForYear(contract, year) ?? null)
        : null,
      yearsRemaining: contract
        ? Math.max(0, contract.endYear - year + 1)
        : null,
      endYear: contract?.endYear ?? null,
    },
    strengths: topAttributeLabels(role, staff.attributes),
    weaknesses: bottomAttributeLabels(role, staff.attributes),
    navigation: {
      staffHref: `/dashboard/${saveId}/staff/${staff.id}`,
      staffHubHref: `/dashboard/${saveId}/staff-coaching/staff`,
    },
  };
}

