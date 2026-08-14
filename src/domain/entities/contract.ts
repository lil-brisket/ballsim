import type { ContractId, PlayerId, TeamId } from "@/domain/ids";

export type Contract = {
  id: ContractId;
  playerId: PlayerId;
  teamId: TeamId;
  salaryPerYear: number;
  yearsRemaining: number;
};
