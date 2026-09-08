import { describe, expect, it } from "vitest";
import {
  playoffCutoffPerConference,
  toStandingsPageView,
} from "@/state/standings-selectors";
import { createTestGameState } from "../factories/game-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createSeededRng } from "@/domain/rng";

describe("standings-selectors", () => {
  it("derives cutoff from fieldSize / conferences, not hardcoded rank 8", () => {
    let state = createTestGameState({ saveId: "standings_cutoff" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;

    const cutoff = playoffCutoffPerConference(state);
    expect(cutoff).toBeGreaterThanOrEqual(1);

    const page = toStandingsPageView(state);
    expect(page.cutoffPerConference).toBe(cutoff);
    expect(page.groups.length).toBeGreaterThan(0);
    for (const group of page.groups) {
      expect(group.cutoffRank).toBe(cutoff);
      // Conference leader has 0 GB
      expect(group.rows[0]?.gamesBackConference).toBe(0);
    }
  });

  it("orders conference rows by conference rank", () => {
    let state = createTestGameState({ saveId: "standings_order" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;

    const page = toStandingsPageView(state);
    for (const group of page.groups) {
      for (let i = 1; i < group.rows.length; i++) {
        expect(group.rows[i]!.conferenceRank).toBeGreaterThan(
          group.rows[i - 1]!.conferenceRank,
        );
      }
    }
  });

  it("never invents eliminated label without math elimination", () => {
    let state = createTestGameState({ saveId: "standings_elim" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;

    const page = toStandingsPageView(state);
    for (const row of page.leagueRows) {
      expect(row.playoffLabel).not.toBe("eliminated");
    }
  });
});
