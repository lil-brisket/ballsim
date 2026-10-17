/**
 * View-model contract for the Watch Game page (owner games with a recorded
 * play-by-play log). Built by src/state/watch-game-selectors.ts from
 * competition.playByPlay + competition.games; rendered by
 * src/components/game/watch/*. Pure data: no React, no simulation.
 */
import type { GameCompetitionType, GameScore } from "@/domain/entities/game";
import type { GameId, PlayerId, TeamId } from "@/domain/ids";
import type { PlayerPosition } from "@/domain/entities/player";
import type { TeamBrandingView } from "@/state/team-branding-view";

/** 0 = home, 1 = away (matches PlayByPlayLog.side). */
export type WatchSide = 0 | 1;

export type WatchTeam = {
  teamId: TeamId;
  side: WatchSide;
  city: string;
  name: string;
  abbreviation: string;
  branding: TeamBrandingView;
  /** false when the team has no stored branding and `branding` is the neutral fallback. */
  hasBranding: boolean;
};

export type WatchPlayer = {
  playerId: PlayerId;
  side: WatchSide;
  /** "Jalen Smith". */
  fullName: string;
  /** "J. Smith" — used in feed text. */
  shortName: string;
  /** "Smith" — court token label (falls back to shortName when unknown). */
  lastName: string;
  /** Current roster position; null when the player record is gone. */
  position: PlayerPosition | null;
  started: boolean;
  /** Final minutes from the box score (not derivable per play). */
  finalMinutes: number;
};

export type WatchPlayKind =
  | "two_made"
  | "two_missed"
  | "three_made"
  | "three_missed"
  | "ft_made"
  | "ft_missed"
  | "offensive_rebound"
  | "defensive_rebound"
  | "turnover"
  | "shooting_foul"
  | "personal_foul"
  | "offensive_foul"
  | "substitution";

export type WatchHighlight =
  /** Scoring play that gives the lead to the team that was trailing. */
  | "lead_change"
  /** Scoring play that ties the game (score > 0). */
  | "tie"
  /** Scoring play where one side's unanswered run reaches 8 points. */
  | "run"
  /** Scoring play in the last 5:00 of Q4/OT with |margin before| <= 5. */
  | "clutch"
  /** Foul that gives the fouler their 6th personal foul. */
  | "foul_out"
  /** Made shot followed in the same possession by a shooting foul on the shooter. */
  | "and_one";

export type WatchPlay = {
  /** Index in the log (0-based, feed order). */
  index: number;
  period: number;
  /** "Q1".."Q4", "OT", "2OT", ... */
  periodLabel: string;
  /** Seconds remaining in the period at possession start. */
  clock: number;
  /** "m:ss", e.g. "11:42", "0:07". */
  clockLabel: string;
  /** Possession number; plays sharing (period, poss) and kind !== substitution form one feed row group. */
  poss: number;
  kind: WatchPlayKind;
  side: WatchSide;
  playerId: PlayerId;
  /** Assister / blocker / stealer / fouled player / player in — per code table. */
  player2Id: PlayerId | null;
  /** Broadcast-style line, e.g. "J. Smith makes 3-pt shot (K. Lee assists)". */
  text: string;
  /** Points scored by this play (0–3). */
  points: number;
  /** Score after this play. */
  homeScore: number;
  awayScore: number;
  highlights: WatchHighlight[];
};

export type KeyMomentKind =
  "lead_change" | "tie" | "run" | "clutch" | "foul_out" | "injury";

export type KeyMoment = {
  kind: KeyMomentKind;
  /** Play index the moment is anchored to; null for post-game injuries. */
  playIndex: number | null;
  periodLabel: string | null;
  clockLabel: string | null;
  side: WatchSide | null;
  /** Short headline, e.g. "10-0 run", "Go-ahead 3", "J. Smith fouls out". */
  title: string;
  /** One sentence with score context, e.g. "BOS leads 88-85". */
  detail: string;
};

export type ShotLine = {
  points: number;
  fgm: number;
  fga: number;
  twoPm: number;
  twoPa: number;
  threePm: number;
  threePa: number;
  ftm: number;
  fta: number;
  /** Made field goals with an assister. */
  assistedFgm: number;
};

export type TeamShotSummary = {
  total: ShotLine;
  /** One entry per period played (index 0 = Q1). */
  byPeriod: ShotLine[];
};

export type ShotSummary = {
  home: TeamShotSummary;
  away: TeamShotSummary;
  /** Players with at least one shot attempt, sorted by points desc then name. */
  players: Array<{ playerId: PlayerId; side: WatchSide; line: ShotLine }>;
};

export type PostGameInjury = {
  playerId: PlayerId;
  side: WatchSide;
  shortName: string;
  /** e.g. "Ankle sprain (moderate)". */
  description: string;
};

export type WatchGameView = {
  gameId: GameId;
  date: string;
  competitionType: GameCompetitionType;
  home: WatchTeam;
  away: WatchTeam;
  finalScore: GameScore;
  periodScores: GameScore[];
  players: WatchPlayer[];
  plays: WatchPlay[];
  keyMoments: KeyMoment[];
  /** Whole-game shot summary (the page may also derive one up to the current play). */
  shotSummary: ShotSummary;
  injuries: PostGameInjury[];
};

export type LiveBoxScoreRow = {
  playerId: PlayerId;
  side: WatchSide;
  shortName: string;
  started: boolean;
  /** On the floor after the revealed plays (starters, then substitutions). */
  onCourt: boolean;
  points: number;
  fgm: number;
  fga: number;
  threePm: number;
  threePa: number;
  ftm: number;
  fta: number;
  offensiveRebounds: number;
  defensiveRebounds: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls: number;
  fouledOut: boolean;
};

export type LiveTeamBox = {
  rows: LiveBoxScoreRow[];
  totals: Omit<
    LiveBoxScoreRow,
    "playerId" | "side" | "shortName" | "started" | "onCourt" | "fouledOut"
  >;
  /** Team fouls in the current period. */
  periodFouls: number;
};

export type LiveBoxScore = {
  /** Number of plays revealed (0 = tip-off, plays.length = final). */
  revealed: number;
  homeScore: number;
  awayScore: number;
  periodLabel: string;
  clockLabel: string;
  isFinal: boolean;
  home: LiveTeamBox;
  away: LiveTeamBox;
};
