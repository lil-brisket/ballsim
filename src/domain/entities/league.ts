import type { ConferenceId, LeagueId } from "@/domain/ids";

export type League = {
  id: LeagueId;
  name: string;
  abbreviation: string;
  conferenceIds: ConferenceId[];
};
