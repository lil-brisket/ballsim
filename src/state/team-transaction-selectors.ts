/**
 * Canonical team transaction selector — structured team-ID relevance only.
 * Used by calendar, simulation summary, team management, and media surfaces.
 */

import type { DomainEvent, DomainEventType } from "@/domain/events";
import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";

export const TEAM_TRANSACTION_EVENT_TYPES: readonly DomainEventType[] = [
  "ContractSigned",
  "FreeAgentSigned",
  "PlayerTraded",
  "PlayerReleased",
  "DraftPickMade",
  "CoachHired",
  "StaffHired",
  "StaffFired",
] as const;

export type TeamTransactionDateRange = {
  from?: string;
  to?: string;
};

export type TeamTransactionRef = {
  event: DomainEvent;
  involvedTeamIds: TeamId[];
};

function collectInvolvedTeamIds(event: DomainEvent): TeamId[] {
  const payload = event.payload as Record<string, unknown>;
  const ids = new Set<string>();
  for (const key of [
    "teamId",
    "fromTeamId",
    "toTeamId",
    "homeTeamId",
    "awayTeamId",
  ] as const) {
    const value = payload[key];
    if (typeof value === "string" && value.length > 0) {
      ids.add(value);
    }
  }
  const related = payload.involvedTeamIds;
  if (Array.isArray(related)) {
    for (const value of related) {
      if (typeof value === "string" && value.length > 0) {
        ids.add(value);
      }
    }
  }
  return [...ids] as TeamId[];
}

/**
 * True when the event involves `teamId` via structured team ID fields.
 */
export function isTransactionRelevantToTeam(
  event: DomainEvent,
  teamId: TeamId,
): boolean {
  return collectInvolvedTeamIds(event).includes(teamId);
}

/**
 * Canonical team transaction query over seasonEventLog (+ optional extra events).
 */
export function getTeamTransactions(
  state: GameState,
  teamId: TeamId,
  dateRange?: TeamTransactionDateRange,
  extraEvents: readonly DomainEvent[] = [],
): TeamTransactionRef[] {
  const merged = new Map<string, DomainEvent>();
  for (const event of state.competition.seasonEventLog) {
    merged.set(event.id, event);
  }
  for (const event of extraEvents) {
    if (!merged.has(event.id)) {
      merged.set(event.id, event);
    }
  }

  const rows: TeamTransactionRef[] = [];
  for (const event of merged.values()) {
    if (!TEAM_TRANSACTION_EVENT_TYPES.includes(event.type)) {
      continue;
    }
    if (!isTransactionRelevantToTeam(event, teamId)) {
      continue;
    }
    const occurredOn = event.occurredOn;
    if (dateRange?.from != null && occurredOn < dateRange.from) {
      continue;
    }
    if (dateRange?.to != null && occurredOn > dateRange.to) {
      continue;
    }
    rows.push({
      event,
      involvedTeamIds: collectInvolvedTeamIds(event),
    });
  }

  rows.sort((a, b) => a.event.occurredOn.localeCompare(b.event.occurredOn));
  return rows;
}
