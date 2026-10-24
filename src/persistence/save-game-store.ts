import type { SaveHistory } from "@/persistence/save-history";
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

export type SaveGameInput = {
  id: string;
  state: GameState;
  /**
   * Optimistic concurrency token from LoadedSaveGame.updatedAt at load time.
   * When set, the adapter must only commit if the stored row still matches.
   */
  ifUpdatedAt?: Date;
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
  /**
   * The league without its finished-season history (see save-history.ts):
   * enough for the simulation and every screen of the current season.
   */
  load(id: string): Promise<LoadedSaveGame | null>;
  /**
   * The history `save` kept out of the snapshot: archived games of seasons
   * before the previous one and older draft classes. Merge it with
   * `withSaveHistory` for views of finished seasons.
   */
  loadHistory(id: string): Promise<SaveHistory>;
  /** Splits off finished-season history and stores it once. */
  save(input: SaveGameInput): Promise<LoadedSaveGame>;
  /** true if a row was removed; false if the id was already gone. */
  delete(id: string): Promise<boolean>;
};
