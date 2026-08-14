import type { ConferenceId, DivisionId, TeamId } from "@/domain/ids";

export type Division = {
  id: DivisionId;
  conferenceId: ConferenceId;
  name: string;
  teamIds: TeamId[];
};
