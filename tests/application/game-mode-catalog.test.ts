import { describe, expect, it } from "vitest";
import {
  getGameModeDefinition,
  listGameModeDefinitions,
  type GameModeCatalogId,
} from "@/application/game-mode-catalog";
import type { GameMode } from "@/state/game-state";

describe("game-mode-catalog", () => {
  it("lists owner as available and career/dynasty as coming soon", () => {
    const modes = listGameModeDefinitions();
    expect(modes.map((m) => m.id)).toEqual(["owner", "career", "dynasty"]);
    const owner = modes.find((m) => m.id === "owner");
    expect(owner?.available).toBe(true);
    expect(owner?.href).toBe("/new/setup?mode=owner");
    expect(modes.find((m) => m.id === "career")?.available).toBe(false);
    expect(modes.find((m) => m.id === "dynasty")?.available).toBe(false);
  });

  it("getGameModeDefinition accepts only persisted GameMode", () => {
    const mode: GameMode = "owner";
    const def = getGameModeDefinition(mode);
    expect(def.id).toBe("owner");
    expect(def.available).toBe(true);

    // Catalog-only ids exist on GameModeCatalogId but must not be passed here.
    const catalogOnly: GameModeCatalogId = "career";
    expect(catalogOnly).not.toBe(mode);
  });
});
