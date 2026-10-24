import type { DraftClass } from "@/domain/entities/draft";
import type { Game } from "@/domain/entities/game";
import { buildGameArchiveIndex } from "@/domain/entities/game-archive-index";
import type { GameState } from "@/state/game-state";

/**
 * Finished-season history kept out of the per-action snapshot.
 *
 * Every owner action loads and saves the whole league. Archived box scores
 * (about 2 MB a season) and completed draft classes (about 0.6 MB each)
 * would make that snapshot grow for the whole career, so the stores keep
 * them in separate chunks, written once and never rewritten, and load them
 * only for the pages that show deep history.
 *
 * The current and the previous season stay in the snapshot, with the most
 * recent completed draft class: the simulation never reads further back,
 * and "last season" is on many screens.
 */
export type SaveHistory = {
  games: Record<string, Game>;
  drafts: Record<string, DraftClass>;
};

/** One immutable piece of history: a season's games or one draft class. */
export type SaveHistoryChunk = {
  /** `games:<seasonId>` or `draft:<draftClassId>`. */
  chunkId: string;
  history: SaveHistory;
};

export function createEmptySaveHistory(): SaveHistory {
  return { games: {}, drafts: {} };
}

/** Season ids of finished seasons, from the franchise history records. */
function seasonYearsById(state: GameState): Map<string, number> {
  const years = new Map<string, number>();
  for (const history of Object.values(state.business.franchiseHistory)) {
    for (const season of history.seasons) {
      years.set(season.seasonId, season.seasonYear);
    }
  }
  return years;
}

/**
 * Splits off history older than the hot window: archived games of seasons
 * at least two before the current one, and completed draft classes older
 * than the current season. Games whose season is not in the franchise
 * history stay in the snapshot.
 */
export function splitColdHistory(state: GameState): {
  hot: GameState;
  chunks: SaveHistoryChunk[];
} {
  const year = state.competition.season.year;
  const years = seasonYearsById(state);
  const chunksById = new Map<string, SaveHistory>();
  const chunkFor = (chunkId: string): SaveHistory => {
    let chunk = chunksById.get(chunkId);
    if (chunk === undefined) {
      chunk = createEmptySaveHistory();
      chunksById.set(chunkId, chunk);
    }
    return chunk;
  };

  const hotGames: Record<string, Game> = {};
  let movedGames = false;
  for (const gameId of Object.keys(state.business.gameArchive).sort()) {
    const game = state.business.gameArchive[gameId]!;
    const seasonYear = years.get(game.seasonId);
    if (seasonYear !== undefined && seasonYear <= year - 2) {
      chunkFor(`games:${game.seasonId}`).games[gameId] = game;
      movedGames = true;
    } else {
      hotGames[gameId] = game;
    }
  }

  const hotDrafts: Record<string, DraftClass> = {};
  let movedDrafts = false;
  for (const draftId of Object.keys(state.world.drafts).sort()) {
    const draft = state.world.drafts[draftId]!;
    if (draft.status === "complete" && draft.seasonYear < year) {
      chunkFor(`draft:${draftId}`).drafts[draftId] = draft;
      movedDrafts = true;
    } else {
      hotDrafts[draftId] = draft;
    }
  }

  if (!movedGames && !movedDrafts) {
    return { hot: state, chunks: [] };
  }
  const hot: GameState = {
    ...state,
    world: movedDrafts ? { ...state.world, drafts: hotDrafts } : state.world,
    business: movedGames
      ? {
          ...state.business,
          gameArchive: hotGames,
          gameArchiveIndex: buildGameArchiveIndex(hotGames),
        }
      : state.business,
  };
  const chunks = [...chunksById.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([chunkId, history]) => ({ chunkId, history }));
  return { hot, chunks };
}

/** Merges stored history chunks into one history. */
export function mergeSaveHistory(chunks: readonly SaveHistory[]): SaveHistory {
  const merged = createEmptySaveHistory();
  for (const chunk of chunks) {
    Object.assign(merged.games, chunk.games);
    Object.assign(merged.drafts, chunk.drafts);
  }
  return merged;
}

/**
 * The league with its stored history put back, for views that show
 * finished seasons. Entries already in the snapshot win.
 */
export function withSaveHistory(
  state: GameState,
  history: SaveHistory,
): GameState {
  if (
    Object.keys(history.games).length === 0 &&
    Object.keys(history.drafts).length === 0
  ) {
    return state;
  }
  const gameArchive = { ...history.games, ...state.business.gameArchive };
  return {
    ...state,
    world: {
      ...state.world,
      drafts: { ...history.drafts, ...state.world.drafts },
    },
    business: {
      ...state.business,
      gameArchive,
      gameArchiveIndex: buildGameArchiveIndex(gameArchive),
    },
  };
}
