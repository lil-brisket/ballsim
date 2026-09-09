import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createTestGameState } from "../factories/game-state";
import {
  sortDlProspects,
  toDevelopmentLeagueDashboardView,
  type DlProspectRowView,
} from "@/state/development-league-selectors";

describe("development-league-selectors", () => {
  it("builds Franchise Development League view with pipeline sections", () => {
    let state = createTestGameState({ saveId: "dl_hub_test" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;

    const view = toDevelopmentLeagueDashboardView(state);
    expect(view.saveId).toBe("dl_hub_test");
    expect(view.teamName.length).toBeGreaterThan(0);
    expect(view.prospects.length).toBe(
      view.recallCandidates.length + view.developingProspects.length,
    );
    expect(view.recentResults).toBeDefined();
  });

  it("sorts ready for recall before developing", () => {
    const rows: DlProspectRowView[] = [
      {
        playerId: "a",
        name: "Developing",
        overall: 80,
        potential: 88,
        age: 20,
        dlSeason: 1,
        seasonsRemaining: 2,
        role: "development",
        mpg: 28,
        ppg: 18,
        rpg: 5,
        apg: 3,
        readiness: "developing",
        whyBullets: [],
      },
      {
        playerId: "b",
        name: "Ready",
        overall: 75,
        potential: 85,
        age: 22,
        dlSeason: 2,
        seasonsRemaining: 1,
        role: "starter",
        mpg: 32,
        ppg: 12,
        rpg: 4,
        apg: 5,
        readiness: "ready",
        whyBullets: [],
      },
    ];
    expect(sortDlProspects(rows)[0]!.playerId).toBe("b");
  });
});
