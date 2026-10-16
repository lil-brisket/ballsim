import { describe, expect, it } from "vitest";
import {
  createEmptyGameArchiveIndex,
  indexArchivedGame,
} from "@/domain/entities/game-archive-index";
import { asGameId } from "@/domain/ids";
import { createTestGame } from "../factories/game";

describe("indexArchivedGame", () => {
  it("adds the game to its season without changing the previous index", () => {
    const first = indexArchivedGame(
      createEmptyGameArchiveIndex(),
      createTestGame({ id: asGameId("game_b") }),
    );
    const second = indexArchivedGame(
      first,
      createTestGame({ id: asGameId("game_a") }),
    );

    expect(second.bySeasonId["season_test"]).toEqual(["game_a", "game_b"]);
    expect(first.bySeasonId["season_test"]).toEqual(["game_b"]);
  });
});
