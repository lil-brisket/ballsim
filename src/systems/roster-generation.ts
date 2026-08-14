import { asContractId, asPlayerId } from "@/domain/ids";
import {
  type Player,
  type PlayerAttributes,
  type PlayerPosition,
} from "@/domain/entities/player";
import type { Contract } from "@/domain/entities/contract";
import type { Rng } from "@/domain/rng";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { generatePlayerWithRng } from "@/systems/player-generation";

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

/**
 * Fills empty team rosters with fictional players and starter contracts.
 * Idempotent: no-op when any players already exist.
 *
 * Player identity, attributes, potential, and personality come from
 * {@link generatePlayerWithRng}. Contracts and payroll remain roster-owned.
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
      const contractId = asContractId(`contract_${playerId}`);

      const player = generatePlayerWithRng(rng, {
        id: playerId,
        teamId: state.world.teams[teamId]!.id,
        contractId,
        position,
      });
      players[playerId] = player;

      const attributeMean = meanAttributes(player.attributes);
      const salaryPerYear = 500_000 + attributeMean * 80_000;
      const yearsRemaining = rng.nextInt(1, 4);
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

function meanAttributes(attributes: PlayerAttributes): number {
  const values = Object.values(attributes);
  const sum = values.reduce((acc, value) => acc + value, 0);
  return Math.round(sum / values.length);
}
