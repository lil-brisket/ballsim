import type { DivisionId, TeamId } from "@/domain/ids";

export type Team = {
  id: TeamId;
  divisionId: DivisionId;
  city: string;
  name: string;
  abbreviation: string;
};
