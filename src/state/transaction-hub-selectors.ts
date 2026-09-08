/**
 * Transactions Hub — factual ledger over seasonEventLog.
 * Presentation-only; badges driven by DomainEventType.
 */

import type { DomainEvent, DomainEventType } from "@/domain/events";
import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { getActiveOwnerTeamId } from "@/state/owner-context";
import {
  TEAM_TRANSACTION_EVENT_TYPES,
  isTransactionRelevantToTeam,
} from "@/state/team-transaction-selectors";
import { addCalendarDays } from "@/domain/calendar-date";
import {
  toBrandingView,
  type TeamBrandingView,
} from "@/state/team-branding-view";

/** Filter chips — maps to DomainEventType sets (single source). */
export const TRANSACTION_FILTER_GROUPS = {
  all: null,
  trades: ["PlayerTraded"] as const satisfies readonly DomainEventType[],
  signings: [
    "FreeAgentSigned",
    "ContractSigned",
  ] as const satisfies readonly DomainEventType[],
  releases: ["PlayerReleased"] as const satisfies readonly DomainEventType[],
  other: [
    "DraftPickMade",
    "CoachHired",
    "StaffHired",
    "StaffFired",
  ] as const satisfies readonly DomainEventType[],
} as const;

export type TransactionFilterGroup = keyof typeof TRANSACTION_FILTER_GROUPS;

export type TransactionDateRangeKey =
  | "today"
  | "7d"
  | "30d"
  | "season";

export type TransactionEntityRef = {
  id: string;
  name: string;
  abbreviation?: string;
  branding?: TeamBrandingView | null;
};

export type TradeSideView = {
  team: TransactionEntityRef;
  players: TransactionEntityRef[];
  assets: string[];
};

export type TransactionRowView = {
  id: string;
  /** Primary DomainEventType for badge (or PlayerTraded for grouped). */
  type: DomainEventType;
  occurredOn: string;
  description: string;
  players: TransactionEntityRef[];
  teams: TransactionEntityRef[];
  /** Two-sided layout when trade grouping succeeds. */
  tradeSides: TradeSideView[] | null;
  eventIds: string[];
};

export type TransactionHubFilters = {
  group: TransactionFilterGroup;
  teamId: string | null;
  range: TransactionDateRangeKey;
  search: string;
  /** Number of rows to show (Load more). */
  limit: number;
};

export type TransactionDateGroup = {
  date: string;
  rows: TransactionRowView[];
};

export type TransactionHubView = {
  saveId: string;
  myTeamId: string;
  groups: TransactionDateGroup[];
  total: number;
  shown: number;
  hasMore: boolean;
  teams: Array<{
    teamId: string;
    label: string;
    abbreviation: string;
  }>;
};

export const TRANSACTION_HUB_PAGE_SIZE = 25;

function resolvePlayer(
  state: GameState,
  playerId: unknown,
): TransactionEntityRef | null {
  if (typeof playerId !== "string" || !playerId) {
    return null;
  }
  const player = state.world.players[playerId];
  return {
    id: playerId,
    name: player
      ? `${player.firstName} ${player.lastName}`
      : playerId,
  };
}

function resolveTeam(
  state: GameState,
  teamId: unknown,
): TransactionEntityRef | null {
  if (typeof teamId !== "string" || !teamId) {
    return null;
  }
  const team = state.world.teams[teamId];
  if (!team) {
    return { id: teamId, name: teamId };
  }
  return {
    id: teamId,
    name: `${team.city} ${team.name}`,
    abbreviation: team.abbreviation,
    branding: toBrandingView(team.branding),
  };
}

function describeSimple(
  state: GameState,
  event: DomainEvent,
): string {
  const payload = event.payload as Record<string, unknown>;
  const player = resolvePlayer(state, payload.playerId);
  const team = resolveTeam(state, payload.teamId);
  const from = resolveTeam(state, payload.fromTeamId);
  const to = resolveTeam(state, payload.toTeamId);
  switch (event.type) {
    case "FreeAgentSigned":
    case "ContractSigned":
      return `Signed ${player?.name ?? "player"}${team ? ` — ${team.name}` : ""}`;
    case "PlayerTraded":
      return `Trade: ${player?.name ?? "player"} (${from?.abbreviation ?? "?"} → ${to?.abbreviation ?? "?"})`;
    case "PlayerReleased":
      return `Released ${player?.name ?? "player"}${team ? ` — ${team.name}` : ""}`;
    case "DraftPickMade":
      return `Drafted ${player?.name ?? "player"}${team ? ` — ${team.name}` : ""}`;
    case "CoachHired":
    case "StaffHired":
      return `Hired staff${team ? ` — ${team.name}` : ""}`;
    case "StaffFired":
      return `Fired staff${team ? ` — ${team.name}` : ""}`;
    default:
      return event.type;
  }
}

function dateRangeBounds(
  state: GameState,
  range: TransactionDateRangeKey,
): { from?: string; to?: string } {
  const today = state.world.calendar.currentDate;
  if (range === "today") {
    return { from: today, to: today };
  }
  if (range === "7d") {
    return { from: addCalendarDays(today, -6), to: today };
  }
  if (range === "30d") {
    return { from: addCalendarDays(today, -29), to: today };
  }
  return {};
}

function eventMatchesGroup(
  type: DomainEventType,
  group: TransactionFilterGroup,
): boolean {
  const types = TRANSACTION_FILTER_GROUPS[group];
  if (types == null) {
    return TEAM_TRANSACTION_EVENT_TYPES.includes(type);
  }
  return (types as readonly DomainEventType[]).includes(type);
}

function tradePairKey(event: DomainEvent): string | null {
  if (event.type !== "PlayerTraded") {
    return null;
  }
  const payload = event.payload as Record<string, unknown>;
  const from = String(payload.fromTeamId ?? "");
  const to = String(payload.toTeamId ?? "");
  if (!from || !to) {
    return null;
  }
  const pair = [from, to].sort().join("|");
  return `${event.occurredOn}|${pair}`;
}

/**
 * Group same-day PlayerTraded events between the same two teams into one row.
 */
function buildRows(state: GameState, events: DomainEvent[]): TransactionRowView[] {
  const used = new Set<string>();
  const rows: TransactionRowView[] = [];

  // Index trade groups
  const tradeGroups = new Map<string, DomainEvent[]>();
  for (const event of events) {
    const key = tradePairKey(event);
    if (!key) {
      continue;
    }
    const list = tradeGroups.get(key) ?? [];
    list.push(event);
    tradeGroups.set(key, list);
  }

  for (const event of events) {
    if (used.has(event.id)) {
      continue;
    }

    const key = tradePairKey(event);
    if (key && (tradeGroups.get(key)?.length ?? 0) >= 1) {
      const group = tradeGroups.get(key)!;
      for (const e of group) {
        used.add(e.id);
      }

      const payload0 = group[0]!.payload as Record<string, unknown>;
      const teamAId = String(payload0.fromTeamId ?? "");
      const teamBId = String(payload0.toTeamId ?? "");
      const teamA = resolveTeam(state, teamAId);
      const teamB = resolveTeam(state, teamBId);

      const sideAPlayers: TransactionEntityRef[] = [];
      const sideBPlayers: TransactionEntityRef[] = [];
      for (const e of group) {
        const p = e.payload as Record<string, unknown>;
        const player = resolvePlayer(state, p.playerId);
        if (!player) {
          continue;
        }
        if (String(p.fromTeamId) === teamAId) {
          sideAPlayers.push(player);
        } else {
          sideBPlayers.push(player);
        }
      }

      const tradeSides: TradeSideView[] = [];
      if (teamB) {
        tradeSides.push({
          team: teamB,
          players: sideAPlayers,
          assets: [],
        });
      }
      if (teamA) {
        tradeSides.push({
          team: teamA,
          players: sideBPlayers,
          assets: [],
        });
      }

      const allPlayers = [...sideAPlayers, ...sideBPlayers];
      const teams = [teamA, teamB].filter(Boolean) as TransactionEntityRef[];

      rows.push({
        id: `trade_${key}`,
        type: "PlayerTraded",
        occurredOn: event.occurredOn,
        description:
          tradeSides.length === 2
            ? `${teamB?.abbreviation ?? "?"} ↔ ${teamA?.abbreviation ?? "?"}`
            : describeSimple(state, event),
        players: allPlayers,
        teams,
        tradeSides: tradeSides.length === 2 ? tradeSides : null,
        eventIds: group.map((e) => e.id),
      });
      continue;
    }

    used.add(event.id);
    const payload = event.payload as Record<string, unknown>;
    const players = [resolvePlayer(state, payload.playerId)].filter(
      Boolean,
    ) as TransactionEntityRef[];
    const teams = [
      resolveTeam(state, payload.teamId),
      resolveTeam(state, payload.fromTeamId),
      resolveTeam(state, payload.toTeamId),
    ].filter(Boolean) as TransactionEntityRef[];
    const uniqueTeams = [
      ...new Map(teams.map((t) => [t.id, t])).values(),
    ];

    rows.push({
      id: event.id,
      type: event.type,
      occurredOn: event.occurredOn,
      description: describeSimple(state, event),
      players,
      teams: uniqueTeams,
      tradeSides: null,
      eventIds: [event.id],
    });
  }

  rows.sort((a, b) => {
    const d = b.occurredOn.localeCompare(a.occurredOn);
    if (d !== 0) {
      return d;
    }
    return b.id.localeCompare(a.id);
  });

  return rows;
}

export function parseTransactionFilterGroup(
  raw: string | undefined,
): TransactionFilterGroup {
  if (raw && raw in TRANSACTION_FILTER_GROUPS) {
    return raw as TransactionFilterGroup;
  }
  return "all";
}

export function parseTransactionDateRange(
  raw: string | undefined,
): TransactionDateRangeKey {
  if (raw === "today" || raw === "7d" || raw === "30d" || raw === "season") {
    return raw;
  }
  return "season";
}

export function toTransactionHubView(
  state: GameState,
  filters: TransactionHubFilters,
): TransactionHubView {
  const myTeamId = getActiveOwnerTeamId(state);
  const bounds = dateRangeBounds(state, filters.range);

  let events = [...state.competition.seasonEventLog].filter((event) =>
    eventMatchesGroup(event.type, filters.group),
  );

  if (bounds.from) {
    events = events.filter((e) => e.occurredOn >= bounds.from!);
  }
  if (bounds.to) {
    events = events.filter((e) => e.occurredOn <= bounds.to!);
  }

  if (filters.teamId) {
    const teamId = filters.teamId as TeamId;
    events = events.filter((e) => isTransactionRelevantToTeam(e, teamId));
  }

  events.sort((a, b) => {
    const d = b.occurredOn.localeCompare(a.occurredOn);
    if (d !== 0) {
      return d;
    }
    return b.id.localeCompare(a.id);
  });

  let rows = buildRows(state, events);

  const search = filters.search.trim().toLowerCase();
  if (search) {
    rows = rows.filter((row) => {
      if (row.description.toLowerCase().includes(search)) {
        return true;
      }
      return (
        row.players.some((p) => p.name.toLowerCase().includes(search)) ||
        row.teams.some(
          (t) =>
            t.name.toLowerCase().includes(search) ||
            (t.abbreviation?.toLowerCase().includes(search) ?? false),
        )
      );
    });
  }

  const total = rows.length;
  const shownRows = rows.slice(0, filters.limit);
  const byDate = new Map<string, TransactionRowView[]>();
  for (const row of shownRows) {
    const list = byDate.get(row.occurredOn) ?? [];
    list.push(row);
    byDate.set(row.occurredOn, list);
  }
  const groups: TransactionDateGroup[] = [...byDate.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, dateRows]) => ({ date, rows: dateRows }));

  const teams = Object.values(state.world.teams)
    .map((t) => ({
      teamId: t.id,
      label: `${t.city} ${t.name}`,
      abbreviation: t.abbreviation,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return {
    saveId: state.meta.saveId,
    myTeamId,
    groups,
    total,
    shown: shownRows.length,
    hasMore: shownRows.length < total,
    teams,
  };
}

/** Human label for DomainEventType badge. */
export function transactionTypeLabel(type: DomainEventType): string {
  switch (type) {
    case "PlayerTraded":
      return "Trade";
    case "FreeAgentSigned":
      return "Signing";
    case "ContractSigned":
      return "Contract";
    case "PlayerReleased":
      return "Release";
    case "DraftPickMade":
      return "Draft";
    case "CoachHired":
      return "Coach Hire";
    case "StaffHired":
      return "Staff Hire";
    case "StaffFired":
      return "Staff Fire";
    default:
      return type;
  }
}
