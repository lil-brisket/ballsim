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

  if (envelope.meta.schemaVersion !== GAME_STATE_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported GameState schemaVersion ${envelope.meta.schemaVersion}; expected ${GAME_STATE_SCHEMA_VERSION}.`,
    );
  }

  return parsed as GameState;
}
