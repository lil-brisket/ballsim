import type { SeasonId } from "@/domain/ids";

export type MidseasonAwardsStatus =
  | "scheduled"
  | "announced"
  | "cancelled";

export type MidseasonAwardsState = {
  seasonId: SeasonId;
  /** Inclusive RS stats cutoff date (YYYY-MM-DD). */
  cutoffDate: string;
  announceDate: string;
  status: MidseasonAwardsStatus;
  /** Award result ids written into business.awards.results. */
  resultIds: string[];
};
