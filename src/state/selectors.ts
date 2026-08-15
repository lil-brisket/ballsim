import {
  getContractSalaryForYear,
  getContractStatus,
  isContractActive,
} from "@/domain/entities/contract";
import { draftClassIdFor } from "@/domain/entities/draft";
import { isOpenOffer } from "@/domain/entities/free-agency-offer";
import type { TeamFinancialStatement } from "@/domain/entities/finances";
import type { Team } from "@/domain/entities/team";
import { createEmptyTeamStanding } from "@/domain/entities/standings";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { DomainEvent } from "@/domain/events";
import type { PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { draftYearForSeason } from "@/systems/draft";
import { isUserOnDraftClock } from "@/systems/draft/draft-clock";
import { listFreeAgents } from "@/systems/free-agency";
import { getTeamCapSpace, getTeamPayroll } from "@/systems/salary-cap";
import { getFinancialStatement } from "@/systems/team-finances";

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
  revenueTotal: number;
  expensesTotal: number;
  netIncome: number;
  standingsRank: number;
  controlledStanding: { wins: number; losses: number };
  recentResults: Array<{
    date: string;
    opponentAbbreviation: string;
    home: boolean;
    teamScore: number;
    opponentScore: number;
    won: boolean;
  }>;
  upcomingGames: ScheduleGameView[];
  objectives: ObjectiveView[];
  recentActivity: EventLogEntryView[];
  notifications: Array<{
    id: string;
    type: string;
    severity: string;
    message: string;
    read: boolean;
  }>;
  unreadNotificationCount: number;
  playoffs: {
    status: string;
    fieldSize: number;
    userQualified: boolean;
    championTeamId: string | null;
  };
  /** Preferred Owner Mode advance cadence from GameSettings. */
  simulationFrequency: "daily" | "weekly";
};

export type ObjectiveView = {
  id: string;
  type: string;
  description: string;
  status: string;
  seasonYear: number;
  target: number | null;
  progress: number | null;
  consequenceApplied: boolean;
};

export type EventLogEntryView = {
  id: string;
  type: string;
  occurredOn: string;
  description: string;
  amount: number | null;
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
};

export type FreeAgentView = {
  playerId: string;
  firstName: string;
  lastName: string;
  position: string;
  age: number;
  overall: number;
};

export type FreeAgencyOfferView = {
  offerId: string;
  playerId: string;
  playerName: string;
  status: string;
  salary: number | null;
  years: number;
  createdOn: string;
};

export type DraftBoardView = {
  draftClassId: string;
  status: string;
  userOnClock: boolean;
  onClockPickId: string | null;
  onClockOverall: number | null;
  order: Array<{
    draftPickId: string;
    overallPick: number;
    round: number;
    ownerTeamId: string;
    ownerAbbreviation: string;
    status: string;
    selectedPlayerId: string | null;
    isUserPick: boolean;
  }>;
  ownedPicks: Array<{
    draftPickId: string;
    overallPick: number;
    round: number;
    status: string;
  }>;
  selections: Array<{
    overallPick: number;
    teamAbbreviation: string;
    playerName: string;
    playerId: string;
  }>;
  eligibleProspects: Array<{
    playerId: string;
    firstName: string;
    lastName: string;
    position: string;
    overall: number;
  }>;
};

export type ScheduleGameView = {
  gameId: string;
  date: string;
  opponentAbbreviation: string;
  opponentName: string;
  home: boolean;
  status: string;
  teamScore: number | null;
  opponentScore: number | null;
  won: boolean | null;
};

export type ContractRowView = {
  contractId: string;
  playerId: string;
  playerName: string;
  position: string;
  salary: number | null;
  startYear: number;
  endYear: number;
  yearsRemaining: number;
  status: string;
  hasPendingTeamOption: boolean;
  hasPendingPlayerOption: boolean;
};

export type NotificationView = {
  id: string;
  type: string;
  title: string;
  message: string;
  occurredOn: string;
  severity: string;
  read: boolean;
  relatedObjectiveId: string | null;
};

export type PlayerDetailView = {
  playerId: string;
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

export type FinancesView = {
  cash: number;
  payrollSnapshot: number;
  statement: TeamFinancialStatement;
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
        ? (getContractSalaryForYear(contract, year) ?? null)
        : null;
    const yearsRemaining =
      contract !== undefined ? Math.max(0, contract.endYear - year + 1) : null;
    rows.push({
      playerId: player.id,
      firstName: player.firstName,
      lastName: player.lastName,
      position: player.position,
      age: player.age,
      overall: calculatePlayerOverall(player.position, player.attributes),
      contractSalary: salary,
      contractEndYear: contract?.endYear ?? null,
      contractYearsRemaining: yearsRemaining,
      injuryKind: player.injury.kind,
      developmentStage: player.development.stage,
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
      rank: 0,
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

export function toFreeAgencyOfferViews(state: GameState): FreeAgencyOfferView[] {
  const teamId = state.user.controlledTeamId;
  const views: FreeAgencyOfferView[] = [];
  for (const offer of Object.values(state.business.freeAgency.offers)) {
    if (offer.teamId !== teamId) {
      continue;
    }
    const player = state.world.players[offer.playerId];
    const salary =
      getContractSalaryForYear(offer.terms, offer.terms.startYear) ?? null;
    views.push({
      offerId: offer.id,
      playerId: offer.playerId,
      playerName: player
        ? `${player.firstName} ${player.lastName}`
        : offer.playerId,
      status: offer.status,
      salary,
      years: offer.terms.endYear - offer.terms.startYear + 1,
      createdOn: offer.createdOn,
    });
  }
  views.sort((a, b) => b.createdOn.localeCompare(a.createdOn));
  return views;
}

export function toOpenFreeAgencyOfferViews(
  state: GameState,
): FreeAgencyOfferView[] {
  const teamId = state.user.controlledTeamId;
  const views: FreeAgencyOfferView[] = [];
  for (const offer of Object.values(state.business.freeAgency.offers)) {
    if (offer.teamId !== teamId || !isOpenOffer(offer.status)) {
      continue;
    }
    const player = state.world.players[offer.playerId];
    const salary =
      getContractSalaryForYear(offer.terms, offer.terms.startYear) ?? null;
    views.push({
      offerId: offer.id,
      playerId: offer.playerId,
      playerName: player
        ? `${player.firstName} ${player.lastName}`
        : offer.playerId,
      status: offer.status,
      salary,
      years: offer.terms.endYear - offer.terms.startYear + 1,
      createdOn: offer.createdOn,
    });
  }
  views.sort((a, b) => b.createdOn.localeCompare(a.createdOn));
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
  const userTeamId = state.user.controlledTeamId;
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

  const order = draft.order.map((slot) => {
    const owner = state.world.teams[slot.ownerTeamId];
    return {
      draftPickId: slot.draftPickId,
      overallPick: slot.overallPick,
      round: slot.round,
      ownerTeamId: slot.ownerTeamId,
      ownerAbbreviation: owner?.abbreviation ?? "???",
      status: slot.status,
      selectedPlayerId: slot.selectedPlayerId ?? null,
      isUserPick: slot.ownerTeamId === userTeamId,
    };
  });

  return {
    draftClassId: draft.id,
    status: draft.status,
    userOnClock: isUserOnDraftClock(state),
    onClockPickId: onClock?.draftPickId ?? null,
    onClockOverall: onClock?.overallPick ?? null,
    order,
    ownedPicks: order.filter((slot) => slot.isUserPick),
    selections: draft.selections.map((selection) => {
      const team = state.world.teams[selection.teamId];
      const player =
        state.world.players[selection.playerId] ??
        draft.prospects[selection.playerId]?.player;
      return {
        overallPick: selection.overallPick,
        teamAbbreviation: team?.abbreviation ?? "???",
        playerName: player
          ? `${player.firstName} ${player.lastName}`
          : selection.playerId,
        playerId: selection.playerId,
      };
    }),
    eligibleProspects,
  };
}

export function toScheduleView(state: GameState): ScheduleGameView[] {
  const teamId = state.user.controlledTeamId;
  const rows: ScheduleGameView[] = [];
  for (const game of Object.values(state.competition.games)) {
    if (game.homeTeamId !== teamId && game.awayTeamId !== teamId) {
      continue;
    }
    const home = game.homeTeamId === teamId;
    const opponentId = home ? game.awayTeamId : game.homeTeamId;
    const opponent = state.world.teams[opponentId];
    const final = game.status === "final";
    const teamScore = final ? (home ? game.score.home : game.score.away) : null;
    const opponentScore = final
      ? home
        ? game.score.away
        : game.score.home
      : null;
    rows.push({
      gameId: game.id,
      date: game.date,
      opponentAbbreviation: opponent?.abbreviation ?? "???",
      opponentName: opponent ? `${opponent.city} ${opponent.name}` : "Unknown",
      home,
      status: game.status,
      teamScore,
      opponentScore,
      won:
        teamScore !== null && opponentScore !== null
          ? teamScore > opponentScore
          : null,
    });
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));
  return rows;
}

export function toUpcomingGamesView(
  state: GameState,
  limit = 5,
): ScheduleGameView[] {
  const currentDate = state.world.calendar.currentDate;
  return toScheduleView(state)
    .filter((game) => game.status === "scheduled" && game.date >= currentDate)
    .slice(0, limit);
}

export function toObjectivesView(state: GameState): ObjectiveView[] {
  return state.user.objectives.map((objective) => ({
    id: objective.id,
    type: objective.type,
    description: objective.description,
    status: objective.status,
    seasonYear: objective.seasonYear,
    target: objective.target ?? null,
    progress: objective.progress ?? null,
    consequenceApplied: objective.consequenceApplied,
  }));
}

export function toEventLogView(
  state: GameState,
  limit?: number,
): EventLogEntryView[] {
  const entries = state.user.eventLog.map((event) => toEventLogEntry(event));
  const newestFirst = [...entries].reverse();
  return limit === undefined ? newestFirst : newestFirst.slice(0, limit);
}

export function toEventLogEntry(event: DomainEvent): EventLogEntryView {
  const amount =
    typeof event.payload.amount === "number"
      ? event.payload.amount
      : typeof event.payload.salary === "number"
        ? event.payload.salary
        : null;
  return {
    id: event.id,
    type: event.type,
    occurredOn: event.occurredOn,
    description: describeDomainEvent(event),
    amount,
  };
}

function describeDomainEvent(event: DomainEvent): string {
  const payload = event.payload;
  switch (event.type) {
    case "GameCompleted":
      return `Game completed${payload.gameId ? ` (${String(payload.gameId)})` : ""}`;
    case "ContractSigned":
      return `Contract signed${payload.playerId ? ` for ${String(payload.playerId)}` : ""}`;
    case "FreeAgentSigned":
      return `Free agent signed${payload.playerId ? `: ${String(payload.playerId)}` : ""}`;
    case "PlayerTraded":
      return `Player traded${payload.playerId ? `: ${String(payload.playerId)}` : ""}`;
    case "PlayerReleased":
      return `Player released${payload.playerId ? `: ${String(payload.playerId)}` : ""}`;
    case "DraftPickMade":
      return `Draft pick made${payload.playerId ? `: ${String(payload.playerId)}` : ""}`;
    case "RevenueRecorded":
      return `Revenue recorded${payload.category ? ` (${String(payload.category)})` : ""}`;
    case "ExpenseRecorded":
      return `Expense recorded${payload.category ? ` (${String(payload.category)})` : ""}`;
    case "PlayerInjured":
      return `Player injured${payload.playerId ? `: ${String(payload.playerId)}` : ""}`;
    case "PlayerDeveloped":
      return `Player developed${payload.playerId ? `: ${String(payload.playerId)}` : ""}`;
    case "PlayerDeclined":
      return `Player declined${payload.playerId ? `: ${String(payload.playerId)}` : ""}`;
    case "CoachHired":
      return `Coach hired${payload.coachId ? `: ${String(payload.coachId)}` : ""}`;
    case "StaffHired":
      return `Staff hired${payload.staffId ? `: ${String(payload.staffId)}` : ""}`;
    case "StaffFired":
      return `Staff fired${payload.staffId ? `: ${String(payload.staffId)}` : ""}`;
    case "FacilityUpgradeStarted":
      return `Facility upgrade started${payload.category ? ` (${String(payload.category)})` : ""}`;
    case "FacilityUpgradeCompleted":
      return `Facility upgrade completed${payload.category ? ` (${String(payload.category)})` : ""}`;
    case "SponsorshipSigned":
      return `Sponsorship signed${payload.sponsorshipId ? `: ${String(payload.sponsorshipId)}` : ""}`;
    case "SponsorshipExpired":
      return `Sponsorship expired${payload.sponsorshipId ? `: ${String(payload.sponsorshipId)}` : ""}`;
    case "RelocationStageChanged":
      return `Relocation stage: ${String(payload.stage ?? "?")}`;
    case "ExpansionStageChanged":
      return `Expansion stage: ${String(payload.stage ?? "?")}`;
    default:
      return event.type;
  }
}

export function toNotificationsView(state: GameState): NotificationView[] {
  return [...state.user.notifications].reverse().map((notification) => ({
    id: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    occurredOn: notification.occurredOn,
    severity: notification.severity,
    read: notification.read,
    relatedObjectiveId: notification.relatedObjectiveId ?? null,
  }));
}

export function toContractsView(state: GameState): ContractRowView[] {
  const teamId = state.user.controlledTeamId;
  const year = state.competition.season.year;
  const rows: ContractRowView[] = [];
  for (const contract of Object.values(state.business.contracts)) {
    if (contract.teamId !== teamId) {
      continue;
    }
    const player = state.world.players[contract.playerId];
    rows.push({
      contractId: contract.id,
      playerId: contract.playerId,
      playerName: player
        ? `${player.firstName} ${player.lastName}`
        : contract.playerId,
      position: player?.position ?? "—",
      salary: getContractSalaryForYear(contract, year) ?? null,
      startYear: contract.startYear,
      endYear: contract.endYear,
      yearsRemaining: Math.max(0, contract.endYear - year + 1),
      status: getContractStatus(contract, year),
      hasPendingTeamOption: contract.teamOption?.status === "pending",
      hasPendingPlayerOption: contract.playerOption?.status === "pending",
    });
  }
  rows.sort((a, b) => (b.salary ?? 0) - (a.salary ?? 0));
  return rows;
}

export function toFinancesView(state: GameState): FinancesView {
  const team = getControlledTeam(state);
  const year = state.competition.season.year;
  const finances = state.business.finances[team.id];
  return {
    cash: finances?.cash ?? 0,
    payrollSnapshot: finances?.payroll ?? 0,
    statement: getFinancialStatement(state, team.id, year),
  };
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
    onControlledRoster,
    injuryKind: player.injury.kind,
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
  const standings = toStandingsView(state);
  const userStanding = standings.find((row) => row.isUserTeam);
  const statement = getFinancialStatement(state, team.id, year);

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
    revenueTotal: statement.revenue.total,
    expensesTotal: statement.expenses.total,
    netIncome: statement.netIncome,
    standingsRank: userStanding?.rank ?? standings.length,
    controlledStanding: {
      wins: standing.wins,
      losses: standing.losses,
    },
    recentResults,
    upcomingGames: toUpcomingGamesView(state, 5),
    objectives: toObjectivesView(state),
    recentActivity: toEventLogView(state, 10),
    notifications: state.user.notifications.slice(-10).map((notification) => ({
      id: notification.id,
      type: notification.type,
      severity: notification.severity,
      message: notification.message,
      read: notification.read,
    })),
    unreadNotificationCount: state.user.notifications.filter((n) => !n.read)
      .length,
    playoffs: {
      status: playoffs.status,
      fieldSize: playoffs.fieldSize,
      userQualified,
      championTeamId: playoffs.championTeamId ?? null,
    },
    simulationFrequency: state.settings.simulation.frequency,
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

export type { TeamId };
