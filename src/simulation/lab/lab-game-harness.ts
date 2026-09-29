import type { GameEvent } from "@/domain/entities/game";
import type { GameResult } from "@/domain/entities/game-result";
import {
  checkInvariants,
  eventsFromResult,
} from "@/simulation/lab/check-invariants";
import {
  labGamePlayerIds,
  labGameRosters,
  playLabGame,
  type LabGameSession,
} from "@/simulation/lab/lab-game-session";
import type { RawInvariantFailure } from "@/simulation/lab/types";
import { collectGameSnapshot } from "@/simulation/validation/collect-game-stats";
import type { GameSnapshot } from "@/simulation/validation/types";

export type LabPlayerStatRow = {
  playerId: string;
  points: number;
  rebounds: number;
  assists: number;
};

export type LabGameHarnessRecord = {
  gameIndex: number;
  gameSeed: number;
  snapshot: GameSnapshot | null;
  playerStats: LabPlayerStatRow[];
  rawFailures: RawInvariantFailure[];
  events: GameEvent[];
  overtimePeriodCount: number | null;
};

export function playerStatsFromResult(result: {
  playerStats: readonly {
    playerId: string;
    points: number;
    rebounds: number;
    assists: number;
  }[];
}): LabPlayerStatRow[] {
  return result.playerStats.map((row) => ({
    playerId: row.playerId,
    points: row.points,
    rebounds: row.rebounds,
    assists: row.assists,
  }));
}

export function playerStatsMapFromRows(
  rows: readonly LabPlayerStatRow[],
): Map<string, LabPlayerStatRow> {
  const map = new Map<string, LabPlayerStatRow>();
  for (const row of rows) {
    map.set(row.playerId, row);
  }
  return map;
}

export function harnessLabGame(
  session: LabGameSession,
  gameIndex: number,
  afterSimulateGame?: (result: GameResult) => GameResult,
): LabGameHarnessRecord {
  const played = playLabGame(session, gameIndex, afterSimulateGame);
  const ids = labGamePlayerIds(session, gameIndex);
  const rosters = labGameRosters(session, gameIndex);
  const rawFailures = checkInvariants(
    {
      result: played.result,
      homePlayers: rosters.homePlayers,
      awayPlayers: rosters.awayPlayers,
      homePlayerIds: ids.homePlayerIds,
      awayPlayerIds: ids.awayPlayerIds,
      rotation: session.rotation,
      thrown: played.thrown,
    },
    gameIndex,
    played.gameSeed,
  );
  if (played.result == null) {
    return {
      gameIndex,
      gameSeed: played.gameSeed,
      snapshot: null,
      playerStats: [],
      rawFailures,
      events: eventsFromResult(null),
      overtimePeriodCount: null,
    };
  }
  return {
    gameIndex,
    gameSeed: played.gameSeed,
    snapshot: collectGameSnapshot(played.result),
    playerStats: playerStatsFromResult(played.result),
    rawFailures,
    events: eventsFromResult(played.result),
    overtimePeriodCount: played.result.overtimePeriodCount,
  };
}
