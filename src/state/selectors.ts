import {
  getContractSalaryForYear,
  getContractStatus,
  isContractActive,
} from "@/domain/entities/contract";
import { draftClassIdFor } from "@/domain/entities/draft";
import {
  fantasyDraftPlayerTier,
  type FantasyDraftAutoPickStrategy,
  type FantasyDraftTeamSummary,
  type FantasyDraftLeagueRecap,
} from "@/domain/entities/fantasy-draft";
import { ARCHETYPE_LABELS } from "@/domain/entities/player-archetype";
import { isOpenOffer } from "@/domain/entities/free-agency-offer";
import type { TeamFinancialStatement } from "@/domain/entities/finances";
import type { Game } from "@/domain/entities/game";
import { aggregateTeamStats } from "@/domain/entities/game-result";
import type { Team } from "@/domain/entities/team";
import { createEmptyTeamStanding } from "@/domain/entities/standings";
import { derivePlayerStrengthsWeaknesses } from "@/domain/player-evaluation";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { DomainEvent } from "@/domain/events";
import type { PlayerId, TeamId } from "@/domain/ids";
import type { GameMode, GameState } from "@/state/game-state";
import {
  formatCityLocation,
  getCitiesForArea,
  normalizeCityName,
} from "@/data/league/city-locations";
import { draftYearForSeason } from "@/systems/draft";
import { isUserOnDraftClock } from "@/systems/draft/draft-clock";
import { calculateTeamDraftNeeds } from "@/systems/draft/draft-needs";
import {
  getAvailableDraftPlayers,
  getRemainingPickSeconds,
  isUserOnFantasyDraftClock,
} from "@/systems/fantasy-draft/draft-clock";
import {
  getCurrentPick,
  getNextPick,
  getNextPickNumberForTeam,
} from "@/systems/fantasy-draft/draft-order";
import {
  draftTalentScore,
  fantasyDraftPositionCounts,
  rankCandidates,
} from "@/systems/fantasy-draft/draft-evaluation";
import { resolveFranchisePreferences } from "@/systems/franchise-ai-preferences";
import { listFreeAgents } from "@/systems/free-agency";
import { getTeamCapSpace, getTeamPayroll } from "@/systems/salary-cap";
import { getLeagueSalaryCap } from "@/systems/league-salary-cap";
import {
  getLeagueStaffBudget,
  getTeamStaffBudgetSpace,
  getTeamStaffPayroll,
} from "@/systems/staff-budget";
import { getFinancialStatement } from "@/systems/team-finances";
import { getCalendarContext } from "@/systems/simulation/calendar-context";
import { deriveDefaultTeamBranding } from "@/systems/team-branding-generation";
import {
  toBrandingView,
  type TeamBrandingView,
} from "@/state/team-branding-view";
import {
  getActiveOwnedFranchise,
  getOwnedTeamIds,
  getPendingDecisionsForTeam,
} from "@/state/owner-context";

export type { TeamBrandingView } from "@/state/team-branding-view";

export type DashboardSnapshot = {
  saveId: string;
  schemaVersion: number;
  currentDate: string;
  seasonYear: number;
  seasonPhase: string;
  offseasonStage: string;
  calendarDisplayLabel: string;
  leagueName: string;
  mode: GameMode;
  teamSelectionLocked: boolean;
  citySelectionConfirmed: boolean;
  franchiseIdentityConfirmed: boolean;
  fantasyDraftMode: boolean;
  fantasyDraftStatus: string | null;
  userOnDraftClock: boolean;
  controlledTeam: {
    id: string;
    city: string;
    name: string;
    abbreviation: string;
    branding: {
      primaryColor: string;
      secondaryColor: string;
      accentColor: string;
      logoId: string;
    };
  };
  /** Portfolio of all owned franchises for switcher / My Teams. */
  ownedTeams: Array<{
    id: string;
    city: string;
    name: string;
    abbreviation: string;
    branding: {
      primaryColor: string;
      secondaryColor: string;
      accentColor: string;
      logoId: string;
    };
    wins: number;
    losses: number;
    isActive: boolean;
    blockingDecisionCount: number;
    unreadNotificationCount: number;
  }>;
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
    gameId: string;
    date: string;
    opponentAbbreviation: string;
    home: boolean;
    teamScore: number;
    opponentScore: number;
    won: boolean;
    opponentBranding: TeamBrandingView | null;
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
  /** Active franchise AI management config (per-franchise, not career settings.ai). */
  activeFranchiseAi: {
    managementPreset: string;
    assistance: import("@/domain/ai-management-presets").AiAssistancePhases;
  };
  playoffs: {
    status: string;
    fieldSize: number;
    userQualified: boolean;
    championTeamId: string | null;
  };
};

export type ObjectiveView = {
  id: string;
  type: string;
  description: string;
  status: string;
  seasonYear: number;
  category: string;
  lifecycle: string;
  role: string;
  target: number | null;
  progress: number | null;
  horizonYears: number | null;
  baseline: number | null;
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
    ownerBranding: TeamBrandingView | null;
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
    teamBranding: TeamBrandingView | null;
    playerName: string;
    playerId: string;
  }>;
  eligibleProspects: Array<{
    playerId: string;
    firstName: string;
    lastName: string;
    position: string;
    /** Scout grade letter — never true overall. */
    scoutGrade: string | null;
    estimatedOverallMin: number | null;
    estimatedOverallMax: number | null;
    confidence: string | null;
    knowledgeLevel: string;
    projectedRankMin: number | null;
    projectedRankMax: number | null;
  }>;
};

export type ScheduleGameView = {
  gameId: string;
  date: string;
  opponentAbbreviation: string;
  opponentName: string;
  opponentTeamId: string;
  opponentBranding: TeamBrandingView | null;
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
  teamId: string;
  teamName: string;
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

export type FinancesView = {
  businessFunds: number;
  payrollSnapshot: number;
  statement: TeamFinancialStatement;
  salaryCap: number;
  salaryCapEnabled: boolean;
  playerPayroll: number;
  capSpace: number;
  staffBudget: number;
  staffPayroll: number;
  staffBudgetSpace: number;
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

  options.sort((a, b) =>
    a.city < b.city ? -1 : a.city > b.city ? 1 : 0,
  );
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
  const teamId = state.user.activeOwnerTeamId;
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
  const teamId = state.user.activeOwnerTeamId;
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
  const userTeamId = state.user.activeOwnerTeamId;
  const teamState = draft.teamDraftState[userTeamId];
  const onClock = draft.order.find((slot) => slot.status === "available");
  const eligibleProspects = Object.values(draft.prospects)
    .filter((prospect) => prospect.status === "eligible")
    .map((prospect) => {
      const estimate = teamState?.scouting.find(
        (report) => report.prospectPlayerId === prospect.playerId,
      );
      return {
        playerId: prospect.playerId,
        firstName: prospect.player.firstName,
        lastName: prospect.player.lastName,
        position: estimate?.positionEstimate ?? prospect.player.position,
        scoutGrade: estimate?.scoutGrade ?? null,
        estimatedOverallMin: estimate?.estimatedOverall.min ?? null,
        estimatedOverallMax: estimate?.estimatedOverall.max ?? null,
        confidence: estimate?.confidence ?? null,
        knowledgeLevel: estimate?.knowledgeLevel ?? "unknown",
        projectedRankMin: estimate?.projectedRank.min ?? null,
        projectedRankMax: estimate?.projectedRank.max ?? null,
      };
    })
    .sort((a, b) => {
      const midA =
        a.estimatedOverallMin != null && a.estimatedOverallMax != null
          ? (a.estimatedOverallMin + a.estimatedOverallMax) / 2
          : -1;
      const midB =
        b.estimatedOverallMin != null && b.estimatedOverallMax != null
          ? (b.estimatedOverallMin + b.estimatedOverallMax) / 2
          : -1;
      if (midA !== midB) return midB - midA;
      return a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0;
    });

  const order = draft.order.map((slot) => {
    const owner = state.world.teams[slot.ownerTeamId];
    return {
      draftPickId: slot.draftPickId,
      overallPick: slot.overallPick,
      round: slot.round,
      ownerTeamId: slot.ownerTeamId,
      ownerAbbreviation: owner?.abbreviation ?? "???",
      ownerBranding: toBrandingView(owner?.branding),
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
        teamBranding: toBrandingView(team?.branding),
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
  const teamId = state.user.activeOwnerTeamId;
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
      opponentTeamId: opponentId,
      opponentBranding: toBrandingView(opponent?.branding),
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
  return getActiveOwnedFranchise(state).objectives.map((objective) => ({
    id: objective.id,
    type: objective.type,
    description: objective.description,
    status: objective.status,
    seasonYear: objective.seasonYear,
    category: objective.category,
    lifecycle: objective.lifecycle,
    role: objective.role,
    target: objective.target ?? null,
    progress: objective.progress ?? null,
    horizonYears: objective.horizonYears ?? null,
    baseline: objective.baseline ?? null,
    consequenceApplied: objective.consequenceApplied,
  }));
}

export function toEventLogView(
  state: GameState,
  limit?: number,
): EventLogEntryView[] {
  const entries = getActiveOwnedFranchise(state).eventLog.map((event) => toEventLogEntry(event));
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
    case "HomeGameDaySettled": {
      const attendance = payload.attendance;
      return `Home game-day settled${
        typeof attendance === "number"
          ? ` (${attendance.toLocaleString()} attendance)`
          : ""
      }`;
    }
    case "PlayerPayrollPaid":
      return `Player payroll paid${
        typeof payload.amount === "number"
          ? ` (${payload.amount})`
          : ""
      }`;
    default:
      return event.type;
  }
}

export function toNotificationsView(state: GameState): NotificationView[] {
  const entries: NotificationView[] = [];
  for (const teamId of getOwnedTeamIds(state)) {
    const franchise = state.user.ownedFranchises[teamId];
    const team = state.world.teams[teamId];
    if (!franchise || !team) {
      continue;
    }
    const teamName = `${team.city} ${team.name}`;
    for (const notification of franchise.notifications) {
      entries.push({
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        occurredOn: notification.occurredOn,
        severity: notification.severity,
        read: notification.read,
        relatedObjectiveId: notification.relatedObjectiveId ?? null,
        teamId,
        teamName,
      });
    }
  }
  entries.sort((a, b) => (a.occurredOn < b.occurredOn ? 1 : a.occurredOn > b.occurredOn ? -1 : 0));
  return entries;
}

export function toContractsView(state: GameState): ContractRowView[] {
  const teamId = state.user.activeOwnerTeamId;
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
  const salaryCap = getLeagueSalaryCap(state);
  const staffBudget = getLeagueStaffBudget(state);
  const playerPayroll = getTeamPayroll(team.id, year, state);
  const staffPayroll = getTeamStaffPayroll(team.id, year, state);
  return {
    businessFunds: finances?.businessFunds ?? 0,
    payrollSnapshot: finances?.payroll ?? 0,
    statement: getFinancialStatement(state, team.id, year),
    salaryCap,
    salaryCapEnabled: state.settings.financialRules.salaryCapEnabled,
    playerPayroll,
    capSpace: getTeamCapSpace(team.id, year, state, salaryCap),
    staffBudget,
    staffPayroll,
    staffBudgetSpace: getTeamStaffBudgetSpace(team.id, year, state, staffBudget),
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
        gameId: game.id,
        date: game.date,
        opponentAbbreviation: opponent?.abbreviation ?? "???",
        home,
        teamScore,
        opponentScore,
        won: teamScore > opponentScore,
        opponentBranding: toBrandingView(opponent?.branding),
      };
    });

  return {
    saveId: state.meta.saveId,
    schemaVersion: state.meta.schemaVersion,
    currentDate: state.world.calendar.currentDate,
    seasonYear: year,
    seasonPhase: state.competition.season.phase,
    offseasonStage: state.competition.season.offseasonStage,
    calendarDisplayLabel: getCalendarContext(state).displayLabel,
    leagueName: state.world.league.name,
    mode: state.user.mode,
    teamSelectionLocked: state.world.calendar.lastSimulatedDate !== null,
    citySelectionConfirmed: getActiveOwnedFranchise(state).citySelectionConfirmed,
    franchiseIdentityConfirmed: getActiveOwnedFranchise(state).franchiseIdentityConfirmed,
    fantasyDraftMode: state.settings.draft.mode === "fantasy",
    fantasyDraftStatus: state.world.fantasyDraft?.status ?? null,
    userOnDraftClock: isUserOnDraftClock(state),
    controlledTeam: {
      id: team.id,
      city: team.city,
      name: team.name,
      abbreviation: team.abbreviation,
      branding: { ...team.branding },
    },
    ownedTeams: getOwnedTeamIds(state).map((ownedId) => {
      const ownedTeam = state.world.teams[ownedId]!;
      const ownedStanding =
        state.competition.standings.byTeamId[ownedId] ??
        createEmptyTeamStanding(ownedId);
      const franchise = state.user.ownedFranchises[ownedId]!;
      return {
        id: ownedTeam.id,
        city: ownedTeam.city,
        name: ownedTeam.name,
        abbreviation: ownedTeam.abbreviation,
        branding: { ...ownedTeam.branding },
        wins: ownedStanding.wins,
        losses: ownedStanding.losses,
        isActive: ownedId === state.user.activeOwnerTeamId,
        blockingDecisionCount: getPendingDecisionsForTeam(state, ownedId).filter(
          (d) => d.blockingLevel === "blocking",
        ).length,
        unreadNotificationCount: franchise.notifications.filter((n) => !n.read)
          .length,
      };
    }),
    teamCount: Object.keys(state.world.teams).length,
    playerCount: Object.keys(state.world.players).length,
    payroll: getTeamPayroll(team.id, year, state),
    capSpace: getTeamCapSpace(team.id, year, state),
    cash: state.business.finances[team.id]?.businessFunds ?? 0,
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
    notifications: getActiveOwnedFranchise(state).notifications.slice(-10).map((notification) => ({
      id: notification.id,
      type: notification.type,
      severity: notification.severity,
      message: notification.message,
      read: notification.read,
    })),
    unreadNotificationCount: getActiveOwnedFranchise(state).notifications.filter((n) => !n.read)
      .length,
    activeFranchiseAi: {
      managementPreset: getActiveOwnedFranchise(state).managementPreset,
      assistance: { ...getActiveOwnedFranchise(state).aiAssistance },
    },
    playoffs: {
      status: playoffs.status,
      fieldSize: playoffs.fieldSize,
      userQualified,
      championTeamId: playoffs.championTeamId ?? null,
    },
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

export type BoxScoreTeamStatsView = {
  points: number;
  fieldGoals: string;
  threePointers: string;
  freeThrows: string;
  rebounds: number;
  assists: number;
  turnovers: number;
  fouls: number;
};

export type PlayerBoxScoreRowView = {
  playerId: string;
  playerName: string;
  minutes: number;
  points: number;
  fieldGoals: string;
  threePointers: string;
  freeThrows: string;
  rebounds: number;
  assists: number;
  turnovers: number;
  fouls: number;
};

export type BoxScoreSideView = {
  teamId: string;
  city: string;
  name: string;
  abbreviation: string;
  score: number;
  teamStats: BoxScoreTeamStatsView;
  players: PlayerBoxScoreRowView[];
  branding: TeamBrandingView | null;
};

export type GameBoxScoreView = {
  gameId: string;
  date: string;
  competitionTypeLabel: string;
  seasonGameNumber: number | null;
  home: BoxScoreSideView;
  away: BoxScoreSideView;
  winner: "home" | "away";
  winnerName: string;
  margin: number;
  isCurrentSeason: boolean;
  rotation: GameRotationPanelView | null;
};

export type GameRotationPlayerCompareView = {
  playerId: string;
  name: string;
  minutes: number;
  targetMinutes: number | null;
  explanations: string[];
};

export type GameRotationSubView = {
  clockLabel: string;
  teamAbbreviation: string;
  detail: string;
};

export type GameRotationPanelView = {
  homePlayers: GameRotationPlayerCompareView[];
  awayPlayers: GameRotationPlayerCompareView[];
  substitutions: GameRotationSubView[];
};

/** True when a finalized current-season game can open a box-score page. */
export function canOpenGameBoxScore(
  state: GameState,
  gameId: string,
): boolean {
  const game = state.competition.games[gameId];
  if (!game || game.status !== "final") {
    return false;
  }
  return game.seasonId === state.competition.season.id;
}

/**
 * Current-season finalized game box score.
 * Returns null when missing, not final, or not current season.
 */
export function toGameBoxScoreView(
  state: GameState,
  gameId: string,
): GameBoxScoreView | null {
  const game = state.competition.games[gameId];
  if (!game || game.status !== "final") {
    return null;
  }
  if (game.seasonId !== state.competition.season.id) {
    return null;
  }

  const homeTeamLive = state.world.teams[game.homeTeamId];
  const awayTeamLive = state.world.teams[game.awayTeamId];
  const homeIdentity = resolveTeamIdentity(
    game.homeTeamSnapshot,
    homeTeamLive,
    game.homeTeamId,
  );
  const awayIdentity = resolveTeamIdentity(
    game.awayTeamSnapshot,
    awayTeamLive,
    game.awayTeamId,
  );

  const { homeRows, awayRows } = partitionBoxScorePlayers(game);

  const homeTeamStats = aggregateTeamStats(game.homeTeamId, homeRows);
  const awayTeamStats = aggregateTeamStats(game.awayTeamId, awayRows);

  const winner: "home" | "away" =
    game.score.home > game.score.away ? "home" : "away";
  const margin = Math.abs(game.score.home - game.score.away);
  const winnerName =
    winner === "home"
      ? `${homeIdentity.city} ${homeIdentity.name}`
      : `${awayIdentity.city} ${awayIdentity.name}`;

  let seasonGameNumber: number | null = null;
  if (game.competitionType === "regular_season") {
    const index = state.competition.schedule.gameIds.indexOf(game.id);
    if (index >= 0) {
      seasonGameNumber = index + 1;
    }
  }

  return {
    gameId: game.id,
    date: game.date,
    competitionTypeLabel:
      game.competitionType === "playoffs" ? "Playoffs" : "Regular Season",
    seasonGameNumber,
    home: {
      teamId: homeIdentity.teamId,
      city: homeIdentity.city,
      name: homeIdentity.name,
      abbreviation: homeIdentity.abbreviation,
      branding: homeIdentity.branding,
      score: game.score.home,
      teamStats: toTeamStatsView(homeTeamStats),
      players: homeRows.map((row) =>
        toPlayerBoxScoreRow(state, row),
      ),
    },
    away: {
      teamId: awayIdentity.teamId,
      city: awayIdentity.city,
      name: awayIdentity.name,
      abbreviation: awayIdentity.abbreviation,
      branding: awayIdentity.branding,
      score: game.score.away,
      teamStats: toTeamStatsView(awayTeamStats),
      players: awayRows.map((row) =>
        toPlayerBoxScoreRow(state, row),
      ),
    },
    winner,
    winnerName,
    margin,
    isCurrentSeason: true,
    rotation: toRotationPanelView(
      game,
      homeIdentity.abbreviation,
      awayIdentity.abbreviation,
      state,
    ),
  };
}

function toRotationPanelView(
  game: Game,
  homeAbbr: string,
  awayAbbr: string,
  state: GameState,
): GameRotationPanelView | null {
  const meta = game.rotationMeta;
  if (meta == null) {
    return null;
  }
  const buildSide = (
    snapshot: typeof meta.home,
    rows: typeof game.playerStats,
  ): GameRotationPlayerCompareView[] => {
    const byId = new Map(snapshot.map((entry) => [entry.playerId, entry]));
    return rows
      .filter((row) => row.minutes > 0 || byId.has(row.playerId))
      .map((row) => {
        const snap = byId.get(row.playerId);
        const player = state.world.players[row.playerId];
        const name =
          row.firstName && row.lastName
            ? `${row.firstName} ${row.lastName}`
            : player
              ? `${player.firstName} ${player.lastName}`
              : row.playerId;
        return {
          playerId: row.playerId,
          name,
          minutes: row.minutes,
          targetMinutes: snap?.targetMinutes ?? null,
          explanations: meta.explanations[row.playerId] ?? [],
        };
      })
      .sort((a, b) => b.minutes - a.minutes);
  };

  const { homeRows, awayRows } = partitionBoxScorePlayers(game);
  const substitutions = meta.trace
    .filter((entry) => entry.playerInId != null)
    .slice(0, 40)
    .map((entry) => {
      const minutes = Math.floor(entry.secondsRemaining / 60);
      const seconds = Math.floor(entry.secondsRemaining % 60);
      const periodLabel =
        entry.periodNumber <= 4
          ? `Q${entry.periodNumber}`
          : `OT${entry.periodNumber - 4}`;
      const abbr =
        entry.teamId === game.homeTeamId ? homeAbbr : awayAbbr;
      return {
        clockLabel: `${minutes}:${seconds.toString().padStart(2, "0")} ${periodLabel}`,
        teamAbbreviation: abbr,
        detail:
          entry.playerOutId != null
            ? `OUT ${entry.playerOutId} → IN ${entry.playerInId} (${entry.reason})`
            : `IN ${entry.playerInId} (${entry.reason})`,
      };
    });

  return {
    homePlayers: buildSide(meta.home, homeRows),
    awayPlayers: buildSide(meta.away, awayRows),
    substitutions,
  };
}

function resolveTeamIdentity(
  snapshot: Game["homeTeamSnapshot"],
  live: GameState["world"]["teams"][string] | undefined,
  teamId: string,
): {
  teamId: string;
  city: string;
  name: string;
  abbreviation: string;
  branding: TeamBrandingView | null;
} {
  if (snapshot) {
    // Snapshot is authoritative for historical games — never substitute live branding.
    const fromSnapshot = toBrandingView(snapshot.branding);
    return {
      teamId: snapshot.teamId,
      city: snapshot.city,
      name: snapshot.name,
      abbreviation: snapshot.abbreviation,
      branding:
        fromSnapshot ??
        toBrandingView(
          deriveDefaultTeamBranding(
            snapshot.teamId,
            snapshot.city,
            snapshot.name,
          ),
        ),
    };
  }
  const fromLive = toBrandingView(live?.branding);
  return {
    teamId,
    city: live?.city ?? "Unknown",
    name: live?.name ?? "Team",
    abbreviation: live?.abbreviation ?? "???",
    branding:
      fromLive ??
      toBrandingView(
        deriveDefaultTeamBranding(teamId, live?.city ?? "", live?.name ?? ""),
      ),
  };
}

function partitionBoxScorePlayers(game: Game): {
  homeRows: Game["playerStats"];
  awayRows: Game["playerStats"];
} {
  const withTeam = game.playerStats.filter((row) => row.teamId != null);
  if (withTeam.length === game.playerStats.length && withTeam.length > 0) {
    return {
      homeRows: game.playerStats.filter(
        (row) => row.teamId === game.homeTeamId,
      ),
      awayRows: game.playerStats.filter(
        (row) => row.teamId === game.awayTeamId,
      ),
    };
  }
  // Legacy pre-v35: home-then-away array order is a display hint only.
  const midpoint = Math.ceil(game.playerStats.length / 2);
  return {
    homeRows: game.playerStats.slice(0, midpoint),
    awayRows: game.playerStats.slice(midpoint),
  };
}

function toTeamStatsView(stats: {
  points: number;
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  threePointersMade: number;
  threePointersAttempted: number;
  freeThrowsMade: number;
  freeThrowsAttempted: number;
  rebounds: number;
  assists: number;
  turnovers: number;
  fouls: number;
}): BoxScoreTeamStatsView {
  return {
    points: stats.points,
    fieldGoals: `${stats.fieldGoalsMade}/${stats.fieldGoalsAttempted}`,
    threePointers: `${stats.threePointersMade}/${stats.threePointersAttempted}`,
    freeThrows: `${stats.freeThrowsMade}/${stats.freeThrowsAttempted}`,
    rebounds: stats.rebounds,
    assists: stats.assists,
    turnovers: stats.turnovers,
    fouls: stats.fouls,
  };
}

function toPlayerBoxScoreRow(
  state: GameState,
  row: Game["playerStats"][number],
): PlayerBoxScoreRowView {
  let playerName: string;
  if (row.firstName != null && row.lastName != null) {
    playerName = `${row.firstName} ${row.lastName}`;
  } else {
    const live = state.world.players[row.playerId];
    playerName = live
      ? `${live.firstName} ${live.lastName}`
      : row.playerId;
  }
  return {
    playerId: row.playerId,
    playerName,
    minutes: row.minutes,
    points: row.points,
    fieldGoals: `${row.fieldGoalsMade}/${row.fieldGoalsAttempted}`,
    threePointers: `${row.threePointersMade}/${row.threePointersAttempted}`,
    freeThrows: `${row.freeThrowsMade}/${row.freeThrowsAttempted}`,
    rebounds: row.rebounds,
    assists: row.assists,
    turnovers: row.turnovers,
    fouls: row.fouls,
  };
}

export type { TeamId };

export type FantasyDraftPoolPlayerView = {
  playerId: string;
  firstName: string;
  lastName: string;
  position: string;
  age: number;
  heightInches: number;
  weightPounds: number;
  archetype: string;
  archetypeLabel: string;
  overall: number;
  potential: number;
  tier: string;
  isDrafted: boolean;
  draftedByTeamId: string | null;
  draftedByAbbreviation: string | null;
  pickNumber: number | null;
  round: number | null;
};

export type FantasyDraftQueueEntryView = {
  playerId: string;
  firstName: string;
  lastName: string;
  position: string;
  overall: number;
  potential: number;
  isAvailable: boolean;
  draftedByTeamId: string | null;
  draftedByAbbreviation: string | null;
  pickNumber: number | null;
};

export type FantasyDraftRecommendationView = {
  playerId: string;
  firstName: string;
  lastName: string;
  position: string;
  overall: number;
  potential: number;
  tier: string;
};

export type FantasyDraftView = {
  status: string;
  draftType: string;
  orderMode: string;
  orderConfirmed: boolean;
  picksPerTeam: number;
  totalPicks: number;
  currentPickNumber: number | null;
  currentRound: number | null;
  draftProgressPercent: number;
  onClockTeamId: string | null;
  onClockTeamName: string | null;
  onClockTeamAbbreviation: string | null;
  onClockIsUser: boolean;
  nextTeamId: string | null;
  nextTeamName: string | null;
  userOnClock: boolean;
  timerEnabled: boolean;
  timerSecondsPerPick: number;
  pickStartedAt: string | null;
  remainingSeconds: number | null;
  paused: boolean;
  activeOwnerTeamId: string;
  settings: { confirmPicks: boolean };
  autoPickStrategy: FantasyDraftAutoPickStrategy;
  draftOrder: Array<{
    pickNumber: number;
    teamId: string;
    teamName: string;
    abbreviation: string;
    isUser: boolean;
    branding: TeamBrandingView | null;
  }>;
  controlledFranchises: Array<{
    teamId: string;
    teamName: string;
    abbreviation: string;
    isActive: boolean;
    isOnClock: boolean;
    autoPick: boolean;
    autoPickStrategy: FantasyDraftAutoPickStrategy;
    nextPickNumber: number | null;
    rosterCount: number;
    branding: TeamBrandingView | null;
  }>;
  availablePlayers: FantasyDraftPoolPlayerView[];
  poolPlayers: FantasyDraftPoolPlayerView[];
  queue: FantasyDraftQueueEntryView[];
  teamNeeds: Array<{ position: string; level: "HIGH" | "MEDIUM" | "LOW" }>;
  bestAvailable: FantasyDraftRecommendationView | null;
  bestFit: FantasyDraftRecommendationView | null;
  activeRoster: Array<{
    playerId: string;
    name: string;
    position: string;
    overall: number;
  }>;
  positionCounts: Array<{ position: string; count: number }>;
  selections: Array<{
    pickNumber: number;
    round: number;
    pickInRound: number;
    teamId: string;
    teamAbbreviation: string;
    teamName: string;
    playerId: string;
    playerName: string;
    position: string;
  }>;
  undraftedCount: number;
  selectionsMade: number;
};

export type FantasyDraftPlayerDetailView = {
  playerId: string;
  firstName: string;
  lastName: string;
  position: string;
  age: number;
  heightInches: number;
  weightPounds: number;
  archetype: string;
  archetypeLabel: string;
  nationality: string;
  overall: number;
  potential: number;
  tier: string;
  injuryKind: string;
  developmentStage: string;
  attributes: Record<string, number>;
  strengths: Array<{ label: string; rating: number }>;
  weaknesses: Array<{ label: string; rating: number }>;
  isDrafted: boolean;
  draftedByTeamId: string | null;
  draftedByTeamName: string | null;
  draftedByAbbreviation: string | null;
  pickNumber: number | null;
  round: number | null;
  inActiveQueue: boolean;
};

export type FantasyDraftSummaryView = {
  status: string;
  totalPicks: number;
  selectionsMade: number;
  undraftedCount: number;
  controlledTeamIds: string[];
  teamSummaries: Record<string, FantasyDraftTeamSummary>;
  leagueRecap: FantasyDraftLeagueRecap | null;
  teamNames: Record<string, { name: string; abbreviation: string }>;
};

function mapNeedLevel(
  level: string,
): "HIGH" | "MEDIUM" | "LOW" {
  if (level === "critical" || level === "major") return "HIGH";
  if (level === "moderate") return "MEDIUM";
  return "LOW";
}

function toRecommendationView(
  state: GameState,
  playerId: string | undefined,
): FantasyDraftRecommendationView | null {
  if (!playerId) return null;
  const player = state.world.players[playerId as PlayerId];
  if (!player) return null;
  const overall = calculatePlayerOverall(player.position, player.attributes);
  return {
    playerId: player.id,
    firstName: player.firstName,
    lastName: player.lastName,
    position: player.position,
    overall,
    potential: player.potential.overall,
    tier: fantasyDraftPlayerTier(overall),
  };
}

export function toFantasyDraftView(
  state: GameState,
  nowIso: string = new Date().toISOString(),
): FantasyDraftView | null {
  const draft = state.world.fantasyDraft;
  if (draft === null) {
    return null;
  }

  const current = getCurrentPick(state);
  const next = getNextPick(state);
  const onClockTeam = current
    ? state.world.teams[current.teamId]
    : undefined;
  const nextTeam = next ? state.world.teams[next.teamId] : undefined;
  const activeOwnerTeamId = state.user.activeOwnerTeamId;

  const selectionByPlayer = new Map(
    draft.selections.map((sel) => [String(sel.playerId), sel]),
  );

  const draftOrder = draft.draftOrder.map((teamId, index) => {
    const team = state.world.teams[teamId];
    return {
      pickNumber: index + 1,
      teamId,
      teamName: team ? `${team.city} ${team.name}` : teamId,
      abbreviation: team?.abbreviation ?? "???",
      isUser: state.user.ownedTeamIds.includes(teamId as TeamId),
      branding: toBrandingView(team?.branding),
    };
  });

  const controlledFranchises = state.user.ownedTeamIds.map((teamId) => {
    const team = state.world.teams[teamId];
    const strategy =
      draft.autoPickStrategy[teamId] ?? "queue_then_best_fit";
    return {
      teamId,
      teamName: team ? `${team.city} ${team.name}` : teamId,
      abbreviation: team?.abbreviation ?? "???",
      isActive: teamId === activeOwnerTeamId,
      isOnClock: current?.teamId === teamId,
      autoPick: Boolean(draft.userTeamAutoPick[teamId]),
      autoPickStrategy: strategy,
      nextPickNumber: getNextPickNumberForTeam(state, teamId),
      rosterCount: team?.roster.length ?? 0,
      branding: toBrandingView(team?.branding),
    };
  });

  const poolPlayers: FantasyDraftPoolPlayerView[] = [];
  for (const playerId of draft.poolPlayerIds) {
    const player = state.world.players[playerId];
    if (!player) continue;
    const overall = calculatePlayerOverall(player.position, player.attributes);
    const selection = selectionByPlayer.get(String(playerId));
    const draftedTeam = selection
      ? state.world.teams[selection.teamId]
      : undefined;
    poolPlayers.push({
      playerId: String(player.id),
      firstName: player.firstName,
      lastName: player.lastName,
      position: player.position,
      age: player.age,
      heightInches: player.heightInches,
      weightPounds: player.weightPounds,
      archetype: player.archetype,
      archetypeLabel: ARCHETYPE_LABELS[player.archetype] ?? player.archetype,
      overall,
      potential: player.potential.overall,
      tier: fantasyDraftPlayerTier(overall),
      isDrafted: selection !== undefined,
      draftedByTeamId: selection?.teamId ?? null,
      draftedByAbbreviation: draftedTeam?.abbreviation ?? null,
      pickNumber: selection?.pickNumber ?? null,
      round: selection?.round ?? null,
    });
  }
  poolPlayers.sort((a, b) => b.overall - a.overall);

  const availablePlayers = poolPlayers.filter((p) => !p.isDrafted);

  const queueIds = draft.teamQueues[activeOwnerTeamId] ?? [];
  const queueEntries: FantasyDraftQueueEntryView[] = queueIds.map(
    (playerId) => {
      const player = state.world.players[playerId];
      const selection = selectionByPlayer.get(String(playerId));
      const draftedTeam = selection
        ? state.world.teams[selection.teamId]
        : undefined;
      const overall = player
        ? calculatePlayerOverall(player.position, player.attributes)
        : 0;
      return {
        playerId,
        firstName: player?.firstName ?? "Unknown",
        lastName: player?.lastName ?? "",
        position: player?.position ?? "?",
        overall,
        potential: player?.potential.overall ?? 0,
        isAvailable: selection === undefined,
        draftedByTeamId: selection?.teamId ?? null,
        draftedByAbbreviation: draftedTeam?.abbreviation ?? null,
        pickNumber: selection?.pickNumber ?? null,
      };
    },
  );
  const queue = [
    ...queueEntries.filter((e) => e.isAvailable),
    ...queueEntries.filter((e) => !e.isAvailable),
  ];

  const needs = calculateTeamDraftNeeds(state, activeOwnerTeamId);
  const teamNeeds = ["PG", "SG", "SF", "PF", "C"].map((position) => {
    const row = needs.byPosition.find((n) => n.position === position);
    return {
      position,
      level: mapNeedLevel(row?.level ?? "none"),
    };
  });

  const availableEntities = getAvailableDraftPlayers(state);
  const prefs = resolveFranchisePreferences(
    state,
    activeOwnerTeamId,
  )?.preferences;
  let bestAvailableId: string | undefined;
  let bestTalent = -Infinity;
  for (const player of availableEntities) {
    const score = draftTalentScore(player, prefs);
    if (score > bestTalent) {
      bestTalent = score;
      bestAvailableId = player.id;
    }
  }
  const fitRanked = rankCandidates(
    state,
    activeOwnerTeamId,
    availableEntities,
    current?.round ?? 1,
    draft.picksPerTeam,
  );
  const bestAvailable = toRecommendationView(state, bestAvailableId);
  const bestFit = toRecommendationView(state, fitRanked[0]);

  const activeTeam = state.world.teams[activeOwnerTeamId];
  const activeRoster =
    activeTeam?.roster.map((playerId) => {
      const player = state.world.players[playerId];
      return {
        playerId,
        name: player
          ? `${player.firstName} ${player.lastName}`
          : playerId,
        position: player?.position ?? "?",
        overall: player
          ? calculatePlayerOverall(player.position, player.attributes)
          : 0,
      };
    }) ?? [];

  const counts = fantasyDraftPositionCounts(state, activeOwnerTeamId);
  const positionCounts = ["PG", "SG", "SF", "PF", "C"].map((position) => ({
    position,
    count: counts.get(position as "PG") ?? 0,
  }));

  const selections = draft.selections.map((selection) => {
    const team = state.world.teams[selection.teamId];
    const player = state.world.players[selection.playerId];
    return {
      pickNumber: selection.pickNumber,
      round: selection.round,
      pickInRound: selection.pickInRound,
      teamId: selection.teamId,
      teamAbbreviation: team?.abbreviation ?? "???",
      teamName: team ? `${team.city} ${team.name}` : selection.teamId,
      playerId: selection.playerId,
      playerName: player
        ? `${player.firstName} ${player.lastName}`
        : selection.playerId,
      position: player?.position ?? "?",
    };
  });

  const selectionsMade = draft.selections.length;
  const draftProgressPercent =
    draft.totalPicks > 0
      ? Math.round((selectionsMade / draft.totalPicks) * 100)
      : 0;

  return {
    status: draft.status,
    draftType: draft.draftType,
    orderMode: draft.orderMode,
    orderConfirmed: draft.orderConfirmed,
    picksPerTeam: draft.picksPerTeam,
    totalPicks: draft.totalPicks,
    currentPickNumber: draft.currentPickNumber,
    currentRound: current?.round ?? null,
    draftProgressPercent,
    onClockTeamId: current?.teamId ?? null,
    onClockTeamName: onClockTeam
      ? `${onClockTeam.city} ${onClockTeam.name}`
      : null,
    onClockTeamAbbreviation: onClockTeam?.abbreviation ?? null,
    onClockIsUser: current
      ? state.user.ownedTeamIds.includes(current.teamId)
      : false,
    nextTeamId: next?.teamId ?? null,
    nextTeamName: nextTeam ? `${nextTeam.city} ${nextTeam.name}` : null,
    userOnClock: isUserOnFantasyDraftClock(state),
    timerEnabled: draft.timer.enabled,
    timerSecondsPerPick: draft.timer.secondsPerPick,
    pickStartedAt: draft.timer.pickStartedAt,
    remainingSeconds: getRemainingPickSeconds(draft, nowIso),
    paused: draft.status === "paused",
    activeOwnerTeamId,
    settings: {
      confirmPicks: draft.settings?.confirmPicks ?? true,
    },
    autoPickStrategy:
      draft.autoPickStrategy[activeOwnerTeamId] ?? "queue_then_best_fit",
    draftOrder,
    controlledFranchises,
    availablePlayers,
    poolPlayers,
    queue,
    teamNeeds,
    bestAvailable,
    bestFit,
    activeRoster,
    positionCounts,
    selections,
    undraftedCount:
      draft.poolPlayerIds.length - draft.selectedPlayerIds.length,
    selectionsMade,
  };
}

export function toFantasyDraftPlayerDetailView(
  state: GameState,
  playerId: string,
): FantasyDraftPlayerDetailView | null {
  const draft = state.world.fantasyDraft;
  const player = state.world.players[playerId as PlayerId];
  if (!draft || !player) {
    return null;
  }
  if (!draft.poolPlayerIds.some((id) => id === player.id)) {
    return null;
  }

  const overall = calculatePlayerOverall(player.position, player.attributes);
  const selection = draft.selections.find(
    (sel) => String(sel.playerId) === String(playerId),
  );
  const draftedTeam = selection
    ? state.world.teams[selection.teamId]
    : undefined;
  const { strengths, weaknesses } = derivePlayerStrengthsWeaknesses(
    player.position,
    player.attributes,
  );
  const activeQueue = draft.teamQueues[state.user.activeOwnerTeamId] ?? [];

  return {
    playerId: player.id,
    firstName: player.firstName,
    lastName: player.lastName,
    position: player.position,
    age: player.age,
    heightInches: player.heightInches,
    weightPounds: player.weightPounds,
    archetype: player.archetype,
    archetypeLabel: ARCHETYPE_LABELS[player.archetype] ?? player.archetype,
    nationality: player.nationality,
    overall,
    potential: player.potential.overall,
    tier: fantasyDraftPlayerTier(overall),
    injuryKind: player.availability,
    developmentStage: player.development.stage,
    attributes: { ...player.attributes },
    strengths: strengths.map((s) => ({ label: s.label, rating: s.rating })),
    weaknesses: weaknesses.map((w) => ({ label: w.label, rating: w.rating })),
    isDrafted: selection !== undefined,
    draftedByTeamId: selection?.teamId ?? null,
    draftedByTeamName: draftedTeam
      ? `${draftedTeam.city} ${draftedTeam.name}`
      : null,
    draftedByAbbreviation: draftedTeam?.abbreviation ?? null,
    pickNumber: selection?.pickNumber ?? null,
    round: selection?.round ?? null,
    inActiveQueue: activeQueue.some((id) => id === player.id),
  };
}

export function toFantasyDraftSummaryView(
  state: GameState,
): FantasyDraftSummaryView | null {
  const draft = state.world.fantasyDraft;
  if (draft === null || draft.status !== "complete") {
    return null;
  }

  const teamNames: Record<string, { name: string; abbreviation: string }> = {};
  for (const teamId of draft.draftOrder) {
    const team = state.world.teams[teamId];
    teamNames[teamId] = {
      name: team ? `${team.city} ${team.name}` : teamId,
      abbreviation: team?.abbreviation ?? "???",
    };
  }

  return {
    status: draft.status,
    totalPicks: draft.totalPicks,
    selectionsMade: draft.selections.length,
    undraftedCount:
      draft.poolPlayerIds.length - draft.selectedPlayerIds.length,
    controlledTeamIds: [...state.user.ownedTeamIds],
    teamSummaries: draft.teamSummaries ?? {},
    leagueRecap: draft.leagueRecap ?? null,
    teamNames,
  };
}

