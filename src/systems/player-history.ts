import {
  createEmptyPlayerHistory,
  type PlayerHistory,
  type PlayerSeasonRecord,
} from "@/domain/entities/player-history";
import type { Game } from "@/domain/entities/game";
import {
  aggregatePlayerGames,
  toPlayerSeasonStatLine,
} from "@/domain/player-stat-aggregation";
import {
  getContractSalaryForYear,
  isContractActive,
} from "@/domain/entities/contract";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { PlayerId } from "@/domain/ids";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { getPlayerSeasonGames } from "@/state/game-access";
import {
  buildGameArchiveIndex,
  indexArchivedGame,
} from "@/domain/entities/game-archive-index";

/**
 * Archives finalized competition.games into business.gameArchive.
 * Idempotent: skips gameIds already present (does not overwrite).
 * Play-by-play and rotation traces are dropped on archive — box scores remain
 * the source of player history. Games remain in competition.games until
 * initializeNewSeason.
 */
export function archiveCompletedSeasonGames(state: GameState): SystemResult {
  let archive = state.business.gameArchive;
  let index =
    state.business.gameArchiveIndex ??
    buildGameArchiveIndex(state.business.gameArchive);
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
    archive[game.id] = compactGameForArchive(game);
    index = indexArchivedGame(index, archive[game.id]!);
  }

  if (!changed) {
    return systemResult(state);
  }

  return systemResult({
    ...state,
    business: {
      ...state.business,
      gameArchive: archive,
      gameArchiveIndex: index,
    },
  });
}

export function compactGameForArchive(game: Game): Game {
  return {
    ...game,
    events: [],
    rotationMeta: null,
    periodScores: (game.periodScores ?? []).map((period) => ({ ...period })),
    playerStats: (game.playerStats ?? []).map((row) => ({
      ...row,
      firstName: null,
      lastName: null,
    })),
    homeTeamSnapshot: game.homeTeamSnapshot
      ? {
          ...game.homeTeamSnapshot,
        }
      : null,
    awayTeamSnapshot: game.awayTeamSnapshot
      ? {
          ...game.awayTeamSnapshot,
        }
      : null,
  };
}

/** Season-end lines in the persisted shape; classification lives in player-stat-aggregation. */
function aggregatePlayerSeasonLines(
  games: Game[],
  playerId: PlayerId,
): PlayerSeasonRecord["competition"] {
  const buckets = aggregatePlayerGames(games, playerId);
  return {
    regular: toPlayerSeasonStatLine(buckets.regular),
    playoffs: toPlayerSeasonStatLine(buckets.playoffs),
    development: toPlayerSeasonStatLine(buckets.development),
    combined: toPlayerSeasonStatLine(buckets.combined),
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

  for (const player of Object.values(state.world.players)) {
    if (
      player.teamId != null &&
      player.developmentLeague?.status === "assigned"
    ) {
      eligible.add(player.id);
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

  for (const game of Object.values(
    state.competition.developmentLeague?.games ?? {},
  )) {
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

  let playerHistory: Record<string, PlayerHistory> =
    state.business.playerHistory;
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
      trackingStartedSeasonYear: prior.trackingStartedSeasonYear ?? seasonYear,
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
