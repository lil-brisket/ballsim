import { z } from "zod";
import type { GameState } from "@/state/game-state";
import { GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";

const gameStateEnvelopeSchema = z.object({
  meta: z.object({
    saveId: z.string().min(1),
    schemaVersion: z.number().int(),
    createdAt: z.string(),
    updatedAt: z.string(),
    rngSeed: z.number().int(),
    rngState: z.number().int().optional(),
  }),
  world: z.object({}).passthrough(),
  competition: z.object({}).passthrough(),
  business: z.object({}).passthrough(),
  user: z.object({}).passthrough(),
});

export function serializeGameState(state: GameState): string {
  return JSON.stringify(state);
}

export function deserializeGameState(stateJson: string): GameState {
  const parsed: unknown = JSON.parse(stateJson);
  const envelope = gameStateEnvelopeSchema.parse(parsed);

  if (envelope.meta.schemaVersion === 1) {
    return migrateV1ToV2(parsed as GameStateV1);
  }

  if (envelope.meta.schemaVersion !== GAME_STATE_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported GameState schemaVersion ${envelope.meta.schemaVersion}; expected ${GAME_STATE_SCHEMA_VERSION}.`,
    );
  }

  const state = parsed as GameState;
  if (typeof state.meta.rngState !== "number") {
    throw new Error("GameState meta.rngState is required for schemaVersion 2.");
  }

  return state;
}

type GameStateV1 = {
  meta: {
    saveId: string;
    schemaVersion: number;
    createdAt: string;
    updatedAt: string;
    rngSeed: number;
    rngState?: number;
  };
  world: GameState["world"];
  competition: GameState["competition"];
  business: GameState["business"];
  user: GameState["user"];
};

function migrateV1ToV2(state: GameStateV1): GameState {
  const players: GameState["world"]["players"] = {};
  for (const [playerId, player] of Object.entries(state.world.players)) {
    const legacy = player as {
      id: string;
      teamId: string | null;
      firstName: string;
      lastName: string;
      position: string;
      age: number;
      ratings?: { overall: number; offense: number; defense: number };
    };
    players[playerId] = {
      ...legacy,
      id: legacy.id as GameState["world"]["players"][string]["id"],
      teamId: legacy.teamId as GameState["world"]["players"][string]["teamId"],
      position: legacy.position as GameState["world"]["players"][string]["position"],
      ratings: legacy.ratings ?? {
        overall: 70,
        offense: 70,
        defense: 70,
      },
    };
  }

  const games: GameState["competition"]["games"] = {};
  for (const [gameId, game] of Object.entries(state.competition.games)) {
    const legacy = game as {
      id: string;
      seasonId: string;
      date: string;
      homeTeamId: string;
      awayTeamId: string;
      status: "scheduled" | "final";
      homeScore: number | null;
      awayScore: number | null;
      boxScore?: GameState["competition"]["games"][string]["boxScore"];
    };
    games[gameId] = {
      ...legacy,
      id: legacy.id as GameState["competition"]["games"][string]["id"],
      seasonId: legacy.seasonId as GameState["competition"]["games"][string]["seasonId"],
      homeTeamId: legacy.homeTeamId as GameState["competition"]["games"][string]["homeTeamId"],
      awayTeamId: legacy.awayTeamId as GameState["competition"]["games"][string]["awayTeamId"],
      boxScore: legacy.boxScore ?? null,
    };
  }

  return {
    meta: {
      saveId: state.meta.saveId as GameState["meta"]["saveId"],
      schemaVersion: GAME_STATE_SCHEMA_VERSION,
      createdAt: state.meta.createdAt,
      updatedAt: state.meta.updatedAt,
      rngSeed: state.meta.rngSeed,
      rngState: state.meta.rngState ?? state.meta.rngSeed,
    },
    world: {
      ...state.world,
      players,
    },
    competition: {
      ...state.competition,
      games,
    },
    business: state.business,
    user: state.user,
  };
}
