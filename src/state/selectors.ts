import { isContractActive } from "@/domain/entities/contract";
import { draftClassIdFor } from "@/domain/entities/draft";
import type { Team } from "@/domain/entities/team";
import { createEmptyTeamStanding } from "@/domain/entities/standings";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { draftYearForSeason } from "@/systems/draft";
import { isUserOnDraftClock } from "@/systems/draft/draft-clock";
import { listFreeAgents } from "@/systems/free-agency";
import { getTeamCapSpace, getTeamPayroll } from "@/systems/salary-cap";

export type DashboardSnapshot = {
  saveId: string;
  schemaVersion: number;
  currentDate: string;
  seasonYear: number;
  seasonPhase: string;
  offseasonStage: string;
  leagueName: string;
  mode: string;
  teamSelectionLocked: boolean;
  userOnDraftClock: boolean;
  controlledTeam: {
    id: string;
    city: string;
    name: string;
    abbreviation: string;
  };
  teamCount: number;
  playerCount: number;
  payroll: number;
  capSpace: number;
  cash: number;
  controlledStanding: {
    wins: number;
    losses: number;
  };
  recentResults: Array<{
    date: string;
    opponentAbbreviation: string;
    home: boolean;
    teamScore: number;
    opponentScore: number;
    won: boolean;
  }>;
  notifications: Array<{
    id: string;
    type: string;
    severity: string;
    message: string;
  }>;
  playoffs: {
    status: string;
    fieldSize: number;
    userQualified: boolean;
    championTeamId: string | null;
  };
};

export type TeamListEntry = {
  id: string;
  city: string;
  name: string;
  abbreviation: string;
  conferenceName: string;
  divisionName: string;
};

export type RosterPlayerView = {
  playerId: string;
  firstName: string;
  lastName: string;
  position: string;
  age: number;
  overall: number;
  contractSalary: number | null;
  contractEndYear: number | null;
};

export type StandingRowView = {
  teamId: string;
  abbreviation: string;
  city: string;
  name: string;
  wins: number;
  losses: number;
  isUserTeam: boolean;
};

export type FreeAgentView = {
  playerId: string;
  firstName: string;
  lastName: string;
  position: string;
  age: number;
  overall: number;
};

export type DraftBoardView = {
  draftClassId: string;
  status: string;
  userOnClock: boolean;
  onClockPickId: string | null;
  onClockOverall: number | null;
  eligibleProspects: Array<{
    playerId: string;
    firstName: string;
    lastName: string;
    position: string;
    overall: number;
  }>;
};

export function getControlledTeam(state: GameState): Team {
  const team = state.world.teams[state.user.controlledTeamId];
  if (!team) {
    throw new Error(
      `Controlled team ${state.user.controlledTeamId} is missing from world.teams.`,
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
      conferenceName: conference?.name ?? "",
      divisionName: division?.name ?? "",
    });
  }
  entries.sort((a, b) => {
    const keyA = `${a.city} ${a.name}`;
    const keyB = `${b.city} ${b.name}`;
    return keyA < keyB ? -1 : keyA > keyB ? 1 : 0;
  });
  return entries;
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
        ? (contract.salaryByYear[String(year)] ?? null)
        : null;
    rows.push({
      playerId: player.id,
      firstName: player.firstName,
      lastName: player.lastName,
      position: player.position,
      age: player.age,
      overall: calculatePlayerOverall(player.position, player.attributes),
      contractSalary: salary,
      contractEndYear: contract?.endYear ?? null,
    });
  }
  rows.sort((a, b) => b.overall - a.overall);
  return rows;
}

export function toStandingsView(state: GameState): StandingRowView[] {
  const userTeamId = state.user.controlledTeamId;
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
      isUserTeam: team.id === userTeamId,
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
  return rows;
}

export function toFreeAgentViews(state: GameState): FreeAgentView[] {
  const { playerIds } = listFreeAgents(state);
  const views: FreeAgentView[] = [];
  for (const playerId of playerIds) {
    const player = state.world.players[playerId];
    if (!player) {
      continue;
    }
    views.push({
      playerId: player.id,
      firstName: player.firstName,
      lastName: player.lastName,
      position: player.position,
      age: player.age,
      overall: calculatePlayerOverall(player.position, player.attributes),
    });
  }
  views.sort((a, b) => b.overall - a.overall);
  return views;
}

export function toDraftBoardView(state: GameState): DraftBoardView | null {
  if (
    state.competition.season.phase !== "offseason" ||
    state.competition.season.offseasonStage !== "draft"
  ) {
    return null;
  }
  const draftYear = draftYearForSeason(state.competition.season.year);
  const draftClassId = draftClassIdFor(draftYear);
  const draft = state.world.drafts[draftClassId];
  if (draft === undefined) {
    return null;
  }
  const onClock = draft.order.find((slot) => slot.status === "available");
  const eligibleProspects = Object.values(draft.prospects)
    .filter((prospect) => prospect.status === "eligible")
    .map((prospect) => ({
      playerId: prospect.playerId,
      firstName: prospect.player.firstName,
      lastName: prospect.player.lastName,
      position: prospect.player.position,
      overall: calculatePlayerOverall(
        prospect.player.position,
        prospect.player.attributes,
      ),
    }))
    .sort((a, b) => b.overall - a.overall);

  return {
    draftClassId: draft.id,
    status: draft.status,
    userOnClock: isUserOnDraftClock(state),
    onClockPickId: onClock?.draftPickId ?? null,
    onClockOverall: onClock?.overallPick ?? null,
    eligibleProspects,
  };
}

export function toDashboardSnapshot(state: GameState): DashboardSnapshot {
  const team = getControlledTeam(state);
  const standing =
    state.competition.standings.byTeamId[team.id] ??
    createEmptyTeamStanding(team.id);
  const year = state.competition.season.year;
  const playoffs = state.competition.playoffs;
  const userQualified = playoffs.qualifiedTeams.some(
    (entry) => entry.teamId === team.id,
  );

  const recentResults = Object.values(state.competition.games)
    .filter(
      (game) =>
        game.status === "final" &&
        (game.homeTeamId === team.id || game.awayTeamId === team.id),
    )
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)
    .map((game) => {
      const home = game.homeTeamId === team.id;
      const teamScore = home ? game.score.home : game.score.away;
      const opponentScore = home ? game.score.away : game.score.home;
      const opponentId = home ? game.awayTeamId : game.homeTeamId;
      const opponent = state.world.teams[opponentId];
      return {
        date: game.date,
        opponentAbbreviation: opponent?.abbreviation ?? "???",
        home,
        teamScore,
        opponentScore,
        won: teamScore > opponentScore,
      };
    });

  return {
    saveId: state.meta.saveId,
    schemaVersion: state.meta.schemaVersion,
    currentDate: state.world.calendar.currentDate,
    seasonYear: year,
    seasonPhase: state.competition.season.phase,
    offseasonStage: state.competition.season.offseasonStage,
    leagueName: state.world.league.name,
    mode: state.user.mode,
    teamSelectionLocked: state.world.calendar.lastSimulatedDate !== null,
    userOnDraftClock: isUserOnDraftClock(state),
    controlledTeam: {
      id: team.id,
      city: team.city,
      name: team.name,
      abbreviation: team.abbreviation,
    },
    teamCount: Object.keys(state.world.teams).length,
    playerCount: Object.keys(state.world.players).length,
    payroll: getTeamPayroll(team.id, year, state),
    capSpace: getTeamCapSpace(team.id, year, state),
    cash: state.business.finances[team.id]?.cash ?? 0,
    controlledStanding: {
      wins: standing.wins,
      losses: standing.losses,
    },
    recentResults,
    notifications: state.user.notifications.slice(-10).map((notification) => ({
      id: notification.id,
      type: notification.type,
      severity: notification.severity,
      message: notification.message,
    })),
    playoffs: {
      status: playoffs.status,
      fieldSize: playoffs.fieldSize,
      userQualified,
      championTeamId: playoffs.championTeamId ?? null,
    },
  };
}

/** Convenience: whether a player still has an active contract this season. */
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

export type { TeamId };
