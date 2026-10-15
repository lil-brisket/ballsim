import type { GameMode, GameState } from "@/state/game-state";
import {
  type TeamBrandingView,
  toBrandingView,
} from "@/state/team-branding-view";
import {
  getActiveOwnedFranchise,
  getOwnedTeamIds,
  getPendingDecisionsForTeam,
} from "@/state/owner-context";
import type { DomainEvent } from "@/domain/events";
import { isOwnerNotificationStillUnread } from "@/systems/owner-notifications";
import { createEmptyTeamStanding } from "@/domain/entities/standings";
import { getFinancialStatement } from "@/systems/team-finances";
import { getCalendarContext } from "@/systems/simulation/calendar-context";
import { isUserOnDraftClock } from "@/systems/draft/draft-clock";
import { getTeamPayroll, getTeamCapSpace } from "@/systems/salary-cap";
import {
  type ScheduleGameView,
  toUpcomingGamesView,
} from "@/state/selectors/schedule";
import {
  getControlledTeam,
  toStandingsView,
} from "@/state/selectors/teams-roster";
import { canOpenGameBoxScore } from "@/state/selectors/box-score";
import {
  advanceBlockedReason,
  getLocalParticipation,
  getParticipantForTeam,
} from "@/systems/participation";

export type ParticipationView = {
  activeParticipantId: string;
  assignmentsConfirmed: boolean;
  /** Why the league cannot advance yet, or null when it can. */
  advanceBlockedReason: string | null;
  participants: Array<{
    id: string;
    displayName: string;
    isHost: boolean;
    isActive: boolean;
    isReady: boolean;
    teamIds: string[];
    plannedTeamCount: number;
  }>;
};

function toParticipationView(state: GameState): ParticipationView | null {
  const local = getLocalParticipation(state);
  if (!local) {
    return null;
  }
  return {
    activeParticipantId: local.activeParticipantId,
    assignmentsConfirmed: local.assignmentsConfirmed,
    advanceBlockedReason: advanceBlockedReason(state),
    participants: local.participants.map((p) => ({
      id: p.id,
      displayName: p.displayName,
      isHost: p.isHost,
      isActive: p.id === local.activeParticipantId,
      isReady: local.readyParticipantIds.includes(p.id),
      teamIds: [...p.teamIds],
      plannedTeamCount: p.plannedTeamCount,
    })),
  };
}

export type DashboardSnapshot = {
  saveId: string;
  schemaVersion: number;
  currentDate: string;
  seasonYear: number;
  seasonPhase: string;
  offseasonStage: string;
  calendarDisplayLabel: string;
  tradesOpen: boolean;
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
  /** Portfolio of all owned franchises for the header franchise switcher. */
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
    /** Local shared leagues: the participant managing this team. */
    participantId: string | null;
    blockingDecisionCount: number;
    unreadNotificationCount: number;
  }>;
  /** Local shared league (hotseat) state; null for single-player saves. */
  participation: ParticipationView | null;
  teamCount: number;
  playerCount: number;
  payroll: number;
  capSpace: number;
  cash: number;
  revenueTotal: number;
  expensesTotal: number;
  netIncome: number;
  standingsRank: number | null;
  controlledStanding: { wins: number; losses: number };
  recentResults: Array<{
    gameId: string;
    date: string;
    opponentAbbreviation: string;
    opponentTeamId: string;
    home: boolean;
    teamScore: number;
    opponentScore: number;
    won: boolean;
    opponentBranding: TeamBrandingView | null;
    /** True when a play-by-play log exists for this game (Watch link). */
    canWatch?: boolean;
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
  const entries = getActiveOwnedFranchise(state).eventLog.map((event) =>
    toEventLogEntry(event),
  );
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
    case "DraftPickTraded":
      return `Draft pick traded${payload.draftPickId ? `: ${String(payload.draftPickId)}` : ""}`;
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
        typeof payload.amount === "number" ? ` (${payload.amount})` : ""
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
        read: !isOwnerNotificationStillUnread(
          notification,
          state.world.calendar.currentDate,
        ),
        relatedObjectiveId: notification.relatedObjectiveId ?? null,
        teamId,
        teamName,
      });
    }
  }
  entries.sort((a, b) =>
    a.occurredOn < b.occurredOn ? 1 : a.occurredOn > b.occurredOn ? -1 : 0,
  );
  return entries;
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
        opponentTeamId: opponentId,
        home,
        teamScore,
        opponentScore,
        won: teamScore > opponentScore,
        opponentBranding: toBrandingView(opponent?.branding),
        canWatch:
          canOpenGameBoxScore(state, game.id) &&
          state.competition.playByPlay[game.id] != null,
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
    tradesOpen: getCalendarContext(state).tradesOpen,
    leagueName: state.world.league.name,
    mode: state.user.mode,
    teamSelectionLocked: state.world.calendar.lastSimulatedDate !== null,
    citySelectionConfirmed:
      getActiveOwnedFranchise(state).citySelectionConfirmed,
    franchiseIdentityConfirmed:
      getActiveOwnedFranchise(state).franchiseIdentityConfirmed,
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
        participantId: getParticipantForTeam(state, ownedId)?.id ?? null,
        blockingDecisionCount: getPendingDecisionsForTeam(
          state,
          ownedId,
        ).filter((d) => d.blockingLevel === "blocking").length,
        unreadNotificationCount: franchise.notifications.filter((n) =>
          isOwnerNotificationStillUnread(n, state.world.calendar.currentDate),
        ).length,
      };
    }),
    participation: toParticipationView(state),
    teamCount: Object.keys(state.world.teams).length,
    playerCount: Object.keys(state.world.players).length,
    payroll: getTeamPayroll(team.id, year, state),
    capSpace: getTeamCapSpace(team.id, year, state),
    cash: state.business.finances[team.id]?.businessFunds ?? 0,
    revenueTotal: statement.revenue.total,
    expensesTotal: statement.expenses.total,
    netIncome: statement.netIncome,
    standingsRank:
      standing.wins + standing.losses === 0
        ? null
        : (userStanding?.rank ?? standings.length),
    controlledStanding: {
      wins: standing.wins,
      losses: standing.losses,
    },
    recentResults,
    upcomingGames: toUpcomingGamesView(state, 5),
    objectives: toObjectivesView(state),
    recentActivity: toEventLogView(state, 10),
    notifications: getActiveOwnedFranchise(state)
      .notifications.slice(-10)
      .map((notification) => ({
        id: notification.id,
        type: notification.type,
        severity: notification.severity,
        message: notification.message,
        read: !isOwnerNotificationStillUnread(
          notification,
          state.world.calendar.currentDate,
        ),
      })),
    unreadNotificationCount: getActiveOwnedFranchise(
      state,
    ).notifications.filter((n) =>
      isOwnerNotificationStillUnread(n, state.world.calendar.currentDate),
    ).length,
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
