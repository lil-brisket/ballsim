import type { TeamId } from "@/domain/ids";

export type TeamFinances = {
  teamId: TeamId;
  cash: number;
  revenue: number;
  expenses: number;
  payroll: number;
};
