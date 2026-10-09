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
import { addCalendarDays, parseCalendarDate } from "@/domain/calendar-date";
import {
  toBrandingView,
  type TeamBrandingView,
} from "@/state/team-branding-view";

/** Filter chips — maps to DomainEventType sets (single source). */
export const TRANSACTION_FILTER_GROUPS = {
  all: null,
  trades: ["PlayerTraded", "DraftPickTraded"] as const satisfies readonly DomainEventType[],
  signings: [
    "FreeAgentSigned",
    "ContractSigned",
  ] as const satisfies readonly DomainEventType[],
  releases: ["PlayerReleased"] as const satisfies readonly DomainEventType[],
  waivers: [] as const satisfies readonly DomainEventType[],
  extensions: [] as const satisfies readonly DomainEventType[],
  draft: ["DraftPickMade"] as const satisfies readonly DomainEventType[],
  other: [
    "CoachHired",
    "StaffHired",
    "StaffFired",
  ] as const satisfies readonly DomainEventType[],
} as const;

export type TransactionFilterGroup = keyof typeof TRANSACTION_FILTER_GROUPS;

export type TransactionDateRangeKey =
  "today" | "7d" | "30d" | "season" | "custom";

export type TransactionSortKey =
  "newest" | "oldest" | "team" | "player" | "type" | "contract";

export type TransactionActivityMode = "league" | "myTeam";

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
  /**
   * Sum of salaryByYear for ContractSigned / FreeAgentSigned via payload.contractId.
   * Grouped trades stay null: PlayerTraded has no contractId, and current
   * player.contractId is the live deal, not the trade-time package.
   */
  contractValue: number | null;
  isMyTeam: boolean;
};

export type TransactionHubFilters = {
  group: TransactionFilterGroup;
  teamId: string | null;
  range: TransactionDateRangeKey;
  start?: string;
  end?: string;
  search: string;
  /** Number of rows to show (Load more). */
  limit: number;
  sort: TransactionSortKey;
  activityMode: TransactionActivityMode;
};

export type TransactionHubQueryInput = {
  type?: string;
  team?: string;
  range?: string;
  q?: string;
  limit?: string;
  sort?: string;
  activity?: string;
  start?: string;
  end?: string;
};

export type ParsedTransactionHubQuery = {
  group: TransactionFilterGroup;
  teamParam: string | undefined;
  range: TransactionDateRangeKey;
  search: string;
  limit: number;
  sort: TransactionSortKey;
  activityMode: TransactionActivityMode;
  start?: string;
  end?: string;
};

export type TransactionDateGroup = {
  date: string;
  rows: TransactionRowView[];
};

export type TransactionHubView = {
  saveId: string;
  myTeamId: string;
  currentDate: string;
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
const TRANSACTION_HUB_MAX_LIMIT = 200;

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
    name: player ? `${player.firstName} ${player.lastName}` : playerId,
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

function describeSimple(state: GameState, event: DomainEvent): string {
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
    case "DraftPickTraded": {
      const round = payload.round;
      const year = payload.seasonYear;
      const pickLabel =
        typeof round === "number" && typeof year === "number"
          ? `${year} R${round}`
          : "draft pick";
      return `Trade: ${pickLabel} (${from?.abbreviation ?? "?"} → ${to?.abbreviation ?? "?"})`;
    }
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

function isValidIsoCalendarDate(raw: string): boolean {
  try {
    parseCalendarDate(raw);
    return true;
  } catch {
    return false;
  }
}

export function customDateRangeError(
  start?: string,
  end?: string,
): string | null {
  if (!start || !end) {
    return "Start and end dates are required.";
  }
  if (!isValidIsoCalendarDate(start) || !isValidIsoCalendarDate(end)) {
    return "Dates must be valid calendar days (YYYY-MM-DD).";
  }
  if (start > end) {
    return "Start must be on or before end.";
  }
  return null;
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

function pickAssetLabel(payload: Record<string, unknown>): string {
  const round = payload.round;
  const year = payload.seasonYear;
  if (typeof round === "number" && typeof year === "number") {
    return `${year} R${round}`;
  }
  return "Draft pick";
}

function tradePairKey(event: DomainEvent): string | null {
  if (event.type !== "PlayerTraded" && event.type !== "DraftPickTraded") {
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

function contractValueFromPayload(
  state: GameState,
  payload: Record<string, unknown>,
): number | null {
  const contractId = payload.contractId;
  if (typeof contractId !== "string" || !contractId) {
    return null;
  }
  const contract = state.business.contracts[contractId];
  if (!contract) {
    return null;
  }
  const salaries = Object.values(contract.salaryByYear);
  if (salaries.length === 0) {
    return null;
  }
  return salaries.reduce((sum, salary) => sum + salary, 0);
}

function rowIsMyTeam(
  events: readonly DomainEvent[],
  myTeamId: TeamId,
): boolean {
  return events.some((event) => isTransactionRelevantToTeam(event, myTeamId));
}

/**
 * Group same-day PlayerTraded events between the same two teams into one row.
 */
function buildRows(
  state: GameState,
  events: DomainEvent[],
  myTeamId: TeamId,
): TransactionRowView[] {
  const used = new Set<string>();
  const rows: TransactionRowView[] = [];

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
      const sideAAssets: string[] = [];
      const sideBAssets: string[] = [];
      let hasPlayer = false;
      for (const e of group) {
        const p = e.payload as Record<string, unknown>;
        if (e.type === "DraftPickTraded") {
          const label = pickAssetLabel(p);
          if (String(p.fromTeamId) === teamAId) {
            sideAAssets.push(label);
          } else {
            sideBAssets.push(label);
          }
          continue;
        }
        hasPlayer = true;
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
          assets: sideAAssets,
        });
      }
      if (teamA) {
        tradeSides.push({
          team: teamA,
          players: sideBPlayers,
          assets: sideBAssets,
        });
      }

      const allPlayers = [...sideAPlayers, ...sideBPlayers];
      const teams = [teamA, teamB].filter(Boolean) as TransactionEntityRef[];

      rows.push({
        id: `trade_${key}`,
        type: hasPlayer ? "PlayerTraded" : "DraftPickTraded",
        occurredOn: event.occurredOn,
        description:
          tradeSides.length === 2
            ? `${teamB?.abbreviation ?? "?"} ↔ ${teamA?.abbreviation ?? "?"}`
            : describeSimple(state, event),
        players: allPlayers,
        teams,
        tradeSides: tradeSides.length === 2 ? tradeSides : null,
        eventIds: group.map((e) => e.id),
        contractValue: null,
        isMyTeam: rowIsMyTeam(group, myTeamId),
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
    const uniqueTeams = [...new Map(teams.map((t) => [t.id, t])).values()];

    rows.push({
      id: event.id,
      type: event.type,
      occurredOn: event.occurredOn,
      description: describeSimple(state, event),
      players,
      teams: uniqueTeams,
      tradeSides: null,
      eventIds: [event.id],
      contractValue: contractValueFromPayload(state, payload),
      isMyTeam: rowIsMyTeam([event], myTeamId),
    });
  }

  return rows;
}

function compareNewestThenId(
  a: TransactionRowView,
  b: TransactionRowView,
): number {
  const byDate = b.occurredOn.localeCompare(a.occurredOn);
  if (byDate !== 0) {
    return byDate;
  }
  return b.id.localeCompare(a.id);
}

function sortRows(
  rows: TransactionRowView[],
  sort: TransactionSortKey,
): TransactionRowView[] {
  const sorted = [...rows];
  sorted.sort((a, b) => {
    switch (sort) {
      case "oldest": {
        const byDate = a.occurredOn.localeCompare(b.occurredOn);
        if (byDate !== 0) {
          return byDate;
        }
        return a.id.localeCompare(b.id);
      }
      case "team": {
        const byTeam = (a.teams[0]?.name ?? "").localeCompare(
          b.teams[0]?.name ?? "",
        );
        if (byTeam !== 0) {
          return byTeam;
        }
        return compareNewestThenId(a, b);
      }
      case "player": {
        const byPlayer = (a.players[0]?.name ?? "").localeCompare(
          b.players[0]?.name ?? "",
        );
        if (byPlayer !== 0) {
          return byPlayer;
        }
        return compareNewestThenId(a, b);
      }
      case "type": {
        const byType = transactionTypeLabel(a.type).localeCompare(
          transactionTypeLabel(b.type),
        );
        if (byType !== 0) {
          return byType;
        }
        return compareNewestThenId(a, b);
      }
      case "contract": {
        const aValue = a.contractValue ?? Number.NEGATIVE_INFINITY;
        const bValue = b.contractValue ?? Number.NEGATIVE_INFINITY;
        if (bValue !== aValue) {
          return bValue - aValue;
        }
        return compareNewestThenId(a, b);
      }
      default: {
        return compareNewestThenId(a, b);
      }
    }
  });
  return sorted;
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
  if (
    raw === "today" ||
    raw === "7d" ||
    raw === "30d" ||
    raw === "season" ||
    raw === "custom"
  ) {
    return raw;
  }
  return "season";
}

export function parseTransactionSortKey(
  raw: string | undefined,
): TransactionSortKey {
  if (
    raw === "newest" ||
    raw === "oldest" ||
    raw === "team" ||
    raw === "player" ||
    raw === "type" ||
    raw === "contract"
  ) {
    return raw;
  }
  return "newest";
}

export function parseActivityMode(
  raw: string | undefined,
): TransactionActivityMode {
  if (raw === "league" || raw === "myTeam") {
    return raw;
  }
  return "league";
}

function parseLimit(raw: string | undefined): number {
  const limitRaw = Number(raw ?? TRANSACTION_HUB_PAGE_SIZE);
  if (Number.isFinite(limitRaw) && limitRaw > 0) {
    return Math.min(limitRaw, TRANSACTION_HUB_MAX_LIMIT);
  }
  return TRANSACTION_HUB_PAGE_SIZE;
}

export function parseTransactionHubQuery(
  raw: TransactionHubQueryInput,
): ParsedTransactionHubQuery {
  const start = typeof raw.start === "string" ? raw.start : undefined;
  const end = typeof raw.end === "string" ? raw.end : undefined;
  return {
    group: parseTransactionFilterGroup(raw.type),
    teamParam: typeof raw.team === "string" ? raw.team : undefined,
    range: parseTransactionDateRange(raw.range),
    search: typeof raw.q === "string" ? raw.q : "",
    limit: parseLimit(raw.limit),
    sort: parseTransactionSortKey(raw.sort),
    activityMode: parseActivityMode(raw.activity),
    start,
    end,
  };
}

export function toTransactionHubSearchParams(input: {
  group: TransactionFilterGroup;
  teamParam?: string;
  range: TransactionDateRangeKey;
  start?: string;
  end?: string;
  sort: TransactionSortKey;
  activityMode: TransactionActivityMode;
  search: string;
  limit?: number;
}): URLSearchParams {
  const params = new URLSearchParams();
  if (input.group !== "all") {
    params.set("type", input.group);
  }
  if (input.teamParam && input.teamParam !== "all") {
    params.set("team", input.teamParam);
  }
  if (input.range !== "season") {
    params.set("range", input.range);
  }
  if (input.range === "custom") {
    if (input.start) {
      params.set("start", input.start);
    }
    if (input.end) {
      params.set("end", input.end);
    }
  }
  if (input.sort !== "newest") {
    params.set("sort", input.sort);
  }
  if (input.activityMode !== "league") {
    params.set("activity", input.activityMode);
  }
  if (input.search) {
    params.set("q", input.search);
  }
  if (input.limit != null && input.limit > TRANSACTION_HUB_PAGE_SIZE) {
    params.set("limit", String(input.limit));
  }
  return params;
}

export function toTransactionHubView(
  state: GameState,
  filters: TransactionHubFilters,
): TransactionHubView {
  const myTeamId = getActiveOwnerTeamId(state);

  let events = [...state.competition.seasonEventLog].filter((event) =>
    eventMatchesGroup(event.type, filters.group),
  );

  if (filters.range === "custom") {
    if (customDateRangeError(filters.start, filters.end)) {
      events = [];
    } else {
      const start = filters.start!;
      const end = filters.end!;
      events = events.filter(
        (event) => event.occurredOn >= start && event.occurredOn <= end,
      );
    }
  } else {
    const bounds = dateRangeBounds(state, filters.range);
    if (bounds.from) {
      events = events.filter((e) => e.occurredOn >= bounds.from!);
    }
    if (bounds.to) {
      events = events.filter((e) => e.occurredOn <= bounds.to!);
    }
  }

  if (filters.teamId) {
    const teamId = filters.teamId as TeamId;
    events = events.filter((e) => isTransactionRelevantToTeam(e, teamId));
  }

  let rows = buildRows(state, events, myTeamId);

  if (filters.activityMode === "myTeam") {
    rows = rows.filter((row) => row.isMyTeam);
  }

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

  rows = sortRows(rows, filters.sort);

  const total = rows.length;
  const shownRows = rows.slice(0, filters.limit);
  const byDate = new Map<string, TransactionRowView[]>();
  for (const row of shownRows) {
    const list = byDate.get(row.occurredOn) ?? [];
    list.push(row);
    byDate.set(row.occurredOn, list);
  }
  const groups: TransactionDateGroup[] = [...byDate.entries()]
    .sort((a, b) =>
      filters.sort === "oldest"
        ? a[0].localeCompare(b[0])
        : b[0].localeCompare(a[0]),
    )
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
    currentDate: state.world.calendar.currentDate,
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
    case "DraftPickTraded":
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
