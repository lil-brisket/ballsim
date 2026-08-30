import {
  createEmptyPlayerHistory,
  createEmptyPlayerSeasonStatLine,
  addPlayerSeasonStatLines,
  type PlayerHistory,
  type PlayerSeasonRecord,
  type PlayerSeasonStatLine,
} from "@/domain/entities/player-history";
import type { Game, GamePlayerStats } from "@/domain/entities/game";
import {
  getContractSalaryForYear,
  isContractActive,
} from "@/domain/entities/contract";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { PlayerId } from "@/domain/ids";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { getPlayerSeasonGames } from "@/state/game-access";

/**
 * Archives finalized competition.games into business.gameArchive.
 * Idempotent: skips gameIds already present (does not overwrite).
 * Games remain in competition.games until initializeNewSeason.
 */
export function archiveCompletedSeasonGames(state: GameState): SystemResult {
  let archive = state.business.gameArchive;
  let changed = false;

  for (const game of Object.values(state.competition.games)) {
    if (game.status !== "final") {
      continue;
    }
    if (archive[game.id] !== undefined) {
      continue;
    }
    if (!changed) {
      archive = { ...archive };
      changed = true;
    }
    archive[game.id] = game;
  }

  if (!changed) {
    return systemResult(state);
  }

  return systemResult({
    ...state,
    business: {
      ...state.business,
      gameArchive: archive,
    },
  });
}

function accumulateStatLine(
  line: PlayerSeasonStatLine,
  row: GamePlayerStats,
): PlayerSeasonStatLine {
  return {
    games: line.games + 1,
    minutes: line.minutes + row.minutes,
    points: line.points + row.points,
    rebounds: line.rebounds + row.rebounds,
    assists: line.assists + row.assists,
    steals: line.steals + row.steals,
    blocks: line.blocks + row.blocks,
    turnovers: line.turnovers + row.turnovers,
    fgMade: line.fgMade + row.fieldGoalsMade,
    fgAttempted: line.fgAttempted + row.fieldGoalsAttempted,
    threeMade: line.threeMade + row.threePointersMade,
    threeAttempted: line.threeAttempted + row.threePointersAttempted,
    ftMade: line.ftMade + row.freeThrowsMade,
    ftAttempted: line.ftAttempted + row.freeThrowsAttempted,
  };
}

function aggregatePlayerSeasonLines(
  games: Game[],
  playerId: PlayerId,
): {
  regular: PlayerSeasonStatLine;
  playoffs: PlayerSeasonStatLine;
  combined: PlayerSeasonStatLine;
} {
  let regular = createEmptyPlayerSeasonStatLine();
  let playoffs = createEmptyPlayerSeasonStatLine();

  for (const game of games) {
    const row = game.playerStats.find((stat) => stat.playerId === playerId);
    if (!row) {
      continue;
    }
    if (game.competitionType === "playoffs") {
      playoffs = accumulateStatLine(playoffs, row);
    } else {
      regular = accumulateStatLine(regular, row);
    }
  }

  return {
    regular,
    playoffs,
    combined: addPlayerSeasonStatLines(regular, playoffs),
  };
}

/**
 * Eligible players: rostered at season end, active contract this year,
 * or appeared in any finalized game this season.
 */
function collectEligiblePlayerIds(state: GameState): Set<PlayerId> {
  const eligible = new Set<PlayerId>();
  const year = state.competition.season.year;
  const seasonId = state.competition.season.id;

  for (const team of Object.values(state.world.teams)) {
    for (const playerId of team.roster) {
      eligible.add(playerId);
    }
  }

  for (const contract of Object.values(state.business.contracts)) {
    if (isContractActive(contract, year)) {
      eligible.add(contract.playerId);
    }
  }

  for (const game of Object.values(state.competition.games)) {
    if (game.status !== "final" || game.seasonId !== seasonId) {
      continue;
    }
    for (const row of game.playerStats) {
      eligible.add(row.playerId);
    }
  }

  // Also check archive for this season (idempotent re-runs after games wiped)
  for (const game of Object.values(state.business.gameArchive)) {
    if (game.status !== "final" || game.seasonId !== seasonId) {
      continue;
    }
    for (const row of game.playerStats) {
      eligible.add(row.playerId);
    }
  }

  return eligible;
}

function buildPlayerSeasonRecord(
  state: GameState,
  playerId: PlayerId,
): PlayerSeasonRecord | null {
  const player = state.world.players[playerId];
  if (!player) {
    return null;
  }

  const season = state.competition.season;
  const games = getPlayerSeasonGames(state, playerId, season.id);
  const competition = aggregatePlayerSeasonLines(games, playerId);

  const contract = player.contractId
    ? state.business.contracts[player.contractId]
    : undefined;
  const salary =
    contract !== undefined
      ? (getContractSalaryForYear(contract, season.year) ?? null)
      : null;

  return {
    seasonId: season.id,
    seasonYear: season.year,
    age: player.age,
    overall: calculatePlayerOverall(player.position, player.attributes),
    attributes: { ...player.attributes },
    developmentStage: player.development.stage,
    injuryKind: player.availability,
    contractSnapshot: {
      contractId: player.contractId,
      salary,
      teamId: player.teamId,
    },
    competition,
  };
}

/**
 * Appends season-end snapshots for every rostered/contracted player.
 * Idempotent: skips players who already have a record for this seasonId.
 */
export function appendAllPlayerSeasonRecords(state: GameState): SystemResult {
  const seasonId = state.competition.season.id;
  const seasonYear = state.competition.season.year;
  const eligible = collectEligiblePlayerIds(state);

  let playerHistory: Record<string, PlayerHistory> = state.business.playerHistory;
  let changed = false;

  const sortedIds = [...eligible].sort();
  for (const playerId of sortedIds) {
    const existing = playerHistory[playerId];
    if (existing?.seasons.some((record) => record.seasonId === seasonId)) {
      continue;
    }

    const record = buildPlayerSeasonRecord(state, playerId);
    if (!record) {
      continue;
    }

    if (!changed) {
      playerHistory = { ...playerHistory };
      changed = true;
    }

    const prior = playerHistory[playerId] ?? createEmptyPlayerHistory(playerId);
    playerHistory[playerId] = {
      playerId,
      seasons: [...prior.seasons, record],
      trackingStartedSeasonYear:
        prior.trackingStartedSeasonYear ?? seasonYear,
    };
  }

  if (!changed) {
    return systemResult(state);
  }

  return systemResult({
    ...state,
    business: {
      ...state.business,
      playerHistory,
    },
  });
}
