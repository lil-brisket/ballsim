/**
 * Contract Management Hub presentation — single-pass view model.
 * Presentation-only; never mutates simulation state.
 * Composes existing contract/payroll selectors — does not recreate domain math.
 */

import type { GameState } from "@/state/game-state";
import type { ActionCenterItem } from "@/state/action-center-selectors";
import {
  buildActionCenterView,
  filterDomainDecisions,
} from "@/state/action-center-selectors";
import { toOwnerDashboardView } from "@/state/owner-dashboard";
import { getActiveOwnerTeamId } from "@/state/owner-context";
import {
  toContractsView,
  toFinancesView,
  type ContractRowView,
} from "@/state/selectors";
import {
  toPlayerContractProfileView,
  type PlayerContractProfileView,
} from "@/state/player-profile-selectors";
import {
  getContractStatus,
  type ContractStatus,
} from "@/domain/entities/contract";

export type ContractAvailableAction =
  | "exercise_team_option"
  | "decline_team_option"
  | "none";

/** Presentation state — separate from availableAction. */
export type ContractPresentationState =
  | "active"
  | "expiring"
  | "option_pending"
  | "expired"
  | "team_option"
  | "player_option";

export type ContractHubRow = ContractRowView & {
  age: number | null;
  expirationYear: number;
  contractState: ContractPresentationState;
  optionLabel: string;
  availableAction: ContractAvailableAction;
  isExpiring: boolean;
  isLargeCommitment: boolean;
};

export type ContractHubOverview = {
  playerCount: number;
  totalPayroll: number;
  expiringCount: number;
  pendingOptionCount: number;
  largestContracts: Array<{
    playerId: string;
    playerName: string;
    salary: number;
  }>;
};

export type ContractHubView = {
  saveId: string;
  teamId: string;
  teamName: string;
  currentDate: string;
  seasonYear: number;
  salaryCap: number;
  salaryCapEnabled: boolean;
  playerPayroll: number;
  capSpace: number;
  overview: ContractHubOverview;
  rows: ContractHubRow[];
  decisions: ActionCenterItem[];
};

function presentationState(
  status: ContractStatus,
  isExpiring: boolean,
  hasPendingOption: boolean,
): ContractPresentationState {
  if (hasPendingOption) return "option_pending";
  if (status === "expired") return "expired";
  if (status === "team_option") return "team_option";
  if (status === "player_option") return "player_option";
  if (isExpiring) return "expiring";
  return "active";
}

function optionLabel(row: ContractRowView): string {
  if (row.hasPendingTeamOption) return "Team option pending";
  if (row.hasPendingPlayerOption) return "Player option pending";
  return "—";
}

function availableAction(row: ContractRowView): ContractAvailableAction {
  // Only team options have owner actions today.
  if (row.hasPendingTeamOption) return "exercise_team_option";
  return "none";
}

/**
 * Deterministic contract table sort:
 * actionable decisions → expiring → salary descending → player name
 */
export function sortContractHubRows(rows: ContractHubRow[]): ContractHubRow[] {
  return [...rows].sort((a, b) => {
    const aAction = a.availableAction !== "none" ? 0 : 1;
    const bAction = b.availableAction !== "none" ? 0 : 1;
    if (aAction !== bAction) return aAction - bAction;
    const aExp = a.isExpiring ? 0 : 1;
    const bExp = b.isExpiring ? 0 : 1;
    if (aExp !== bExp) return aExp - bExp;
    const sal = (b.salary ?? 0) - (a.salary ?? 0);
    if (sal !== 0) return sal;
    return a.playerName.localeCompare(b.playerName);
  });
}

export function getContractDetailProfile(
  state: GameState,
  playerId: string,
): PlayerContractProfileView | null {
  return toPlayerContractProfileView(state, playerId as never);
}

export function toContractHubView(state: GameState): ContractHubView {
  const saveId = state.meta.saveId;
  const teamId = getActiveOwnerTeamId(state);
  const team = state.world.teams[teamId];
  const year = state.competition.season.year;
  const finances = toFinancesView(state);
  const baseRows = toContractsView(state);
  const owner = toOwnerDashboardView(state);

  const salaries = baseRows
    .map((r) => r.salary ?? 0)
    .filter((s) => s > 0)
    .sort((a, b) => b - a);
  const largeThreshold =
    salaries.length > 0 ? salaries[Math.min(2, salaries.length - 1)]! : 0;

  const enriched: ContractHubRow[] = baseRows.map((row) => {
    const player = state.world.players[row.playerId];
    const contract = state.business.contracts[row.contractId];
    const status = contract
      ? getContractStatus(contract, year)
      : (row.status as ContractStatus);
    const isExpiring =
      status === "active" && row.endYear <= year + 1;
    const hasPending =
      row.hasPendingTeamOption || row.hasPendingPlayerOption;
    const action = availableAction(row);

    return {
      ...row,
      age: player?.age ?? null,
      expirationYear: row.endYear,
      contractState: presentationState(status, isExpiring, hasPending),
      optionLabel: optionLabel(row),
      // Exercise/decline both available when team option pending —
      // Action column surfaces both forms; availableAction flags actionable.
      availableAction: action,
      isExpiring,
      isLargeCommitment:
        row.salary !== null &&
        largeThreshold > 0 &&
        row.salary >= largeThreshold,
    };
  });

  const rows = sortContractHubRows(enriched);
  const pendingOptionCount = rows.filter(
    (r) => r.hasPendingTeamOption || r.hasPendingPlayerOption,
  ).length;
  const expiringCount = rows.filter((r) => r.isExpiring).length;

  const largestContracts = [...rows]
    .filter((r) => r.salary !== null && r.salary > 0)
    .sort((a, b) => (b.salary ?? 0) - (a.salary ?? 0))
    .slice(0, 3)
    .map((r) => ({
      playerId: r.playerId,
      playerName: r.playerName,
      salary: r.salary!,
    }));

  const actionCenter = buildActionCenterView({
    actionItems: owner.actionItems,
    phaseResponsibility: owner.phaseResponsibility,
    currentDate: owner.currentDate,
    saveId: owner.saveId,
    daysUntilTradeDeadline: owner.daysUntilTradeDeadline,
  });

  // Augment with per-contract pending team option decisions when not already covered.
  const decisionItems = [...actionCenter.items];
  for (const row of rows) {
    if (!row.hasPendingTeamOption) continue;
    const id = `contract_option_${row.contractId}`;
    if (decisionItems.some((d) => d.id === id || d.id === "action_contracts")) {
      // Keep global expiring item; still add player-specific option if unique.
    }
    if (!decisionItems.some((d) => d.id === id)) {
      decisionItems.push({
        id,
        priority: 30,
        severity: "warning",
        category: "contracts",
        urgency: "soon",
        deadline: null,
        relevance: "team",
        title: "Exercise team option",
        description: `Pending team option for ${row.playerName}.`,
        entity: {
          kind: "player",
          id: row.playerId,
          label: row.playerName,
        },
        href: `/dashboard/${saveId}/contracts`,
        hrefLabel: "Review",
      });
    }
  }

  const decisions = filterDomainDecisions(
    decisionItems,
    ["contracts", "team", "calendar"],
    8,
  );

  return {
    saveId,
    teamId,
    teamName: team ? `${team.city} ${team.name}` : "Team",
    currentDate: owner.currentDate,
    seasonYear: year,
    salaryCap: finances.salaryCap,
    salaryCapEnabled: finances.salaryCapEnabled,
    playerPayroll: finances.playerPayroll,
    capSpace: finances.capSpace,
    overview: {
      playerCount: rows.length,
      totalPayroll: finances.playerPayroll,
      expiringCount,
      pendingOptionCount,
      largestContracts,
    },
    rows,
    decisions,
  };
}
