/**
 * Cap sheet view: the owner team's payroll by season (this season plus up to
 * four more), with the cap / tax line / floor markers. Presentation only;
 * totals come from getTeamPayroll so they always match the rest of the game.
 */

import type { DeadMoneyEntry } from "@/domain/entities/dead-money";
import type { GameState } from "@/state/game-state";
import { getActiveOwnerTeamId } from "@/state/owner-context";
import { isPlayerDlAssigned } from "@/systems/development-league/franchise-membership";
import { getLeagueSalaryCap } from "@/systems/league-salary-cap";
import { luxuryTaxThreshold, salaryFloor } from "@/systems/payroll-rules";
import { getContractSigningYear, getTeamPayroll } from "@/systems/salary-cap";

export type CapSheetCell =
  | { kind: "salary"; amount: number }
  | { kind: "option"; option: "team" | "player"; amount: number }
  | { kind: "dead"; amount: number }
  | { kind: "empty" };

export type CapSheetRow = {
  key: string;
  playerId: string;
  name: string;
  position: string | null;
  kind: "player" | "dead_money" | "development_league";
  /** Dead money reason label, or "Development league" for DL rows. */
  note: string | null;
  /** One per season in `seasons`. */
  cells: CapSheetCell[];
};

export type CapSheetLine = {
  key: "floor" | "cap" | "tax";
  label: string;
  amount: number;
  /** payroll − amount; negative means room. */
  delta: number;
};

export type CapSheetView = {
  teamId: string;
  /** Planning year plus up to four more. */
  seasons: number[];
  payroll: number;
  lines: CapSheetLine[];
  rows: CapSheetRow[];
  totals: Array<{
    season: number;
    payroll: number;
    cap: number | null;
    room: number | null;
  }>;
};

const SEASON_COUNT = 5;

const DEAD_LABELS: Record<DeadMoneyEntry["reason"], string> = {
  waived: "Waived",
  bought_out: "Bought out",
  buyout_paid: "Buyout (prepaid)",
};

const EMPTY: CapSheetCell = { kind: "empty" };

function firstAmount(row: CapSheetRow): number {
  const cell = row.cells[0];
  return cell && (cell.kind === "salary" || cell.kind === "dead")
    ? cell.amount
    : 0;
}

export function toCapSheetView(
  state: GameState,
  teamId?: string,
): CapSheetView {
  const id = teamId ?? getActiveOwnerTeamId(state);
  const first = getContractSigningYear(state);
  const seasons = Array.from({ length: SEASON_COUNT }, (_, i) => first + i);
  const rules = state.settings.financialRules;
  const cap = getLeagueSalaryCap(state);
  const payrollOf = (season: number) =>
    getTeamPayroll(id as never, season, state);
  const payroll = payrollOf(first);

  const lines: CapSheetLine[] = [];
  if (rules.salaryFloorEnabled) {
    const amount = salaryFloor(state.settings, cap);
    lines.push({
      key: "floor",
      label: "Floor",
      amount,
      delta: payroll - amount,
    });
  }
  if (rules.salaryCapEnabled) {
    lines.push({ key: "cap", label: "Cap", amount: cap, delta: payroll - cap });
  }
  if (rules.luxuryTaxEnabled) {
    const amount = luxuryTaxThreshold(state.settings, cap);
    lines.push({
      key: "tax",
      label: "Tax line",
      amount,
      delta: payroll - amount,
    });
  }

  const playerRows: CapSheetRow[] = [];
  const dlRows: CapSheetRow[] = [];
  for (const contract of Object.values(state.business.contracts)) {
    if (contract.teamId !== id) continue;
    const player = state.world.players[contract.playerId];
    const dl = player != null && isPlayerDlAssigned(player);
    let any = false;
    const cells = seasons.map((season): CapSheetCell => {
      const salary = contract.salaryByYear[String(season)];
      if (salary !== undefined) {
        any = true;
        return { kind: "salary", amount: salary };
      }
      for (const [which, option] of [
        ["team", contract.teamOption],
        ["player", contract.playerOption],
      ] as const) {
        if (option?.status === "pending" && option.year === season) {
          any = true;
          return { kind: "option", option: which, amount: option.salary };
        }
      }
      return EMPTY;
    });
    if (!any) continue;
    const row: CapSheetRow = {
      key: `contract:${contract.id}`,
      playerId: String(contract.playerId),
      name: player
        ? `${player.firstName} ${player.lastName}`
        : "Unknown player",
      position: player ? String(player.position) : null,
      kind: dl ? "development_league" : "player",
      note: dl ? "Development league" : null,
      cells,
    };
    (dl ? dlRows : playerRows).push(row);
  }
  const byName = (a: CapSheetRow, b: CapSheetRow) =>
    a.name.localeCompare(b.name) || a.key.localeCompare(b.key);
  playerRows.sort((a, b) => firstAmount(b) - firstAmount(a) || byName(a, b));
  dlRows.sort(byName);

  const deadByKey = new Map<string, CapSheetRow>();
  for (const entry of state.business.deadMoney?.[id] ?? []) {
    const index = seasons.indexOf(entry.seasonYear);
    if (index < 0) continue;
    const key = `dead:${entry.playerId}:${entry.reason}`;
    let row = deadByKey.get(key);
    if (!row) {
      const player = state.world.players[entry.playerId];
      row = {
        key,
        playerId: String(entry.playerId),
        name: player
          ? `${player.firstName} ${player.lastName}`
          : "Former player",
        position: player ? String(player.position) : null,
        kind: "dead_money",
        note: DEAD_LABELS[entry.reason],
        cells: seasons.map(() => EMPTY),
      };
      deadByKey.set(key, row);
    }
    const existing = row.cells[index];
    const prior = existing?.kind === "dead" ? existing.amount : 0;
    row.cells[index] = { kind: "dead", amount: prior + entry.amount };
  }
  const deadRows = [...deadByKey.values()].sort(
    (a, b) => firstAmount(b) - firstAmount(a) || byName(a, b),
  );

  return {
    teamId: id,
    seasons,
    payroll,
    lines,
    rows: [...playerRows, ...dlRows, ...deadRows],
    totals: seasons.map((season) => {
      const total = payrollOf(season);
      return {
        season,
        payroll: total,
        cap: rules.salaryCapEnabled ? cap : null,
        room: rules.salaryCapEnabled ? cap - total : null,
      };
    }),
  };
}
