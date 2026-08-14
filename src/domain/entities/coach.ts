import type { CoachId, TeamId } from "@/domain/ids";

export type Coach = {
  id: CoachId;
  teamId: TeamId | null;
  firstName: string;
  lastName: string;
};
