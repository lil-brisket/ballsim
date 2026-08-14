import { asContractId, asPlayerId } from "@/domain/ids";
import {
  createPlayer,
  type Player,
  type PlayerAttributes,
  type PlayerPosition,
  type DevelopmentStage,
} from "@/domain/entities/player";
import type { Contract } from "@/domain/entities/contract";
import type { Rng } from "@/domain/rng";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import {
  generatePlayerAttributes,
  pickCompatibleArchetype,
} from "@/systems/player-attribute-generation";

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
 *
 * Potential formula (unchanged):
 * potential.overall = min(99, round(mean of all 19 attributes) + rng.nextInt(0, 8))
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
      const archetype = pickCompatibleArchetype(position, rng);
      const age = rng.nextInt(20, 34);
      const contractId = asContractId(`contract_${playerId}`);

      const attributes = generatePlayerAttributes(position, archetype, rng);
      const attributeMean = meanAttributes(attributes);
      const potentialOverall = Math.min(
        99,
        attributeMean + rng.nextInt(0, 8),
      );

      const player = createPlayer({
        id: playerId,
        teamId: state.world.teams[teamId]!.id,
        firstName: FIRST_NAMES[rng.nextInt(0, FIRST_NAMES.length - 1)]!,
        lastName: LAST_NAMES[rng.nextInt(0, LAST_NAMES.length - 1)]!,
        position,
        archetype,
        age,
        heightInches: rng.nextInt(72, 84),
        weightPounds: rng.nextInt(180, 260),
        attributes,
        potential: { overall: potentialOverall },
        personality: {
          workEthic: rng.nextInt(40, 90),
          loyalty: rng.nextInt(40, 90),
          competitiveness: rng.nextInt(40, 90),
          leadership: rng.nextInt(40, 90),
          composure: rng.nextInt(40, 90),
        },
        contractId,
        injury: { kind: "healthy" },
        development: { stage: developmentStageForAge(age) },
      });
      players[playerId] = player;

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

function developmentStageForAge(age: number): DevelopmentStage {
  if (age < 25) {
    return "developing";
  }
  if (age > 30) {
    return "declining";
  }
  return "prime";
}
