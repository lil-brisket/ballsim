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

export const PLAYOFF_RESULT_DEPTH: Record<PlayoffResultSnapshot, number> = {
  missed: 0,
  first_round: 1,
  second_round: 2,
  conference_finals: 3,
  finals: 4,
  champion: 5,
};

export function isPlayoffAppearance(result: PlayoffResultSnapshot): boolean {
  return result !== "missed";
}

export function playoffResultDepth(result: PlayoffResultSnapshot): number {
  return PLAYOFF_RESULT_DEPTH[result];
}

export type FranchiseSeasonRecord = {
  seasonId: SeasonId;
  seasonYear: number;
  wins: number;
  losses: number;
  playoffResult: PlayoffResultSnapshot;
  championship: boolean;
  revenue: number;
  /** Season expenses total (historical fact). */
  expenses: number;
  /** Season net income (revenue − expenses). */
  netIncome: number;
  /** Season payroll from contracts. */
  payroll: number;
  /** League rank by win% at season end (1 = best); null if unknown. */
  leagueRank: number | null;
  /** Total home attendance (regular + playoff) for the completed season. */
  attendance: number | null;
  businessFunds: number;
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
