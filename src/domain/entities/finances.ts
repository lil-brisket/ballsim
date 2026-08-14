import type { TeamId } from "@/domain/ids";

export type TeamFinances = {
  teamId: TeamId;
  cash: number;
  payroll: number;
};
