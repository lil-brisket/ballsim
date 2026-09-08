import { describe, expect, it } from "vitest";
import { toLeagueScheduleView } from "@/state/league-schedule-selectors";
import { toLeagueInjuryBriefing } from "@/state/league-injury-selectors";
import { createTestGameState } from "../factories/game-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createSeededRng } from "@/domain/rng";
import {
  mediaPresentationTier,
  pickFeaturedStoryId,
} from "@/components/media-hub/media-importance-tiers";

describe("league-schedule-selectors", () => {
  it("returns today / upcoming / recent slices", () => {
    let state = createTestGameState({ saveId: "sched_test" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;

    const view = toLeagueScheduleView(state, {});
    expect(view.focusDate).toBe(state.world.calendar.currentDate);
    expect(Array.isArray(view.today)).toBe(true);
    expect(Array.isArray(view.upcoming)).toBe(true);
    expect(Array.isArray(view.recent)).toBe(true);
    expect(view.teams.length).toBeGreaterThan(0);
  });

  it("filters by team", () => {
    let state = createTestGameState({ saveId: "sched_team" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;

    const teamId = state.user.activeOwnerTeamId;
    const view = toLeagueScheduleView(state, { teamId });
    for (const game of [...view.today, ...view.upcoming, ...view.recent]) {
      expect(
        game.homeTeamId === teamId || game.awayTeamId === teamId,
      ).toBe(true);
    }
  });
});

describe("league-injury-selectors", () => {
  it("returns a bounded list", () => {
    let state = createTestGameState({ saveId: "injury_brief" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;

    const rows = toLeagueInjuryBriefing(state, 3);
    expect(rows.length).toBeLessThanOrEqual(3);
  });
});

describe("media-importance-tiers", () => {
  it("maps importance to presentation tiers", () => {
    expect(mediaPresentationTier("critical")).toBe("major");
    expect(mediaPresentationTier("high")).toBe("major");
    expect(mediaPresentationTier("medium")).toBe("normal");
    expect(mediaPresentationTier("low")).toBe("background");
  });

  it("picks featured from major stories only", () => {
    const id = pickFeaturedStoryId([
      {
        id: "a",
        importance: "low",
        relevanceScore: 99,
        occurredOn: "2026-01-02",
      },
      {
        id: "b",
        importance: "high",
        relevanceScore: 10,
        occurredOn: "2026-01-01",
      },
    ]);
    expect(id).toBe("b");
  });
});
