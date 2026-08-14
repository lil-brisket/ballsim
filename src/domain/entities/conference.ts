import type { ConferenceId, DivisionId, LeagueId } from "@/domain/ids";

export type Conference = {
  id: ConferenceId;
  leagueId: LeagueId;
  name: string;
  divisionIds: DivisionId[];
};
