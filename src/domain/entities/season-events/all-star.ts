import type { GameId, PlayerId, SeasonId, TeamId } from "@/domain/ids";
import type { FanVoteCampaignId } from "@/domain/ids";

export type AllStarSelectionRole = "starter" | "reserve";

export type AllStarSelection = {
  playerId: PlayerId;
  teamId: TeamId | null;
  conferenceId: string | null;
  role: AllStarSelectionRole;
  /** Fan-vote rank within category at selection time (informational). */
  voteRank: number | null;
  categoryId: string | null;
};

export type AllStarEventStatus =
  | "scheduled"
  | "voting"
  | "selections_announced"
  | "completed"
  | "cancelled";

export type AllStarEventState = {
  seasonId: SeasonId;
  campaignId: FanVoteCampaignId;
  eventDate: string;
  status: AllStarEventStatus;
  selections: AllStarSelection[];
  gameIds: GameId[];
  selectionsAnnouncedOn: string | null;
};
