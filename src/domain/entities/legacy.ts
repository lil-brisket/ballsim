import type { PlayerId, TeamId } from "@/domain/ids";

/** A Hall of Fame member (schema v78+). */
export type HallOfFameInductee = {
  playerId: PlayerId;
  playerName: string;
  /** Season year of the induction. */
  inductedSeasonYear: number;
  /** His last season. */
  lastSeasonYear: number;
  /** Team he played the most seasons for (null when unknown). */
  primaryTeamId: TeamId | null;
  seasons: number;
  /** Career value score that met the bar. */
  score: number;
  /** One-line career summary, e.g. "2× MVP · 1 title · 18.4 ppg". */
  summary: string;
};

export type HallOfFameState = {
  inductees: HallOfFameInductee[];
};

/** A number a franchise no longer issues (schema v78+). */
export type RetiredJerseyNumber = {
  number: number;
  playerId: PlayerId;
  playerName: string;
  retiredOn: string;
};

/** Retired numbers by team id. */
export type RetiredNumbersState = Record<string, RetiredJerseyNumber[]>;
