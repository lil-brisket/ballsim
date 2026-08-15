import type { GameState } from "@/state/game-state";

export type SaveGameSummary = {
  id: string;
  name: string;
  schemaVersion: number;
  createdAt: Date;
  updatedAt: Date;
};

export type LoadedSaveGame = SaveGameSummary & {
  state: GameState;
};

/**
 * Persistence port for save games. Application code depends on this
 * abstraction; adapters handle storage details.
 */
export type SaveGameStore = {
  list(): Promise<SaveGameSummary[]>;
  create(input: {
    id: string;
    name: string;
    state: GameState;
  }): Promise<LoadedSaveGame>;
  load(id: string): Promise<LoadedSaveGame | null>;
  save(input: { id: string; state: GameState }): Promise<LoadedSaveGame>;
};
