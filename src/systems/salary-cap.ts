import {
  getContractSalaryForYear,
  type Contract,
} from "@/domain/entities/contract";
import {
  deadMoneyForSeason,
  prepaidDeadMoneyForSeason,
} from "@/domain/entities/dead-money";
import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { isPlayerDlAssigned } from "@/systems/development-league/franchise-membership";
import { getLeagueSalaryCap } from "@/systems/league-salary-cap";
import { DEFAULT_SALARY_CAP } from "@/systems/salary-cap-config";

/**
 * Team payroll for a season year: player contracts plus dead money owed to
 * released players. Excludes salaries of Development League–assigned players
 * (contract obligation remains; top-league payroll/cap calculation does not
 * include them). Does not read TeamFinances.payroll or staff contracts.
 */
export function getTeamPayroll(
  teamId: TeamId,
  year: number,
  state: GameState,
): number {
  // Trade search calls this hundreds of thousands of times per day against
  // the same immutable state, so memoize on the contracts/players identity.
  let byPlayers = payrollCache.get(state.business.contracts);
  if (byPlayers === undefined) {
    byPlayers = new WeakMap();
    payrollCache.set(state.business.contracts, byPlayers);
  }
  let byDeadMoney = byPlayers.get(state.world.players);
  if (byDeadMoney === undefined) {
    byDeadMoney = new WeakMap();
    byPlayers.set(state.world.players, byDeadMoney);
  }
  const deadMoney = state.business.deadMoney ?? NO_DEAD_MONEY;
  let byTeamYear = byDeadMoney.get(deadMoney);
  if (byTeamYear === undefined) {
    byTeamYear = new Map();
    byDeadMoney.set(deadMoney, byTeamYear);
  }
  const key = `${teamId}:${year}`;
  const cached = byTeamYear.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const payroll = computeTeamPayroll(teamId, year, state);
  byTeamYear.set(key, payroll);
  return payroll;
}

const NO_DEAD_MONEY: GameState["business"]["deadMoney"] = {};

const payrollCache = new WeakMap<
  GameState["business"]["contracts"],
  WeakMap<
    GameState["world"]["players"],
    WeakMap<GameState["business"]["deadMoney"], Map<string, number>>
  >
>();

/**
 * Contracts grouped by team, once per contracts object. Finished contracts
 * stay in the store (past seasons' statements are derived from them), so a
 * long career holds thousands; payroll only needs the team's own.
 */
const contractsByTeamCache = new WeakMap<
  GameState["business"]["contracts"],
  Map<string, Contract[]>
>();

function teamContracts(state: GameState, teamId: TeamId): readonly Contract[] {
  const contracts = state.business.contracts;
  let byTeam = contractsByTeamCache.get(contracts);
  if (byTeam === undefined) {
    byTeam = new Map();
    for (const contract of Object.values(contracts)) {
      const list = byTeam.get(contract.teamId);
      if (list) {
        list.push(contract);
      } else {
        byTeam.set(contract.teamId, [contract]);
      }
    }
    contractsByTeamCache.set(contracts, byTeam);
  }
  return byTeam.get(teamId) ?? [];
}

function computeTeamPayroll(
  teamId: TeamId,
  year: number,
  state: GameState,
): number {
  let payroll = 0;
  for (const contract of teamContracts(state, teamId)) {
    const player = state.world.players[contract.playerId];
    if (player != null && isPlayerDlAssigned(player)) {
      continue;
    }
    const salary = getContractSalaryForYear(contract, year);
    if (salary !== undefined) {
      payroll += salary;
    }
  }
  return payroll + getTeamDeadMoney(teamId, year, state);
}

/** Dead money a team carries against the cap in a season. */
export function getTeamDeadMoney(
  teamId: TeamId,
  year: number,
  state: GameState,
): number {
  return deadMoneyForSeason(state.business.deadMoney?.[teamId], year);
}

/**
 * Dead money for a season whose cash already left (buyouts). Weekly payroll
 * and the cash projection subtract it from {@link getTeamPayroll}.
 */
export function getTeamPrepaidDeadMoney(
  teamId: TeamId,
  year: number,
  state: GameState,
): number {
  return prepaidDeadMoneyForSeason(state.business.deadMoney?.[teamId], year);
}

/**
 * Full contractual salary obligation including DL-assigned players and dead
 * money. Use for franchise books / obligation views — not top-league cap.
 */
export function getTeamContractualSalaryObligation(
  teamId: TeamId,
  year: number,
  state: GameState,
): number {
  let total = 0;
  for (const contract of teamContracts(state, teamId)) {
    const salary = getContractSalaryForYear(contract, year);
    if (salary !== undefined) {
      total += salary;
    }
  }
  return total + getTeamDeadMoney(teamId, year, state);
}

/**
 * First season a player contract signed today covers. The offseason still
 * belongs to the completed year, and contracts ending that year are already
 * finished then, so offseason signings start with the upcoming season.
 */
export function getContractSigningYear(state: GameState): number {
  const season = state.competition.season;
  return season.phase === "offseason" ? season.year + 1 : season.year;
}

/**
 * Cap space = league salaryCap − derived player payroll.
 * Prefer omitting salaryCap to use the league setting automatically.
 */
export function getTeamCapSpace(
  teamId: TeamId,
  year: number,
  state: GameState,
  salaryCap: number = getLeagueSalaryCap(state),
): number {
  return salaryCap - getTeamPayroll(teamId, year, state);
}

export function isTeamOverTheCap(
  teamId: TeamId,
  year: number,
  state: GameState,
  salaryCap: number = getLeagueSalaryCap(state),
): boolean {
  return getTeamAmountOverTheCap(teamId, year, state, salaryCap) > 0;
}

export function getTeamAmountOverTheCap(
  teamId: TeamId,
  year: number,
  state: GameState,
  salaryCap: number = getLeagueSalaryCap(state),
): number {
  return Math.max(0, getTeamPayroll(teamId, year, state) - salaryCap);
}

export { DEFAULT_SALARY_CAP };
