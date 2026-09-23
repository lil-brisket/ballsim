import type {
  FanVoteCampaignId,
  FanVoteCategoryId,
  PlayerId,
  SeasonId,
  TeamId,
} from "@/domain/ids";

export type FanVoteCampaignStatus =
  | "scheduled"
  | "open"
  | "closed"
  | "finalized";

export type FanVoteCategoryKind =
  | "guards"
  | "forwards"
  | "centers"
  | "open";

export type FanVoteCandidate = {
  playerId: PlayerId;
  teamId: TeamId | null;
  voteTotal: number;
  voteShare: number;
  rank: number;
  previousRank: number | null;
};

export type FanVoteCategory = {
  id: FanVoteCategoryId;
  label: string;
  kind: FanVoteCategoryKind;
  /** Conference id when conference-scoped; null for league-wide. */
  conferenceId: string | null;
  candidates: Record<string, FanVoteCandidate>;
};

export type FanVoteCampaign = {
  id: FanVoteCampaignId;
  seasonId: SeasonId;
  title: string;
  openDate: string;
  closeDate: string;
  status: FanVoteCampaignStatus;
  categories: Record<string, FanVoteCategory>;
  /**
   * Full per-category rankings from the previous tick.
   * Overwritten each voting day; not a daily history.
   */
  previousRankings: Record<string, Record<string, number>>;
  /** Last date a vote tick was applied (YYYY-MM-DD). */
  lastTickDate: string | null;
};

export function createEmptyFanVoteCampaign(input: {
  id: FanVoteCampaignId;
  seasonId: SeasonId;
  title: string;
  openDate: string;
  closeDate: string;
}): FanVoteCampaign {
  return {
    id: input.id,
    seasonId: input.seasonId,
    title: input.title,
    openDate: input.openDate,
    closeDate: input.closeDate,
    status: "scheduled",
    categories: {},
    previousRankings: {},
    lastTickDate: null,
  };
}
