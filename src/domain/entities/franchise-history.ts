import type { SeasonId, TeamId } from "@/domain/ids";
import type { FacilityCategory } from "@/domain/entities/franchise-ops";

/**
 * Small per-season franchise snapshot (E13). Not a second event database.
 * Live franchise value is a selector — snapshots may copy the derived value
 * for that season only.
 */

export type PlayoffResultSnapshot =
  | "missed"
  | "first_round"
  | "second_round"
  | "conference_finals"
  | "finals"
  | "champion";

export type FranchiseSeasonRecord = {
  seasonId: SeasonId;
  seasonYear: number;
  wins: number;
  losses: number;
  playoffResult: PlayoffResultSnapshot;
  championship: boolean;
  revenue: number;
  cash: number;
  fanSentiment: number;
  reputation: number;
  facilityLevels: Record<FacilityCategory, number>;
  relocated: boolean;
  /** City identity at season end (continuity across relocation). */
  city: string;
  /** Nickname at season end. */
  name: string;
  notableEventIds: string[];
  /** Derived franchise value at season end (historical copy only). */
  franchiseValue: number;
};

export type FranchiseHistory = {
  teamId: TeamId;
  seasons: FranchiseSeasonRecord[];
};

export function createEmptyFranchiseHistory(teamId: TeamId): FranchiseHistory {
  return { teamId, seasons: [] };
}
