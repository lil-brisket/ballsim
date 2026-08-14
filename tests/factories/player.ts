import {
  asContractId,
  asPlayerId,
  asTeamId,
  type ContractId,
  type PlayerId,
  type TeamId,
} from "@/domain/ids";
import {
  createPlayer as createDomainPlayer,
  type DevelopmentState,
  type InjuryStatus,
  type Player,
  type PlayerAttributes,
  type PlayerPersonality,
  type PlayerPosition,
  type PlayerPotential,
} from "@/domain/entities/player";

export type CreatePlayerOverrides = {
  id?: PlayerId | string;
  teamId?: TeamId | string | null;
  firstName?: string;
  lastName?: string;
  position?: PlayerPosition;
  age?: number;
  heightInches?: number;
  weightPounds?: number;
  attributes?: Partial<PlayerAttributes>;
  potential?: Partial<PlayerPotential>;
  personality?: Partial<PlayerPersonality>;
  contractId?: ContractId | string | null;
  injury?: InjuryStatus;
  development?: Partial<DevelopmentState>;
};

/**
 * Deterministic Player factory. Defaults are stable; pass overrides to customize.
 */
export function createPlayer(overrides: CreatePlayerOverrides = {}): Player {
  const defaultAttributes: PlayerAttributes = {
    speed: 73,
    strength: 66,
    athleticism: 73,
    stamina: 70,
    finishing: 70,
    midRange: 68,
    threePoint: 67,
    freeThrow: 72,
    ballHandling: 71,
    passing: 72,
    perimeterDefense: 69,
    interiorDefense: 65,
    steal: 64,
    block: 60,
    rebounding: 64,
    basketballIq: 70,
    offensiveIq: 69,
    defensiveIq: 67,
    consistency: 68,
  };

  const defaultPersonality: PlayerPersonality = {
    workEthic: 60,
    loyalty: 55,
    competitiveness: 65,
    leadership: 50,
    composure: 58,
  };

  const teamId =
    overrides.teamId === undefined
      ? asTeamId("team_test")
      : overrides.teamId === null
        ? null
        : asTeamId(String(overrides.teamId));

  const contractId =
    overrides.contractId === undefined
      ? asContractId("contract_test")
      : overrides.contractId === null
        ? null
        : asContractId(String(overrides.contractId));

  return createDomainPlayer({
    id: asPlayerId(overrides.id ?? "player_test"),
    teamId,
    firstName: overrides.firstName ?? "Alex",
    lastName: overrides.lastName ?? "Rivera",
    position: overrides.position ?? "PG",
    age: overrides.age ?? 24,
    heightInches: overrides.heightInches ?? 75,
    weightPounds: overrides.weightPounds ?? 195,
    attributes: {
      ...defaultAttributes,
      ...overrides.attributes,
    },
    potential: {
      overall: 80,
      ...overrides.potential,
    },
    personality: {
      ...defaultPersonality,
      ...overrides.personality,
    },
    contractId,
    injury: overrides.injury ?? { kind: "healthy" },
    development: {
      stage: "developing",
      ...overrides.development,
    },
  });
}
