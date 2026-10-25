/**
 * League timeline (Media Hub) view model. Derived at read time from games,
 * awards, playoffs and the persisted media cache; nothing here is saved.
 */

import type { ImportanceLevel } from "@/domain/entities/event-source";
import type { GameCompetitionType, GameScore } from "@/domain/entities/game";
import type { InjurySeverity } from "@/domain/entities/injury";
import type { AwardDefinitionId } from "@/domain/entities/awards";
import type { TeamBranding } from "@/domain/entities/team-branding";

export const TIMELINE_FILTERS = [
  "for-you",
  "your-team",
  "league",
  "scores",
  "moves",
  "injuries",
  "awards",
] as const;

export type TimelineFilter = (typeof TIMELINE_FILTERS)[number];

export type TimelinePostKind =
  | "game"
  | "performance"
  | "award"
  | "playoff"
  | "streak"
  | "trade"
  | "signing"
  /** Other roster moves (releases, draft picks, call-ups). */
  | "transaction"
  | "injury"
  | "league";

export type TimelineTeamRef = {
  teamId: string;
  abbreviation: string;
  /** "City Name" */
  displayName: string;
  /** Short club name ("Hawks"). */
  name: string;
  branding: TeamBranding | null;
};

export type TimelinePlayerRef = {
  playerId: string;
  firstName: string;
  lastName: string;
  teamId: string | null;
};

export type TimelineStatLine = {
  minutes: number;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  threePointersMade: number;
  threePointersAttempted: number;
};

export type TimelinePerformer = {
  player: TimelinePlayerRef;
  line: TimelineStatLine;
};

export type GameNotabilityReason =
  | "user_team"
  | "playoff"
  | "all_star"
  | "blowout"
  | "overtime"
  | "comeback"
  | "upset";

export type PerformanceReason =
  | "forty_points"
  | "twenty_twenty"
  | "triple_double"
  | "blocks"
  | "steals"
  | "assists"
  | "season_high";

export type TimelineSeriesState = {
  seriesId: string;
  roundLabel: string;
  /** Wins after this game, keyed by team id. */
  wins: Record<string, number>;
  gameNumber: number;
  /** Wins needed to take the series (4 in a best-of-7). */
  winsToClinch: number;
};

export type GameAttachment = {
  type: "game";
  gameId: string;
  date: string;
  competitionType: GameCompetitionType;
  home: TimelineTeamRef;
  away: TimelineTeamRef;
  score: GameScore;
  periodScores: GameScore[];
  overtimePeriods: number;
  winnerTeamId: string;
  margin: number;
  reasons: GameNotabilityReason[];
  /** Largest deficit the winner overcame at a period break (0 when none). */
  comebackDeficit: number;
  /** Win% before tip-off, regular-season games only (null when unknown). */
  winPctBefore: { home: number | null; away: number | null };
  topPerformers: {
    home: TimelinePerformer | null;
    away: TimelinePerformer | null;
  };
  series: TimelineSeriesState | null;
};

export type PerformanceAttachment = {
  type: "performance";
  gameId: string;
  player: TimelinePlayerRef;
  team: TimelineTeamRef;
  opponent: TimelineTeamRef;
  won: boolean;
  line: TimelineStatLine;
  reasons: PerformanceReason[];
};

/** One number on an award card ("SPG 2.1"); values are display-ready. */
export type AwardStat = {
  label: string;
  value: string;
  tone?: "win" | "loss";
};

export type AwardAttachment = {
  type: "award";
  awardResultId: string;
  awardId: AwardDefinitionId;
  awardName: string;
  cadence: "monthly" | "yearly";
  seasonYear: number;
  period: string | null;
  /** Null for coach awards. */
  winner: TimelinePlayerRef | null;
  winnerCoachName: string | null;
  team: TimelineTeamRef | null;
  /** The award's own numbers (see award-stat-lines.ts); empty when unknown. */
  stats: AwardStat[];
  /** Signed change on last season (MIP points per game, COY wins), when known. */
  improvement: number | null;
  teamRecord: { wins: number; losses: number } | null;
  runnerUp: { name: string; teamAbbreviation: string | null } | null;
};

export type AwardRaceContender = {
  /** 1 = leading the race. */
  rank: number;
  /** Null for coach races. */
  player: TimelinePlayerRef | null;
  coachName: string | null;
  team: TimelineTeamRef | null;
};

/** Weekly standings of an award that has not been decided yet. */
export type AwardRaceAttachment = {
  type: "award_race";
  awardId: AwardDefinitionId;
  awardName: string;
  seasonYear: number;
  /** Last day of the week the standings cover (a Sunday). */
  throughDate: string;
  contenders: AwardRaceContender[];
  /** The previous week's leader when someone else leads now; else null. */
  previousLeaderName: string | null;
};

export type PlayoffEvent = "series_won" | "champion" | "previous_champion";

export type PlayoffAttachment = {
  type: "playoff";
  event: PlayoffEvent;
  seasonYear: number;
  seriesId: string | null;
  roundLabel: string | null;
  winner: TimelineTeamRef;
  loser: TimelineTeamRef | null;
  /** Final series wins (winner first); null for previous_champion. */
  seriesScore: { winner: number; loser: number } | null;
  sweep: boolean;
  wentDistance: boolean;
};

export type StreakAttachment = {
  type: "streak";
  team: TimelineTeamRef;
  event: "win_streak" | "losing_streak" | "streak_snapped";
  length: number;
  /** For streak_snapped: the team that ended it. */
  snappedBy: TimelineTeamRef | null;
  gameId: string;
};

export type TradeMovement = {
  player: TimelinePlayerRef;
  fromTeamId: string;
  toTeamId: string;
};

export type TradeAttachment = {
  type: "trade";
  teams: TimelineTeamRef[];
  movements: TradeMovement[];
  /** Picks and other pieces described by the persisted headlines. */
  otherPieces: string[];
};

export type SigningAttachment = {
  type: "signing";
  player: TimelinePlayerRef | null;
  team: TimelineTeamRef | null;
  headline: string;
  summary: string;
};

export type InjuryAttachment = {
  type: "injury";
  player: TimelinePlayerRef | null;
  team: TimelineTeamRef | null;
  severity: InjurySeverity | null;
  bodyPart: string | null;
  expectedReturn: { earliest: string; latest: string } | null;
};

export type LeagueAttachment = {
  type: "league";
  headline: string;
  summary: string;
};

export type TimelineAttachment =
  | GameAttachment
  | PerformanceAttachment
  | AwardAttachment
  | AwardRaceAttachment
  | PlayoffAttachment
  | StreakAttachment
  | TradeAttachment
  | SigningAttachment
  | InjuryAttachment
  | LeagueAttachment;

export type TimelinePost = {
  /** Stable id: game:<id>, perf:<gameId>:<playerId>, award:<id>, media:<id>, … */
  id: string;
  occurredOn: string;
  kind: TimelinePostKind;
  importance: ImportanceLevel;
  /** 0–100: how big the story is league-wide. */
  notability: number;
  /** 0–100: how much it matters to the viewing franchise. */
  relevance: number;
  teamIds: string[];
  playerIds: string[];
  gameId?: string;
  attachment: TimelineAttachment;
  /** Team abbreviations and award names, for trending and filters. */
  tags: string[];
  unread: boolean;
};

export type TimelineScore = {
  gameId: string;
  date: string;
  home: TimelineTeamRef;
  away: TimelineTeamRef;
  score: GameScore;
  overtimePeriods: number;
};

export type TimelineTrend = {
  tag: string;
  count: number;
};

export type LeagueTimeline = {
  posts: TimelinePost[];
  /** Pass as `before` to load the next page; null on the last page. */
  nextCursor: string | null;
  topStory: TimelinePost | null;
  scores: TimelineScore[];
  trending: TimelineTrend[];
  unreadCount: number;
};
