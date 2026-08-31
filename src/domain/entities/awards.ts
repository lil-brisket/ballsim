import type { CoachId, LeagueId, PlayerId, SeasonId, TeamId } from "@/domain/ids";
import type { PlayerSeasonStatLine } from "@/domain/entities/player-history";

export type AwardCadence = "monthly" | "yearly";

export type AwardSubjectType = "player" | "coach";

export type AwardTier = "major" | "monthly";

export type AwardDefinitionId =
  | "player_of_month"
  | "rookie_of_month"
  | "defensive_player_of_month"
  | "mvp"
  | "dpoy"
  | "roy"
  | "sixth_man"
  | "most_improved"
  | "coach_of_year";

export type AwardDefinition = {
  id: AwardDefinitionId;
  cadence: AwardCadence;
  displayName: string;
  shortLabel: string;
  subjectType: AwardSubjectType;
  tier: AwardTier;
};

export type AwardSubjectRef = {
  subjectType: AwardSubjectType;
  subjectId: PlayerId | CoachId;
  teamId: TeamId | null;
};

export type AwardCandidateResult = {
  subjectId: PlayerId | CoachId;
  teamId: TeamId | null;
  rank: number;
  score: number;
  breakdown?: Record<string, number>;
};

export type AwardPerGameRates = {
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  minutes: number;
};

export type AwardEfficiencySnapshot = {
  tsPct: number | null;
  eFgPct: number | null;
  astTo: number | null;
};

export type AwardTeamRecordSnapshot = {
  wins: number;
  losses: number;
  winPct: number;
};

export type AwardStatSnapshot = {
  games: number;
  minutes: number;
  totals: PlayerSeasonStatLine;
  perGame: AwardPerGameRates;
  efficiency: AwardEfficiencySnapshot;
  teamRecord: AwardTeamRecordSnapshot;
  teamRank: number | null;
  scoringBreakdown: Record<string, number>;
  metricVersion: number;
};

export type AwardResultContext = {
  winnerScore: number;
  breakdown: Record<string, number>;
  statSnapshot: AwardStatSnapshot;
  metricVersion: number;
};

export type AwardResult = {
  /** Deterministic: award:{leagueId}:{seasonYear}:{period|yearly}:{awardId} */
  id: string;
  awardId: AwardDefinitionId;
  cadence: AwardCadence;
  leagueId: LeagueId;
  seasonId: SeasonId;
  seasonYear: number;
  /** YYYY-MM for monthly; null for yearly. */
  period: string | null;
  winner: AwardSubjectRef;
  /** Ranked candidates including winner at rank 1 (top 5). */
  candidates: AwardCandidateResult[];
  context: AwardResultContext;
};

export type AwardHistoryState = {
  results: Record<string, AwardResult>;
};

export function createEmptyAwardHistory(): AwardHistoryState {
  return { results: {} };
}

export function buildAwardResultId(
  leagueId: string,
  seasonYear: number,
  period: string | null,
  awardId: AwardDefinitionId,
): string {
  const periodKey = period ?? "yearly";
  return `award:${leagueId}:${seasonYear}:${periodKey}:${awardId}`;
}
