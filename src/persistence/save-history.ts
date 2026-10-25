import type { DraftClass } from "@/domain/entities/draft";
import { isOpenOffer } from "@/domain/entities/free-agency-offer";
import type { Game } from "@/domain/entities/game";
import { buildGameArchiveIndex } from "@/domain/entities/game-archive-index";
import type { Player } from "@/domain/entities/player";
import type { PlayerHistory } from "@/domain/entities/player-history";
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
 *
 * Retired players leave too, two seasons after they retire: the full row
 * and the season records. `world.retiredPlayers` keeps a slim record (name,
 * number, career basis) in the snapshot for everything else.
 */
export type SaveHistory = {
  games: Record<string, Game>;
  drafts: Record<string, DraftClass>;
  /** Archived retired players' rows. Absent in chunks written before v81. */
  players?: Record<string, Player>;
  /** Archived retired players' season records. */
  playerHistory?: Record<string, PlayerHistory>;
};

/** One immutable piece of history: a season's games, a draft class or a retired player. */
export type SaveHistoryChunk = {
  /** `games:<seasonId>`, `draft:<draftClassId>` or `player:<playerId>`. */
  chunkId: string;
  history: SaveHistory;
};

export function createEmptySaveHistory(): SaveHistory {
  return { games: {}, drafts: {}, players: {}, playerHistory: {} };
}

/** Seasons a retired player's row stays in the snapshot after he retires. */
const RETIRED_PLAYER_HOT_SEASONS = 2;

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
 * Players the snapshot still points at, who therefore stay in
 * world.players: the references validateGameState checks.
 */
function referencedPlayerIds(state: GameState): Set<string> {
  const ids = new Set<string>();
  const year = state.competition.season.year;
  // Finished contracts and closed offers stay as history and may name an
  // archived player; running ones and open offers may not.
  for (const contract of Object.values(state.business.contracts)) {
    if (contract.endYear >= year) ids.add(contract.playerId);
  }
  for (const offer of Object.values(state.business.freeAgency.offers)) {
    if (isOpenOffer(offer.status)) ids.add(offer.playerId);
  }
  for (const team of Object.values(state.world.teams)) {
    for (const playerId of team.roster) ids.add(playerId);
  }
  for (const block of Object.values(state.business.tradeBlocks)) {
    for (const asset of block.assets) {
      if (asset.kind === "player") ids.add(asset.playerId);
    }
  }
  for (const entries of Object.values(state.business.deadMoney)) {
    for (const entry of entries) ids.add(entry.playerId);
  }
  for (const playerId of Object.keys(state.business.extensionTalks)) {
    ids.add(playerId);
  }
  for (const playerId of Object.keys(state.business.playerMorale)) {
    ids.add(playerId);
  }
  for (const playerId of Object.keys(state.business.developmentPlans)) {
    ids.add(playerId);
  }
  const games = [
    ...Object.values(state.competition.games),
    ...Object.values(state.competition.developmentLeague.games),
  ];
  for (const game of games) {
    for (const row of game.playerStats) ids.add(row.playerId);
    for (const event of game.events) {
      if (event.playerId != null) ids.add(event.playerId);
    }
  }
  return ids;
}

/** Hot drafts and the fantasy draft name players by id; those stay too. */
function mentionedInDrafts(
  drafts: Record<string, DraftClass>,
  fantasyDraftJson: string,
  playerId: string,
): boolean {
  for (const draft of Object.values(drafts)) {
    if (draft.prospects[playerId] !== undefined) return true;
    if (draft.selections.some((s) => s.playerId === playerId)) return true;
  }
  return fantasyDraftJson.includes(`"${playerId}"`);
}

/**
 * Splits off history older than the hot window: archived games of seasons
 * at least two before the current one, completed draft classes older than
 * the current season, and players retired at least two seasons ago whom
 * nothing in the snapshot still references. Games whose season is not in
 * the franchise history stay in the snapshot. `archivePlayers: false`
 * keeps every player (the stores' fallback if a reference was missed).
 */
export function splitColdHistory(
  state: GameState,
  options: { archivePlayers?: boolean } = {},
): {
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

  // One chunk per retired player: whether he can leave depends on what
  // still points at him, so players who retired together may leave apart.
  const hotPlayers: Record<string, Player> = { ...state.world.players };
  const hotPlayerHistory: Record<string, PlayerHistory> = {
    ...state.business.playerHistory,
  };
  let movedPlayers = false;
  if (options.archivePlayers !== false) {
    const due = Object.values(state.world.retiredPlayers)
      .filter(
        (record) =>
          record.retiredSeasonYear <= year - RETIRED_PLAYER_HOT_SEASONS &&
          state.world.players[record.id]?.retired === true,
      )
      .map((record) => record.id)
      .sort();
    if (due.length > 0) {
      const referenced = referencedPlayerIds(state);
      const fantasyDraftJson = JSON.stringify(state.world.fantasyDraft ?? null);
      for (const playerId of due) {
        if (
          referenced.has(playerId) ||
          mentionedInDrafts(hotDrafts, fantasyDraftJson, playerId)
        ) {
          continue;
        }
        const chunk = chunkFor(`player:${playerId}`);
        chunk.players![playerId] = hotPlayers[playerId]!;
        delete hotPlayers[playerId];
        const history = hotPlayerHistory[playerId];
        if (history !== undefined) {
          chunk.playerHistory![playerId] = history;
          delete hotPlayerHistory[playerId];
        }
        movedPlayers = true;
      }
    }
  }

  if (!movedGames && !movedDrafts && !movedPlayers) {
    return { hot: state, chunks: [] };
  }
  const hot: GameState = {
    ...state,
    world: {
      ...state.world,
      drafts: movedDrafts ? hotDrafts : state.world.drafts,
      players: movedPlayers ? hotPlayers : state.world.players,
    },
    business: {
      ...state.business,
      playerHistory: movedPlayers
        ? hotPlayerHistory
        : state.business.playerHistory,
      ...(movedGames
        ? {
            gameArchive: hotGames,
            gameArchiveIndex: buildGameArchiveIndex(hotGames),
          }
        : {}),
    },
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
    Object.assign(merged.players!, chunk.players ?? {});
    Object.assign(merged.playerHistory!, chunk.playerHistory ?? {});
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
  const players = history.players ?? {};
  const playerHistory = history.playerHistory ?? {};
  if (
    Object.keys(history.games).length === 0 &&
    Object.keys(history.drafts).length === 0 &&
    Object.keys(players).length === 0 &&
    Object.keys(playerHistory).length === 0
  ) {
    return state;
  }
  const gameArchive = { ...history.games, ...state.business.gameArchive };
  return {
    ...state,
    world: {
      ...state.world,
      drafts: { ...history.drafts, ...state.world.drafts },
      players: { ...players, ...state.world.players },
    },
    business: {
      ...state.business,
      playerHistory: { ...playerHistory, ...state.business.playerHistory },
      gameArchive,
      gameArchiveIndex: buildGameArchiveIndex(gameArchive),
    },
  };
}

/**
 * Split for a write and prepare (serialize + validate) the snapshot. A
 * retired player who is still referenced somewhere the guard above does
 * not know about would fail validation; the write then keeps every player
 * in the snapshot instead of failing.
 */
export function splitForStorage(
  state: GameState,
  prepare: (hot: GameState) => string,
  options: { archivePlayers?: boolean } = {},
): { stateJson: string; chunks: SaveHistoryChunk[] } {
  const split = splitColdHistory(state, options);
  try {
    return { stateJson: prepare(split.hot), chunks: split.chunks };
  } catch (error) {
    if (!split.chunks.some((chunk) => chunk.chunkId.startsWith("player:"))) {
      throw error;
    }
    const kept = splitColdHistory(state, { archivePlayers: false });
    return { stateJson: prepare(kept.hot), chunks: kept.chunks };
  }
}
