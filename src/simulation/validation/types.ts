/**
 * Types for simulation statistical validation.
 * Snapshots use authoritative GameResult / GameTeamStats fields only.
 */

export type ValidationVerdict = "PASS" | "WARNING" | "FAIL";

export type TeamSide = "home" | "away";

export type TeamGameSnapshot = {
  side: TeamSide;
  teamId: string;
  points: number;
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  threePointersMade: number;
  threePointersAttempted: number;
  freeThrowsMade: number;
  freeThrowsAttempted: number;
  offensiveRebounds: number;
  defensiveRebounds: number;
  rebounds: number;
  assists: number;
  turnovers: number;
  fouls: number;
  possessions: number;
  /** null when attempts === 0 */
  fieldGoalPct: number | null;
  threePointPct: number | null;
  freeThrowPct: number | null;
  /** points / completed offensive possessions */
  pointsPerPossession: number | null;
};

export type GameSnapshot = {
  gameId: string;
  homeScore: number;
  awayScore: number;
  totalScore: number;
  scoreDifferential: number;
  absoluteDifferential: number;
  winner: "home" | "away";
  periodCount: number;
  overtimePeriodCount: number;
  homePossessions: number;
  awayPossessions: number;
  totalPossessions: number;
  home: TeamGameSnapshot;
  away: TeamGameSnapshot;
};

export type MetricSummary = {
  n: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  stdev: number;
};

export type PooledShooting = {
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  fieldGoalPct: number | null;
  threePointersMade: number;
  threePointersAttempted: number;
  threePointPct: number | null;
  freeThrowsMade: number;
  freeThrowsAttempted: number;
  freeThrowPct: number | null;
};

export type HomeAwaySplit = {
  homeWinRate: number;
  homeWins: number;
  awayWins: number;
  homePoints: MetricSummary;
  awayPoints: MetricSummary;
  homeFieldGoalPct: MetricSummary;
  awayFieldGoalPct: MetricSummary;
  homeThreePointPct: MetricSummary;
  awayThreePointPct: MetricSummary;
  homeTurnovers: MetricSummary;
  awayTurnovers: MetricSummary;
};

export type ValidationAggregates = {
  gamesSimulated: number;
  seed: number | string;
  teamPoints: MetricSummary;
  gameTotals: MetricSummary;
  absoluteDifferentials: MetricSummary;
  possessionsPerTeam: MetricSummary;
  pointsPerPossession: MetricSummary;
  fieldGoalPct: MetricSummary;
  threePointPct: MetricSummary;
  freeThrowPct: MetricSummary;
  offensiveRebounds: MetricSummary;
  defensiveRebounds: MetricSummary;
  totalRebounds: MetricSummary;
  assists: MetricSummary;
  turnovers: MetricSummary;
  fouls: MetricSummary;
  freeThrowAttempts: MetricSummary;
  assistToFgmRatio: MetricSummary;
  pooledShooting: PooledShooting;
  homeAway: HomeAwaySplit;
};

export type CheckResult = {
  name: string;
  verdict: ValidationVerdict;
  message: string;
  value?: number | null;
};

export type InvariantFailure = {
  gameId: string;
  side?: TeamSide;
  rule: string;
  detail: string;
};

export type CorrelationResult = {
  name: string;
  predictor: string;
  outcome: string;
  /** Expected sign: +1 positive, -1 negative */
  expectedSign: 1 | -1;
  sampleSize: number;
  pearsonR: number | null;
  /** Informational only when |r| is small; wrong-direction → WARNING */
  verdict: ValidationVerdict;
  message: string;
};

export type MatchupDiagnosticResult = {
  games: number;
  offenseStrongMeanPoints: number;
  offenseWeakMeanPoints: number;
  defenseStrongOpponentPoints: number;
  defenseWeakOpponentPoints: number;
  offenseAdvantage: number;
  defenseAdvantage: number;
  verdict: ValidationVerdict;
  message: string;
};

export type ValidationRunResult = {
  seed: number | string;
  gamesSimulated: number;
  aggregates: ValidationAggregates;
  invariantFailures: InvariantFailure[];
  plausibilityChecks: CheckResult[];
  correlations: CorrelationResult[];
  overallVerdict: ValidationVerdict;
  checksum: string;
  matchup?: MatchupDiagnosticResult;
};
