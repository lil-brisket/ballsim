import type { ContractId, PlayerId, SeasonId, TeamId } from "@/domain/ids";
import type {
  DevelopmentStage,
  PlayerAttributes,
} from "@/domain/entities/player";

/**
 * Season-end snapshot: what the simulation knew about the player when the
 * season finalized. NOT the source of truth for games or career aggregates.
 *
 * Team stints, career highs, and best seasons are derived from gameArchive
 * + these snapshots via selectors.
 */

export type PlayerSeasonStatLine = {
  games: number;
  minutes: number;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fgMade: number;
  fgAttempted: number;
  threeMade: number;
  threeAttempted: number;
  ftMade: number;
  ftAttempted: number;
};

export type PlayerSeasonContractSnapshot = {
  contractId: ContractId | null;
  /** Salary for this season year; null if none. */
  salary: number | null;
  teamId: TeamId | null;
};

export type PlayerSeasonRecord = {
  seasonId: SeasonId;
  seasonYear: number;
  age: number;
  overall: number;
  attributes: PlayerAttributes;
  developmentStage: DevelopmentStage;
  /** Season-end injury status kind ("healthy" | "injured"). */
  injuryKind: string;
  /** Season-end contract snapshot only; current contract lives in business.contracts. */
  contractSnapshot: PlayerSeasonContractSnapshot;
  /** Season-level aggregates; 0 GP when player did not appear. */
  competition: {
    regular: PlayerSeasonStatLine;
    playoffs: PlayerSeasonStatLine;
    combined: PlayerSeasonStatLine;
  };
};

/** Derived view type (not persisted). */
export type PlayerTeamStint = {
  teamId: TeamId;
  teamCity: string;
  teamName: string;
  games: number;
  seasonYear: number;
};

export type PlayerHistory = {
  playerId: PlayerId;
  seasons: PlayerSeasonRecord[];
  /** When historical tracking began for this player (first archived season year). */
  trackingStartedSeasonYear: number | null;
};

export function createEmptyPlayerSeasonStatLine(): PlayerSeasonStatLine {
  return {
    games: 0,
    minutes: 0,
    points: 0,
    rebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fgMade: 0,
    fgAttempted: 0,
    threeMade: 0,
    threeAttempted: 0,
    ftMade: 0,
    ftAttempted: 0,
  };
}

export function createEmptyPlayerHistory(playerId: PlayerId): PlayerHistory {
  return {
    playerId,
    seasons: [],
    trackingStartedSeasonYear: null,
  };
}

export function addPlayerSeasonStatLines(
  a: PlayerSeasonStatLine,
  b: PlayerSeasonStatLine,
): PlayerSeasonStatLine {
  return {
    games: a.games + b.games,
    minutes: a.minutes + b.minutes,
    points: a.points + b.points,
    rebounds: a.rebounds + b.rebounds,
    assists: a.assists + b.assists,
    steals: a.steals + b.steals,
    blocks: a.blocks + b.blocks,
    turnovers: a.turnovers + b.turnovers,
    fgMade: a.fgMade + b.fgMade,
    fgAttempted: a.fgAttempted + b.fgAttempted,
    threeMade: a.threeMade + b.threeMade,
    threeAttempted: a.threeAttempted + b.threeAttempted,
    ftMade: a.ftMade + b.ftMade,
    ftAttempted: a.ftAttempted + b.ftAttempted,
  };
}
