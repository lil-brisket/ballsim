import {
  createPlayer,
  type Player,
  type PlayerInput,
} from "@/domain/entities/player";
import { asContractId, asPlayerId, asTeamId } from "@/domain/ids";
import { developmentStageForAge } from "@/systems/player-generation-config";
import { asCanonicalPlayerId } from "@/systems/custom-content/normalize";
import type { PlayerSourceRecord } from "@/systems/custom-content/package-types";

export function playerInputFromSource(input: {
  contentId: string;
  source: PlayerSourceRecord;
  teamId: ReturnType<typeof asTeamId> | null;
  contractId: ReturnType<typeof asContractId> | null;
}): PlayerInput {
  return {
    id: asCanonicalPlayerId(input.contentId, input.source.sourceId),
    teamId: input.teamId,
    firstName: input.source.firstName,
    lastName: input.source.lastName,
    nationality: input.source.nationality,
    age: input.source.age,
    heightInches: input.source.heightInches,
    weightPounds: input.source.weightPounds,
    position: input.source.position,
    archetype: input.source.archetype,
    attributes: { ...input.source.attributes },
    potential: { ...input.source.potential },
    personality: { ...input.source.personality },
    contractId: input.contractId,
    availability: "available",
    activeInjuries: [],
    suspension: null,
    physical:
      input.source.durability !== undefined
        ? { durability: input.source.durability }
        : undefined,
    conditioning: 100,
    injuryHistory: [],
    development: { stage: developmentStageForAge(input.source.age) },
  };
}

export function createPlayerFromSource(input: {
  contentId: string;
  source: PlayerSourceRecord;
  teamId: ReturnType<typeof asTeamId> | null;
  contractId: ReturnType<typeof asContractId> | null;
}): Player {
  return createPlayer(playerInputFromSource(input));
}

export function playerIdFromSource(contentId: string, sourceId: string) {
  return asPlayerId(`custom_${contentId}_${sourceId}`);
}
