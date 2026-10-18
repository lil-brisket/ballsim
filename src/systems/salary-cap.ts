import { getContractSalaryForYear } from "@/domain/entities/contract";
import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { isPlayerDlAssigned } from "@/systems/development-league/franchise-membership";
import { getLeagueSalaryCap } from "@/systems/league-salary-cap";
import { DEFAULT_SALARY_CAP } from "@/systems/salary-cap-config";

/**
 * Team payroll for a season year, derived only from player contracts.
 * Excludes salaries of Development League–assigned players (contract obligation
 * remains; top-league payroll/cap calculation does not include them).
 * Does not read TeamFinances.payroll or staff contracts.
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
  let byTeamYear = byPlayers.get(state.world.players);
  if (byTeamYear === undefined) {
    byTeamYear = new Map();
    byPlayers.set(state.world.players, byTeamYear);
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

const payrollCache = new WeakMap<
  GameState["business"]["contracts"],
  WeakMap<GameState["world"]["players"], Map<string, number>>
>();

function computeTeamPayroll(
  teamId: TeamId,
  year: number,
  state: GameState,
): number {
  let payroll = 0;
  for (const contract of Object.values(state.business.contracts)) {
    if (contract.teamId !== teamId) {
      continue;
    }
    const player = state.world.players[contract.playerId];
    if (player != null && isPlayerDlAssigned(player)) {
      continue;
    }
    const salary = getContractSalaryForYear(contract, year);
    if (salary !== undefined) {
      payroll += salary;
    }
  }
  return payroll;
}

/**
 * Full contractual salary obligation including DL-assigned players.
 * Use for franchise books / obligation views — not top-league cap.
 */
export function getTeamContractualSalaryObligation(
  teamId: TeamId,
  year: number,
  state: GameState,
): number {
  let total = 0;
  for (const contract of Object.values(state.business.contracts)) {
    if (contract.teamId !== teamId) {
      continue;
    }
    const salary = getContractSalaryForYear(contract, year);
    if (salary !== undefined) {
      total += salary;
    }
  }
  return total;
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
