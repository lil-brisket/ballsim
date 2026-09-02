/**
 * Calendar projection — derived CalendarEventView[] from GameState.
 * Authoritative sources only (games, milestones, seasonEventLog, decisions, awards).
 * Never invents future trades/injuries; notifications are not a calendar source.
 */

import { formatCalendarDate } from "@/domain/calendar-date";
import {
  matchesCalendarFilter,
  type CalendarEventView,
  type CalendarFilter,
} from "@/domain/entities/calendar-event";
import { certaintyFromLifecycle } from "@/domain/entities/calendar-event";
import type { AwardResult } from "@/domain/entities/awards";
import {
  getBlockingOwnerDecisions,
  type PendingOwnerDecision,
} from "@/domain/entities/owner-decision";
import {
  IMPORTANCE_RANK,
  toSourceKey,
  type EventSourceRef,
  type ImportanceLevel,
} from "@/domain/entities/event-source";
import type { DomainEvent } from "@/domain/events";
import type { Game } from "@/domain/entities/game";
import type { PlayerId, SaveId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { getAwardDefinition } from "@/systems/awards/award-definitions";
import {
  AWARD_POLICY,
  COMPLETED_GAME_POLICY,
  getDomainEventPolicy,
  getMilestonePolicy,
  OWNER_DECISION_POLICY,
  SCHEDULED_GAME_POLICY,
} from "@/systems/event-registry";
import {
  getLeagueMilestones,
  type LeagueMilestone,
} from "@/systems/league-rules/calendar-events";
import {
  getTeamTransactions,
  TEAM_TRANSACTION_EVENT_TYPES,
} from "@/state/team-transaction-selectors";

export type ProjectCalendarEventsOptions = {
  teamId?: TeamId;
  from?: string;
  to?: string;
  filter?: CalendarFilter;
  /** When true, only events involving the active (or options.teamId) owner team. */
  userTeamOnly?: boolean;
  /** Used in href placeholders; defaults to state.meta.saveId. */
  saveId?: SaveId | string;
};

export function projectCalendarEvents(
  state: GameState,
  options: ProjectCalendarEventsOptions = {},
): CalendarEventView[] {
  const currentDate = state.world.calendar.currentDate;
  const saveId = String(options.saveId ?? state.meta.saveId);
  const focusTeamId = options.teamId ?? state.user.activeOwnerTeamId;
  const bySourceKey = new Map<string, CalendarEventView>();

  const upsert = (event: CalendarEventView): void => {
    if (!bySourceKey.has(event.sourceKey)) {
      bySourceKey.set(event.sourceKey, event);
    }
  };

  for (const game of Object.values(state.competition.games)) {
    const view = projectGame(state, game, currentDate, saveId, focusTeamId);
    if (view) upsert(view);
  }

  for (const milestone of getLeagueMilestones(state)) {
    const view = projectMilestone(milestone, currentDate, saveId);
    if (view) upsert(view);
  }

  for (const domainEvent of state.competition.seasonEventLog) {
    // Team-scoped transaction rows come from the canonical selector below.
    if (
      (options.teamId != null || options.userTeamOnly) &&
      TEAM_TRANSACTION_EVENT_TYPES.includes(domainEvent.type)
    ) {
      continue;
    }
    const view = projectDomainEvent(state, domainEvent, currentDate, saveId);
    if (view) upsert(view);
  }

  if (options.teamId != null || options.userTeamOnly) {
    for (const row of getTeamTransactions(state, focusTeamId, {
      from: options.from,
      to: options.to,
    })) {
      const view = projectDomainEvent(state, row.event, currentDate, saveId);
      if (view) upsert(view);
    }
  }

  for (const decision of getBlockingOwnerDecisions(state.user)) {
    upsert(projectOwnerDecision(state, decision, currentDate, saveId));
  }

  for (const award of Object.values(state.business.awards.results)) {
    const view = projectAward(state, award, currentDate, saveId);
    if (view) upsert(view);
  }

  let events = [...bySourceKey.values()];

  events = events.filter((event) =>
    isAllowedOnDate(event, currentDate),
  );

  if (options.from !== undefined) {
    events = events.filter((event) => event.date >= options.from!);
  }
  if (options.to !== undefined) {
    events = events.filter((event) => event.date <= options.to!);
  }

  if (options.userTeamOnly) {
    events = events.filter(
      (event) =>
        event.blocking ||
        (event.teamIds !== undefined && event.teamIds.includes(focusTeamId)),
    );
  } else if (options.teamId !== undefined) {
    events = events.filter(
      (event) =>
        event.category === "league" ||
        event.category === "deadline" ||
        event.blocking ||
        (event.teamIds !== undefined && event.teamIds.includes(options.teamId!)),
    );
  }

  const filter = options.filter ?? "all";
  if (filter !== "all") {
    events = events.filter((event) =>
      matchesCalendarFilter(event, filter, focusTeamId),
    );
  }

  events.sort(compareCalendarEvents);
  return events;
}

function isAllowedOnDate(
  event: CalendarEventView,
  currentDate: string,
): boolean {
  if (event.date > currentDate) {
    return (
      event.lifecycle === "scheduled" || event.lifecycle === "action_required"
    );
  }
  return true;
}

function compareCalendarEvents(
  a: CalendarEventView,
  b: CalendarEventView,
): number {
  const byDate = a.date.localeCompare(b.date);
  if (byDate !== 0) return byDate;
  const byImportance =
    IMPORTANCE_RANK[b.importance] - IMPORTANCE_RANK[a.importance];
  if (byImportance !== 0) return byImportance;
  return a.sourceKey.localeCompare(b.sourceKey);
}

function projectGame(
  state: GameState,
  game: Game,
  currentDate: string,
  saveId: string,
  focusTeamId?: TeamId,
): CalendarEventView | null {
  const isFinal = game.status === "final";
  if (game.date > currentDate && isFinal) {
    return null;
  }

  const policy = isFinal ? COMPLETED_GAME_POLICY : SCHEDULED_GAME_POLICY;
  if (!policy.calendar.show) return null;

  const awayName = teamDisplayName(state, game.awayTeamId);
  const homeName = teamDisplayName(state, game.homeTeamId);
  const title = `${awayName} @ ${homeName}`;
  let description: string | undefined;
  if (isFinal) {
    description = `Final ${game.score.away}–${game.score.home}`;
  } else if (game.status === "in_progress") {
    description = "In progress";
  }

  const source: EventSourceRef = { type: "game", id: game.id };
  const sourceKey = toSourceKey(source);
  const controlledTeamId = focusTeamId ?? state.user.activeOwnerTeamId;
  const importance: ImportanceLevel =
    game.homeTeamId === controlledTeamId || game.awayTeamId === controlledTeamId
      ? "high"
      : policy.media.importance;

  return {
    id: `cal:${sourceKey}`,
    date: game.date,
    lifecycle: policy.calendar.lifecycle,
    certainty: certaintyFromLifecycle(policy.calendar.lifecycle),
    category: policy.calendar.category,
    title,
    description,
    importance,
    source,
    sourceKey,
    teamIds: [game.homeTeamId, game.awayTeamId],
    blocking: false,
    completed: isFinal,
    href: `/dashboard/${saveId}/games/${game.id}`,
  };
}


function projectMilestone(
  milestone: LeagueMilestone,
  currentDate: string,
  saveId: string,
): CalendarEventView | null {
  if (milestone.date === null) return null;

  const policy = getMilestonePolicy(milestone.key);
  if (!policy.calendar.show) return null;

  const source: EventSourceRef = { type: "milestone", key: milestone.key };
  const sourceKey = toSourceKey(source);
  const isPastOrToday = milestone.date <= currentDate;

  return {
    id: `cal:${sourceKey}`,
    date: milestone.date,
    lifecycle: isPastOrToday ? "occurred" : policy.calendar.lifecycle,
    certainty: certaintyFromLifecycle(isPastOrToday ? "occurred" : policy.calendar.lifecycle),
    category: policy.calendar.category,
    title: milestone.label,
    importance: policy.media.importance,
    source,
    sourceKey,
    blocking: false,
    completed: milestone.reached,
    href: `/dashboard/${saveId}/calendar`,
  };
}

function projectDomainEvent(
  state: GameState,
  domainEvent: DomainEvent,
  currentDate: string,
  saveId: string,
): CalendarEventView | null {
  // Games are projected from competition.games; avoid duplicate GameCompleted rows.
  if (domainEvent.type === "GameCompleted") {
    return null;
  }

  if (domainEvent.occurredOn > currentDate) {
    return null;
  }

  const policy = getDomainEventPolicy(domainEvent.type);
  if (!policy.calendar.show) return null;

  const source: EventSourceRef = {
    type: "domain_event",
    id: domainEvent.id,
  };
  const sourceKey = toSourceKey(source);
  const { title, description, teamIds, playerIds, href } = describeDomainEvent(
    state,
    domainEvent,
    saveId,
  );

  return {
    id: `cal:${sourceKey}`,
    date: domainEvent.occurredOn,
    lifecycle: policy.calendar.lifecycle,
    certainty: certaintyFromLifecycle(policy.calendar.lifecycle),
    category: policy.calendar.category,
    title,
    description,
    importance: policy.media.importance,
    source,
    sourceKey,
    teamIds,
    playerIds,
    blocking: false,
    completed: true,
    href,
  };
}

function projectOwnerDecision(
  state: GameState,
  decision: PendingOwnerDecision,
  currentDate: string,
  saveId: string,
): CalendarEventView {
  const policy = OWNER_DECISION_POLICY;
  const source: EventSourceRef = {
    type: "owner_decision",
    id: decision.id,
  };
  const sourceKey = toSourceKey(source);
  const offeringName = teamDisplayName(
    state,
    decision.payload.offeringTeamId,
  );
  const date =
    decision.createdOn <= currentDate ? currentDate : decision.createdOn;

  return {
    id: `cal:${sourceKey}`,
    date,
    lifecycle: policy.calendar.lifecycle,
    certainty: certaintyFromLifecycle(policy.calendar.lifecycle),
    category: policy.calendar.category,
    title: `Trade offer from ${offeringName}`,
    description:
      decision.payload.expiresOn !== undefined
        ? `Expires ${decision.payload.expiresOn}`
        : undefined,
    importance: policy.media.importance,
    source,
    sourceKey,
    teamIds: [...decision.participantTeamIds],
    playerIds: collectTradePlayerIds(decision),
    blocking: true,
    completed: false,
    href: `/dashboard/${saveId}/trades/${decision.id}`,
  };
}

function projectAward(
  state: GameState,
  award: AwardResult,
  currentDate: string,
  saveId: string,
): CalendarEventView | null {
  const date = awardCalendarDate(state, award);
  if (date === null || date > currentDate) {
    return null;
  }

  const policy = AWARD_POLICY;
  if (!policy.calendar.show) return null;

  const def = getAwardDefinition(award.awardId);
  const winnerName = resolveAwardWinnerName(state, award);
  const source: EventSourceRef = { type: "award", id: award.id };
  const sourceKey = toSourceKey(source);
  const teamIds =
    award.winner.teamId !== null ? [award.winner.teamId] : undefined;
  const playerIds =
    award.winner.subjectType === "player"
      ? [award.winner.subjectId as PlayerId]
      : undefined;

  return {
    id: `cal:${sourceKey}`,
    date,
    lifecycle: policy.calendar.lifecycle,
    certainty: certaintyFromLifecycle(policy.calendar.lifecycle),
    category: policy.calendar.category,
    title: `${def.displayName}: ${winnerName}`,
    importance: policy.media.importance,
    source,
    sourceKey,
    teamIds,
    playerIds,
    blocking: false,
    completed: true,
    href: `/dashboard/${saveId}/awards`,
  };
}

/** Announcement date for an award result (derived; awards store no occurredOn). */
export function awardCalendarDate(
  state: GameState,
  award: AwardResult,
): string | null {
  if (award.period !== null) {
    return firstDayOfNextMonth(award.period);
  }
  return latestPrimaryGameDate(state) ?? state.world.calendar.currentDate;
}

function firstDayOfNextMonth(yearMonth: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(yearMonth);
  if (!match) {
    throw new Error(`Invalid award period "${yearMonth}"; expected YYYY-MM.`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month === 12) {
    return formatCalendarDate(year + 1, 1, 1);
  }
  return formatCalendarDate(year, month + 1, 1);
}

function latestPrimaryGameDate(state: GameState): string | null {
  let latest: string | null = null;
  for (const game of Object.values(state.competition.games)) {
    if (game.competitionType === "development_league") continue;
    if (game.status !== "final") continue;
    if (latest === null || game.date > latest) latest = game.date;
  }
  return latest;
}

function collectTradePlayerIds(decision: PendingOwnerDecision): PlayerId[] {
  const proposal = decision.payload.currentProposal;
  return [...proposal.sideA.playerIds, ...proposal.sideB.playerIds];
}

function describeDomainEvent(
  state: GameState,
  event: DomainEvent,
  saveId: string,
): {
  title: string;
  description?: string;
  teamIds?: TeamId[];
  playerIds?: PlayerId[];
  href?: string;
} {
  const payload = event.payload;
  const playerId = asOptionalPlayerId(payload.playerId);
  const teamId = asOptionalTeamId(payload.teamId);
  const fromTeamId = asOptionalTeamId(payload.fromTeamId);
  const toTeamId = asOptionalTeamId(payload.toTeamId);
  const playerName = playerId ? playerDisplayName(state, playerId) : null;
  const teamName = teamId ? teamDisplayName(state, teamId) : null;

  switch (event.type) {
    case "PlayerInjured":
      return {
        title: playerName ? `${playerName} injured` : "Player injured",
        description:
          typeof payload.severity === "string"
            ? `Severity: ${payload.severity}`
            : undefined,
        teamIds: teamId ? [teamId] : undefined,
        playerIds: playerId ? [playerId] : undefined,
        href: playerId
          ? `/dashboard/${saveId}/players/${playerId}`
          : `/dashboard/${saveId}/transactions`,
      };
    case "PlayerTraded":
      return {
        title: playerName ? `${playerName} traded` : "Player traded",
        description:
          fromTeamId && toTeamId
            ? `${teamDisplayName(state, fromTeamId)} → ${teamDisplayName(state, toTeamId)}`
            : undefined,
        teamIds: [fromTeamId, toTeamId].filter(
          (id): id is TeamId => id !== undefined,
        ),
        playerIds: playerId ? [playerId] : undefined,
        href: `/dashboard/${saveId}/transactions`,
      };
    case "ContractSigned":
    case "FreeAgentSigned":
      return {
        title: playerName ? `${playerName} signed` : "Contract signed",
        description: teamName ?? undefined,
        teamIds: teamId ? [teamId] : undefined,
        playerIds: playerId ? [playerId] : undefined,
        href: `/dashboard/${saveId}/transactions`,
      };
    case "PlayerReleased":
      return {
        title: playerName ? `${playerName} released` : "Player released",
        description: teamName ?? undefined,
        teamIds: teamId ? [teamId] : undefined,
        playerIds: playerId ? [playerId] : undefined,
        href: `/dashboard/${saveId}/transactions`,
      };
    case "DraftPickMade":
      return {
        title: playerName ? `Drafted ${playerName}` : "Draft pick made",
        description: teamName ?? undefined,
        teamIds: teamId ? [teamId] : undefined,
        playerIds: playerId ? [playerId] : undefined,
        href: `/dashboard/${saveId}/draft`,
      };
    case "OffseasonStageAdvanced":
    case "LeaguePhaseAdvanced":
      return {
        title:
          event.type === "OffseasonStageAdvanced"
            ? "Offseason stage advanced"
            : "League phase advanced",
        href: `/dashboard/${saveId}/calendar`,
      };
    case "CoachHired":
    case "StaffHired":
      return {
        title: "Staff hired",
        description: teamName ?? undefined,
        teamIds: teamId ? [teamId] : undefined,
        href: `/dashboard/${saveId}/staff`,
      };
    case "StaffFired":
      return {
        title: "Staff fired",
        description: teamName ?? undefined,
        teamIds: teamId ? [teamId] : undefined,
        href: `/dashboard/${saveId}/staff`,
      };
    case "PlayerRetired":
      return {
        title: playerName ? `${playerName} retired` : "Player retired",
        teamIds: teamId ? [teamId] : undefined,
        playerIds: playerId ? [playerId] : undefined,
        href: playerId
          ? `/dashboard/${saveId}/players/${playerId}`
          : `/dashboard/${saveId}/transactions`,
      };
    case "FacilityUpgradeStarted":
    case "FacilityUpgradeCompleted":
      return {
        title:
          event.type === "FacilityUpgradeStarted"
            ? "Facility upgrade started"
            : "Facility upgrade completed",
        teamIds: teamId ? [teamId] : undefined,
        href: `/dashboard/${saveId}/facilities`,
      };
    case "SponsorshipSigned":
    case "SponsorshipExpired":
      return {
        title:
          event.type === "SponsorshipSigned"
            ? "Sponsorship signed"
            : "Sponsorship expired",
        teamIds: teamId ? [teamId] : undefined,
        href: `/dashboard/${saveId}/sponsorships`,
      };
    case "RelocationStageChanged":
      return {
        title: `Relocation: ${String(payload.stage ?? "update")}`,
        teamIds: teamId ? [teamId] : undefined,
        href: `/dashboard/${saveId}/relocation`,
      };
    case "ExpansionStageChanged":
      return {
        title: `Expansion: ${String(payload.stage ?? "update")}`,
        href: `/dashboard/${saveId}/league`,
      };
    default:
      return {
        title: humanizeEventType(event.type),
        teamIds: teamId ? [teamId] : undefined,
        playerIds: playerId ? [playerId] : undefined,
        href: `/dashboard/${saveId}/transactions`,
      };
  }
}

function humanizeEventType(type: string): string {
  return type.replace(/([a-z])([A-Z])/g, "$1 $2");
}

export function teamDisplayName(state: GameState, teamId: TeamId): string {
  const team = state.world.teams[teamId];
  if (!team) return String(teamId);
  return `${team.city} ${team.name}`;
}

export function playerDisplayName(
  state: GameState,
  playerId: PlayerId,
): string {
  const player = state.world.players[playerId];
  if (!player) return String(playerId);
  return `${player.firstName} ${player.lastName}`;
}

function resolveAwardWinnerName(state: GameState, award: AwardResult): string {
  if (award.winner.subjectType === "player") {
    return playerDisplayName(state, award.winner.subjectId as PlayerId);
  }
  const coach = state.world.coaches[award.winner.subjectId];
  if (coach) {
    return `${coach.firstName} ${coach.lastName}`;
  }
  return String(award.winner.subjectId);
}

function asOptionalTeamId(value: unknown): TeamId | undefined {
  return typeof value === "string" ? (value as TeamId) : undefined;
}

function asOptionalPlayerId(value: unknown): PlayerId | undefined {
  return typeof value === "string" ? (value as PlayerId) : undefined;
}
