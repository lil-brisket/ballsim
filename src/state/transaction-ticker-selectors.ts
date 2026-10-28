/**
 * Deadline day and free agency ticker: the league's trades and signings for
 * a short window, as a slim strip for the game shell. Presentation-only.
 */

import { withoutDuplicateSigningEvents } from "@/state/transaction-events";
import { addCalendarDays, calendarDaysBetween } from "@/domain/calendar-date";
import type { PlayerPortraitAssignment } from "@/domain/entities/player-portrait";
import type { DomainEvent } from "@/domain/events";
import { formatMoney } from "@/domain/owner-objective-text";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import { getActivePhaseId } from "@/systems/phase-engine";
import type { GameState } from "@/state/game-state";
import { getActiveOwnerTeamId } from "@/state/owner-context";
import type { TeamBrandingView } from "@/state/team-branding-view";
import {
  TRANSACTION_FILTER_GROUPS,
  buildTransactionRows,
  type TransactionEntityRef,
  type TransactionRowView,
} from "@/state/transaction-hub-selectors";

export type TickerPlayer = {
  playerId: string;
  name: string;
  overall: number | null;
  portrait: PlayerPortraitAssignment | null;
};

export type TickerTeam = {
  teamId: string;
  abbreviation: string;
  branding: TeamBrandingView | null;
};

export type TransactionTickerItem = {
  id: string;
  kind: "trade" | "signing";
  occurredOn: string;
  headline: string;
  teams: TickerTeam[];
  players: TickerPlayer[];
  contractValue: number | null;
  isMyTeam: boolean;
};

export type TransactionTickerView = {
  window: "deadline" | "free_agency";
  title: string;
  status: string;
  /** Your team's moves first, then the rest; each group newest first. */
  items: TransactionTickerItem[];
  /** Deadline window only, once the deadline day has been simulated. */
  summary: { trades: number; biggestMove: string | null } | null;
};

/** Free agency days covered: the strip shows until this many have played. */
const FREE_AGENCY_WINDOW_DAYS = 3;
const MAX_ITEMS = 30;

const TRADE_TYPES: readonly string[] = TRANSACTION_FILTER_GROUPS.trades;

function isTickerMove(event: DomainEvent): boolean {
  if (TRADE_TYPES.includes(event.type)) {
    return true;
  }
  if (
    event.type === "FreeAgentSigned" ||
    event.type === "RfaOfferSheetSigned"
  ) {
    return true;
  }
  return (
    event.type === "ContractSigned" &&
    (event.payload as Record<string, unknown>).reason !== "extension"
  );
}

function toTickerTeam(ref: TransactionEntityRef): TickerTeam {
  return {
    teamId: ref.id,
    abbreviation: ref.abbreviation ?? ref.name,
    branding: ref.branding ?? null,
  };
}

function overallOf(state: GameState, playerId: string): number | null {
  const player = state.world.players[playerId];
  return player
    ? calculatePlayerOverall(player.position, player.attributes)
    : null;
}

function contractYears(state: GameState, event: DomainEvent | undefined) {
  const contractId = (event?.payload as Record<string, unknown> | undefined)
    ?.contractId;
  if (typeof contractId !== "string") {
    return null;
  }
  const contract = state.business.contracts[contractId];
  const years = contract ? Object.keys(contract.salaryByYear).length : 0;
  return years > 0 ? years : null;
}

function tradeHeadline(
  row: TransactionRowView,
  players: Map<string, TickerPlayer>,
): string {
  if (!row.tradeSides) {
    return row.description;
  }
  const parts = row.tradeSides.map((side) => {
    const assets = [
      ...side.players.map((p) => {
        const overall = players.get(p.id)?.overall;
        return overall == null ? p.name : `${p.name} (${overall})`;
      }),
      ...side.assets,
    ];
    return `${side.team.abbreviation ?? side.team.name} get ${
      assets.length > 0 ? assets.join(", ") : "picks"
    }`;
  });
  return parts.join(" / ");
}

function toItem(
  state: GameState,
  row: TransactionRowView,
  eventById: Map<string, DomainEvent>,
): TransactionTickerItem {
  const players: TickerPlayer[] = row.players.map((p) => ({
    playerId: p.id,
    name: p.name,
    overall: overallOf(state, p.id),
    portrait: p.portrait ?? null,
  }));
  const kind: "trade" | "signing" = TRADE_TYPES.includes(row.type)
    ? "trade"
    : "signing";
  let headline: string;
  if (kind === "trade") {
    headline = tradeHeadline(row, new Map(players.map((p) => [p.playerId, p])));
  } else {
    const team = row.teams[0];
    const years = contractYears(state, eventById.get(row.eventIds[0]!));
    const terms = [
      years ? `${years} ${years === 1 ? "yr" : "yrs"}` : null,
      row.contractValue != null ? formatMoney(row.contractValue) : null,
    ].filter(Boolean);
    headline = `${team?.abbreviation ?? team?.name ?? "A team"} sign ${
      players[0]?.name ?? "a player"
    }${terms.length > 0 ? `, ${terms.join(" ")}` : ""}`;
  }
  return {
    id: row.id,
    kind,
    occurredOn: row.occurredOn,
    headline,
    teams: row.teams.map(toTickerTeam),
    players,
    contractValue: row.contractValue,
    isMyTeam: row.isMyTeam,
  };
}

function buildItems(
  state: GameState,
  from: string,
  to: string,
): { items: TransactionTickerItem[]; rows: TransactionRowView[] } {
  const log = state.competition.seasonEventLog;
  const indexById = new Map<string, number>();
  const eventById = new Map<string, DomainEvent>();
  log.forEach((event, index) => {
    indexById.set(event.id, index);
    eventById.set(event.id, event);
  });
  const events = withoutDuplicateSigningEvents(log).filter(
    (event) =>
      event.occurredOn >= from && event.occurredOn <= to && isTickerMove(event),
  );
  const rows = buildTransactionRows(state, events, getActiveOwnerTeamId(state));
  const position = (row: TransactionRowView) =>
    indexById.get(row.eventIds[0]!) ?? 0;
  const sorted = [...rows].sort((a, b) => {
    if (a.isMyTeam !== b.isMyTeam) {
      return a.isMyTeam ? -1 : 1;
    }
    return position(b) - position(a);
  });
  return {
    rows: sorted,
    items: sorted.map((row) => toItem(state, row, eventById)),
  };
}

function deadlineView(state: GameState): TransactionTickerView | null {
  const deadline = state.competition.season.tradeDeadlineDate;
  if (!deadline) {
    return null;
  }
  const today = state.world.calendar.currentDate;
  const isDay = today === deadline;
  if (!isDay && today !== addCalendarDays(deadline, 1)) {
    return null;
  }
  const { items } = buildItems(state, deadline, deadline);
  let summary: TransactionTickerView["summary"] = null;
  if (!isDay) {
    const trades = items.filter((item) => item.kind === "trade");
    let best: TransactionTickerItem | null = null;
    let bestOverall = -1;
    for (const trade of trades) {
      const top = Math.max(-1, ...trade.players.map((p) => p.overall ?? -1));
      if (top > bestOverall) {
        best = trade;
        bestOverall = top;
      }
    }
    summary = { trades: trades.length, biggestMove: best?.headline ?? null };
  }
  return {
    window: "deadline",
    title: "Trade deadline",
    status: isDay ? "Today" : "Deadline passed",
    items: items.slice(0, MAX_ITEMS),
    summary,
  };
}

function freeAgencyView(state: GameState): TransactionTickerView | null {
  if (getActivePhaseId(state) !== "offseason.free_agency") {
    return null;
  }
  const entered =
    state.competition.phase?.enteredDate ??
    state.competition.season.offseasonStageEnteredDate;
  if (!entered) {
    return null;
  }
  const today = state.world.calendar.currentDate;
  const elapsed = calendarDaysBetween(entered, today);
  if (elapsed < 0 || elapsed > FREE_AGENCY_WINDOW_DAYS) {
    return null;
  }
  const { items } = buildItems(state, entered, today);
  return {
    window: "free_agency",
    title: "Free agency",
    // `elapsed` = days already played (the current date is the next one).
    status:
      elapsed === 0 ? "Free agency opens" : `Day ${elapsed} of free agency`,
    items: items.slice(0, MAX_ITEMS),
    summary: null,
  };
}

/** Ticker for the current date, or null outside the deadline / FA windows. */
export function toTransactionTickerView(
  state: GameState,
): TransactionTickerView | null {
  return deadlineView(state) ?? freeAgencyView(state);
}
