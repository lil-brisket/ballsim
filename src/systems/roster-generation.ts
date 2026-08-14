import { asContractId, asPlayerId } from "@/domain/ids";
import type { Player, PlayerPosition } from "@/domain/entities/player";
import type { Contract } from "@/domain/entities/contract";
import type { Rng } from "@/domain/rng";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";

const PLAYERS_PER_TEAM = 10;

const POSITION_SLOT: PlayerPosition[] = [
  "PG",
  "SG",
  "SF",
  "PF",
  "C",
  "PG",
  "SG",
  "SF",
  "PF",
  "C",
];

const FIRST_NAMES = [
  "Kai",
  "Jordan",
  "Riley",
  "Morgan",
  "Casey",
  "Avery",
  "Quinn",
  "Rowan",
  "Skyler",
  "Emerson",
  "Parker",
  "Cameron",
  "Reese",
  "Hayden",
  "Finley",
  "Sage",
] as const;

const LAST_NAMES = [
  "Harbor",
  "Summit",
  "Canyon",
  "Pacific",
  "North",
  "Vale",
  "Ridge",
  "Stone",
  "River",
  "Frost",
  "Bright",
  "Ash",
  "Lane",
  "Cross",
  "West",
  "East",
] as const;

/**
 * Fills empty team rosters with fictional players and starter contracts.
 * Idempotent: no-op when any players already exist.
 */
export function generateRosters(state: GameState, rng: Rng): SystemResult {
  if (Object.keys(state.world.players).length > 0) {
    return systemResult(state);
  }

  const players: Record<string, Player> = {};
  const contracts: Record<string, Contract> = { ...state.business.contracts };
  const finances = { ...state.business.finances };

  const teamIds = Object.keys(state.world.teams).sort();

  for (const teamId of teamIds) {
    let teamPayroll = finances[teamId]?.payroll ?? 0;

    for (let slot = 0; slot < PLAYERS_PER_TEAM; slot += 1) {
      const playerId = asPlayerId(`player_${teamId}_${slot}`);
      const position = POSITION_SLOT[slot] ?? "SF";
      const offense = rng.nextInt(55, 88);
      const defense = rng.nextInt(55, 88);
      const overall = Math.round((offense + defense) / 2);
      const age = rng.nextInt(20, 34);

      const player: Player = {
        id: playerId,
        teamId: state.world.teams[teamId]!.id,
        firstName: FIRST_NAMES[rng.nextInt(0, FIRST_NAMES.length - 1)]!,
        lastName: LAST_NAMES[rng.nextInt(0, LAST_NAMES.length - 1)]!,
        position,
        age,
        ratings: { overall, offense, defense },
      };
      players[playerId] = player;

      const salaryPerYear = 500_000 + overall * 80_000;
      const yearsRemaining = rng.nextInt(1, 4);
      const contractId = asContractId(`contract_${playerId}`);
      contracts[contractId] = {
        id: contractId,
        playerId,
        teamId: state.world.teams[teamId]!.id,
        salaryPerYear,
        yearsRemaining,
      };
      teamPayroll += salaryPerYear;
    }

    const existingFinance = finances[teamId];
    if (existingFinance) {
      finances[teamId] = {
        ...existingFinance,
        payroll: teamPayroll,
      };
    }
  }

  return systemResult({
    ...state,
    world: {
      ...state.world,
      players,
    },
    business: {
      ...state.business,
      contracts,
      finances,
    },
  });
}
