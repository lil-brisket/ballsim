/**
 * Team Hub Recent History — collect → normalize → dedupe → sort → slice.
 * Presentation-neutral; no UI/component imports.
 */

import type { DomainEvent, DomainEventType } from "@/domain/events";
import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import {
  getRecentForm,
  type RecentFormGame,
} from "@/state/recent-form-selectors";
import { describeTeamSeasonEvent } from "@/state/team-management-selectors";
import { getTeamTransactions } from "@/state/team-transaction-selectors";

export const TEAM_RECENT_HISTORY_LIMIT = 5;

export type TeamRecentHistoryKind =
  | "game_result"
  | "transaction"
  | "injury"
  | "award"
  | "other";

export type TeamRecentHistoryItem = {
  id: string;
  occurredOn: string;
  kind: TeamRecentHistoryKind;
  categoryLabel: string;
  title: string;
  description?: string;
  game?: RecentFormGame;
};

const KIND_PRIORITY: Record<TeamRecentHistoryKind, number> = {
  game_result: 0,
  transaction: 1,
  injury: 2,
  award: 3,
  other: 4,
};

const AWARD_EVENT_TYPES: readonly DomainEventType[] = [
  "MidseasonAwardAnnounced",
];

function categoryLabelForTransaction(type: DomainEventType): string {
  switch (type) {
    case "PlayerTraded":
      return "Trade";
    case "FreeAgentSigned":
    case "ContractSigned":
      return "Signing";
    case "PlayerReleased":
      return "Release";
    case "DraftPickMade":
      return "Draft";
    case "CoachHired":
    case "StaffHired":
      return "Hire";
    case "StaffFired":
      return "Fire";
    default:
      return "Transaction";
  }
}

function isInjuryRelevantToTeam(event: DomainEvent, teamId: TeamId): boolean {
  if (event.type !== "PlayerInjured") {
    return false;
  }
  const payload = event.payload as Record<string, unknown>;
  // Prefer explicit team association on the event — never current roster.
  if (typeof payload.teamId === "string" && payload.teamId.length > 0) {
    return payload.teamId === teamId;
  }
  // No reliable team association → skip (do not guess via current roster).
  return false;
}

function isAwardRelevantToTeam(event: DomainEvent, teamId: TeamId): boolean {
  if (!AWARD_EVENT_TYPES.includes(event.type)) {
    return false;
  }
  const payload = event.payload as Record<string, unknown>;
  // Explicit team association only (winnerTeamId or teamId).
  if (
    typeof payload.winnerTeamId === "string" &&
    payload.winnerTeamId.length > 0
  ) {
    return payload.winnerTeamId === teamId;
  }
  if (typeof payload.teamId === "string" && payload.teamId.length > 0) {
    return payload.teamId === teamId;
  }
  // Ambiguous (e.g. AllStarSelectionsAnnounced with only playerIds) → skip.
  return false;
}

function collectGameCandidates(
  state: GameState,
  teamId: TeamId,
): TeamRecentHistoryItem[] {
  const form = getRecentForm(state, teamId);
  return form.games.map((game) => {
    const vs = game.home ? "vs" : "@";
    const result = game.won ? "W" : "L";
    return {
      id: `game:${game.gameId}`,
      occurredOn: game.date,
      kind: "game_result" as const,
      categoryLabel: "Result",
      title: `${result} ${vs} ${game.opponentAbbreviation} ${game.teamScore}–${game.opponentScore}`,
      game,
    };
  });
}

function collectTransactionCandidates(
  state: GameState,
  teamId: TeamId,
): TeamRecentHistoryItem[] {
  return getTeamTransactions(state, teamId).map(({ event }) => ({
    id: event.id,
    occurredOn: event.occurredOn,
    kind: "transaction" as const,
    categoryLabel: categoryLabelForTransaction(event.type),
    title: describeTeamSeasonEvent(state, event),
  }));
}

function collectInjuryCandidates(
  state: GameState,
  teamId: TeamId,
): TeamRecentHistoryItem[] {
  const items: TeamRecentHistoryItem[] = [];
  for (const event of state.competition.seasonEventLog) {
    if (!isInjuryRelevantToTeam(event, teamId)) {
      continue;
    }
    items.push({
      id: event.id,
      occurredOn: event.occurredOn,
      kind: "injury",
      categoryLabel: "Injury",
      title: describeTeamSeasonEvent(state, event),
    });
  }
  return items;
}

function collectAwardCandidates(
  state: GameState,
  teamId: TeamId,
): TeamRecentHistoryItem[] {
  const items: TeamRecentHistoryItem[] = [];
  for (const event of state.competition.seasonEventLog) {
    if (!isAwardRelevantToTeam(event, teamId)) {
      continue;
    }
    const payload = event.payload as Record<string, unknown>;
    const awardId =
      typeof payload.awardId === "string" ? payload.awardId : "Award";
    items.push({
      id: event.id,
      occurredOn: event.occurredOn,
      kind: "award",
      categoryLabel: "Award",
      title: describeTeamSeasonEvent(state, event),
      description: awardId,
    });
  }
  return items;
}

function deduplicate(
  candidates: TeamRecentHistoryItem[],
): TeamRecentHistoryItem[] {
  const byId = new Map<string, TeamRecentHistoryItem>();
  for (const item of candidates) {
    const existing = byId.get(item.id);
    if (existing == null) {
      byId.set(item.id, item);
      continue;
    }
    if (KIND_PRIORITY[item.kind] < KIND_PRIORITY[existing.kind]) {
      byId.set(item.id, item);
    }
  }
  return [...byId.values()];
}

/**
 * Recent franchise timeline for a specific team.
 * Pipeline: collect → normalize → deduplicate → sort → slice(0, 5).
 * Games come exclusively from getRecentForm (never GameCompleted log rows).
 */
export function getTeamRecentHistory(
  state: GameState,
  teamId: TeamId,
): TeamRecentHistoryItem[] {
  const candidates: TeamRecentHistoryItem[] = [
    ...collectGameCandidates(state, teamId),
    ...collectTransactionCandidates(state, teamId),
    ...collectInjuryCandidates(state, teamId),
    ...collectAwardCandidates(state, teamId),
  ];

  const deduped = deduplicate(candidates);
  deduped.sort((a, b) => {
    const byDate = b.occurredOn.localeCompare(a.occurredOn);
    if (byDate !== 0) {
      return byDate;
    }
    return b.id.localeCompare(a.id);
  });
  return deduped.slice(0, TEAM_RECENT_HISTORY_LIMIT);
}
