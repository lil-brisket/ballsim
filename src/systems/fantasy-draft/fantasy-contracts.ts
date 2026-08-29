import { createContract, type Contract } from "@/domain/entities/contract";
import type { Player } from "@/domain/entities/player";
import { asContractId, type ContractId, type TeamId } from "@/domain/ids";
import { attributeBasedAnnualSalary } from "@/systems/attribute-salary";
import {
  FANTASY_CONTRACT_ID_PREFIX,
  FANTASY_DRAFT_CONTRACT_YEARS,
} from "@/systems/fantasy-draft/fantasy-draft-config";

/**
 * Fantasy-draft contracts are created at selection time (Option C).
 * They use attribute-based salaries and count against team payroll /
 * player-contract budget. System/business funds remain separate.
 */

export function fantasyContractIdFor(playerId: string): ContractId {
  return asContractId(`${FANTASY_CONTRACT_ID_PREFIX}${playerId}`);
}

export function isFantasyDraftContractId(contractId: string): boolean {
  return contractId.startsWith(FANTASY_CONTRACT_ID_PREFIX);
}

/**
 * Creates a multi-year fantasy-draft contract for a selected player.
 * Deterministic; no RNG.
 */
export function createFantasyDraftContract(input: {
  player: Player;
  teamId: TeamId;
  seasonYear: number;
  years?: number;
}): Contract {
  const years = input.years ?? FANTASY_DRAFT_CONTRACT_YEARS;
  if (!Number.isInteger(years) || years < 1) {
    throw new Error("Fantasy draft contract years must be a positive integer.");
  }
  const startYear = input.seasonYear;
  const endYear = startYear + years - 1;
  const salaryPerYear = attributeBasedAnnualSalary(input.player.attributes);
  const salaryByYear: Record<string, number> = {};
  for (let year = startYear; year <= endYear; year += 1) {
    salaryByYear[String(year)] = salaryPerYear;
  }
  return createContract({
    id: fantasyContractIdFor(input.player.id),
    playerId: input.player.id,
    teamId: input.teamId,
    startYear,
    endYear,
    salaryByYear,
  });
}
