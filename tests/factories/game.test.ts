import { describe, expect, it } from "vitest";
import { createTestGame } from "../factories/game";
import { asGameId } from "@/domain/ids";

describe("createTestGame", () => {
  it("builds a scheduled game with overrides", () => {
    const game = createTestGame({ id: asGameId("game_override") });
    expect(game.id).toBe("game_override");
    expect(game.status).toBe("scheduled");
  });
});
