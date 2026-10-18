import type { GameState } from "@/state/game-state";
import type { GameStateV66 } from "@/persistence/mappers/game-state-migrations/v66-v75";
import type { Game } from "@/domain/entities/game";
import { createEmptyAwardHistory } from "@/domain/entities/awards";
import { asSeasonId } from "@/domain/ids";
import { createEmptyGameDayPromotionSeasonState } from "@/domain/entities/game-day-promotion";
import {
  createEmptyMediaFeed,
  createEmptyMediaReadState,
} from "@/domain/entities/media-item";
import { createEmptySocialFeed } from "@/domain/entities/social-post";
import { createEmptySeasonEventsState } from "@/domain/entities/season-events";
import { compactGameForArchive } from "@/systems/player-history";
import { buildGameArchiveIndex } from "@/domain/entities/game-archive-index";
import { ensurePlayerPortraits } from "@/systems/portraits/assign-player-portraits";

export type GameStateV56 = Omit<GameState, "meta" | "business"> & {
  meta: Omit<GameState["meta"], "schemaVersion"> & { schemaVersion: 56 };
  business: Omit<GameState["business"], "awards"> & {
    awards?: GameState["business"]["awards"];
  };
};

export type GameStateV57 = Omit<GameState, "meta" | "business"> & {
  meta: Omit<GameState["meta"], "schemaVersion"> & { schemaVersion: 57 };
  business: Omit<GameState["business"], "gameDayPromotionsByTeamId"> & {
    gameDayPromotionsByTeamId?: GameState["business"]["gameDayPromotionsByTeamId"];
  };
};

export type GameStateV58 = Omit<GameState, "meta"> & {
  meta: Omit<GameState["meta"], "schemaVersion"> & { schemaVersion: 58 };
};

type OwnedFranchiseStateV59 = Omit<
  GameState["user"]["ownedFranchises"][string],
  "mediaFeed" | "socialFeed" | "mediaReadState"
>;

export type GameStateV59 = Omit<GameState, "meta" | "user"> & {
  meta: Omit<GameState["meta"], "schemaVersion"> & { schemaVersion: 59 };
  user: Omit<GameState["user"], "ownedFranchises"> & {
    ownedFranchises: Record<string, OwnedFranchiseStateV59>;
  };
};

function patchPlayerStatsStarted(
  games: Record<string, Game>,
): Record<string, Game> {
  const next: Record<string, Game> = {};
  for (const [gameId, game] of Object.entries(games)) {
    next[gameId] = {
      ...game,
      playerStats: game.playerStats.map((row) => ({
        ...row,
        started:
          typeof (row as { started?: unknown }).started === "boolean"
            ? (row as { started: boolean }).started
            : false,
      })),
    };
  }
  return next;
}

/**
 * Deterministic v56 → v57: awards history store + GamePlayerStats.started.
 */
export function migrateV56ToV57(state: GameStateV56): GameStateV57 {
  const competitionGames = patchPlayerStatsStarted(state.competition.games);
  const dlGames = patchPlayerStatsStarted(
    state.competition.developmentLeague?.games ?? {},
  );
  const archiveGames = patchPlayerStatsStarted(
    state.business.gameArchive ?? {},
  );

  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 57,
    },
    competition: {
      ...state.competition,
      games: competitionGames,
      developmentLeague: {
        ...state.competition.developmentLeague,
        games: dlGames,
      },
    },
    business: {
      ...state.business,
      gameArchive: archiveGames,
      awards: state.business.awards ?? createEmptyAwardHistory(),
    },
  };
}

/**
 * Deterministic v57 → v58: empty game-day promotion season state per team.
 */
export function migrateV57ToV58(state: GameStateV57): GameStateV58 {
  const seasonId = asSeasonId(state.competition.season.id);
  const gameDayPromotionsByTeamId: GameState["business"]["gameDayPromotionsByTeamId"] =
    { ...(state.business.gameDayPromotionsByTeamId ?? {}) };
  for (const teamId of Object.keys(state.world.teams).sort()) {
    if (!gameDayPromotionsByTeamId[teamId]) {
      gameDayPromotionsByTeamId[teamId] =
        createEmptyGameDayPromotionSeasonState(seasonId);
    }
  }

  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 58,
    },
    business: {
      ...state.business,
      gameDayPromotionsByTeamId,
    },
  };
}

/**
 * Deterministic v58 → v59: normalize trade offer payloads for multi-offer queue.
 */
export function migrateV58ToV59(state: GameStateV58): GameStateV59 {
  const pendingOwnerDecisions = state.user.pendingOwnerDecisions.map(
    (decision) => {
      const proposal = decision.payload.proposal;
      const createdOn = decision.createdOn;
      return {
        ...decision,
        payload: {
          ...decision.payload,
          offerId: decision.id,
          originalProposal: proposal,
          currentProposal: proposal,
          negotiationHistory: decision.payload.negotiationHistory ?? [
            {
              proposedByTeamId: decision.payload.offeringTeamId,
              proposal,
              proposedOn: createdOn,
            },
          ],
          status: decision.payload.status ?? "pending",
          createdOn,
          expiresOn: decision.payload.expiresOn,
          motivation: decision.payload.motivation,
        },
      };
    },
  );

  const ownerDecisionHistory = state.user.ownerDecisionHistory.map((record) => {
    const proposal = record.payload.proposal;
    return {
      ...record,
      payload: {
        ...record.payload,
        offerId: record.payload.offerId ?? record.id,
        originalProposal: record.payload.originalProposal ?? proposal,
        currentProposal: record.payload.currentProposal ?? proposal,
        negotiationHistory: record.payload.negotiationHistory ?? [],
        status:
          record.payload.status ??
          (record.status === "accepted"
            ? "accepted"
            : record.status === "expired"
              ? "expired"
              : "declined"),
        createdOn: record.payload.createdOn ?? record.createdOn,
        expiresOn: record.payload.expiresOn,
        motivation: record.payload.motivation,
      },
    };
  });

  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 59,
    },
    user: {
      ...state.user,
      pendingOwnerDecisions,
      ownerDecisionHistory,
    },
  };
}

/**
 * Deterministic v59 → v60: seed empty Media Hub feeds on every owned franchise.
 */
export function migrateV59ToV60(state: GameStateV59): GameStateV60 {
  const ownedFranchises: GameState["user"]["ownedFranchises"] = {};
  for (const teamId of Object.keys(state.user.ownedFranchises).sort()) {
    const franchise = state.user.ownedFranchises[teamId]!;
    ownedFranchises[teamId] = {
      ...franchise,
      mediaFeed: createEmptyMediaFeed(),
      socialFeed: createEmptySocialFeed(),
      mediaReadState: createEmptyMediaReadState(),
    };
  }

  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 60,
    },
    user: {
      ...state.user,
      ownedFranchises,
    },
  };
}

export type GameStateV60 = Omit<GameState, "meta" | "competition"> & {
  meta: Omit<GameState["meta"], "schemaVersion"> & { schemaVersion: 60 };
  competition: Omit<GameState["competition"], "seasonEvents">;
};

export type GameStateV61 = Omit<GameState, "meta" | "user"> & {
  meta: Omit<GameState["meta"], "schemaVersion"> & { schemaVersion: 61 };
  user: Omit<GameState["user"], "pendingDraftClassDecisions">;
};

/**
 * Deterministic v60 → v61: empty seasonEvents framework on competition.
 */
export function migrateV60ToV61(state: GameStateV60): GameStateV61 {
  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 61,
    },
    competition: {
      ...state.competition,
      seasonEvents: createEmptySeasonEventsState(),
    },
  } as GameStateV61;
}

/**
 * Deterministic v61 → v62: empty pendingDraftClassDecisions on user.
 */
export function migrateV61ToV62(state: GameStateV61): GameStateV62 {
  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 62,
    },
    user: {
      ...state.user,
      pendingDraftClassDecisions: {},
    },
  } as GameStateV62;
}

export type GameStateV62 = Omit<GameState, "meta"> & {
  meta: Omit<GameState["meta"], "schemaVersion"> & { schemaVersion: 62 };
};

export type GameStateV63 = Omit<GameState, "meta"> & {
  meta: Omit<GameState["meta"], "schemaVersion"> & { schemaVersion: 63 };
};

export function migrateV62ToV63(state: GameStateV62): GameStateV63 {
  const franchiseOps: GameState["business"]["franchiseOps"] = {};
  for (const [teamId, ops] of Object.entries(state.business.franchiseOps)) {
    const record = ops as GameState["business"]["franchiseOps"][string] & {
      homeFillSeries?: number[];
    };
    franchiseOps[teamId] = {
      ...record,
      homeFillSeries: Array.isArray(record.homeFillSeries)
        ? record.homeFillSeries
        : [],
    };
  }
  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 63,
    },
    business: {
      ...state.business,
      franchiseOps,
    },
  } as GameStateV63;
}

export function migrateV63ToV64(state: GameStateV63): GameStateV64 {
  const gameArchive: GameState["business"]["gameArchive"] = {};
  for (const [gameId, game] of Object.entries(
    state.business.gameArchive ?? {},
  )) {
    gameArchive[gameId] = compactGameForArchive(game as Game);
  }
  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 64,
    },
    business: {
      ...state.business,
      gameArchive,
      gameArchiveIndex: buildGameArchiveIndex(gameArchive),
    },
  };
}

export type GameStateV64 = Omit<GameState, "meta" | "world"> & {
  meta: Omit<GameState["meta"], "schemaVersion"> & { schemaVersion: 64 };
  world: Omit<GameState["world"], "playerPortraits">;
};

/**
 * Deterministic v64 → v65: add world.playerPortraits and backfill every
 * player / prospect via ensurePlayerPortraits (pure; no RNG, no I/O).
 * Repeated loads of an un-resaved legacy save yield identical portraits.
 */
export function migrateV64ToV65(state: GameStateV64): GameStateV65 {
  // ensurePlayerPortraits is typed on the current GameState; the v65 shape
  // only lacks competition.playByPlay, which it never reads or writes.
  const withRegistry = {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 65,
    },
    world: {
      ...state.world,
      playerPortraits: {},
    },
    competition: { ...state.competition, playByPlay: {} },
  } as GameState;
  const migrated = ensurePlayerPortraits(withRegistry).state;
  const { playByPlay: _dropped, ...competition } = migrated.competition;
  void _dropped;
  return {
    ...migrated,
    meta: { ...migrated.meta, schemaVersion: 65 },
    competition,
  };
}

export type GameStateV65 = Omit<GameState, "meta" | "competition"> & {
  meta: Omit<GameState["meta"], "schemaVersion"> & { schemaVersion: 65 };
  competition: Omit<GameState["competition"], "playByPlay" | "aiTradeSearch">;
};

/**
 * Deterministic v65 → v66: add competition.playByPlay (empty; legacy games
 * have no recorded log). Thin Game.events already saved are left as-is; new
 * games stop writing them.
 */
export function migrateV65ToV66(state: GameStateV65): GameStateV66 {
  return {
    ...state,
    meta: {
      ...state.meta,
      schemaVersion: 66,
    },
    competition: {
      ...state.competition,
      playByPlay: {},
    },
  };
}
