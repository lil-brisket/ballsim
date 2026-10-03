import { describe, expect, it } from "vitest";
import {
  groupLeagueScheduleRowsByDate,
  toLeagueScheduleView,
} from "@/state/league-schedule-selectors";
import { toLeagueInjuryBriefing } from "@/state/league-injury-selectors";
import { createTestGameState } from "../factories/game-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createSeededRng } from "@/domain/rng";
import { addCalendarDays } from "@/domain/calendar-date";
import { beginRegularSeasonFromPreseason } from "@/systems/simulation/season-lifecycle";
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
      expect(game.homeTeamId === teamId || game.awayTeamId === teamId).toBe(
        true,
      );
    }
  });

  it("lists every current-season final when status is final", () => {
    let state = createTestGameState({ saveId: "sched_finals" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    state = beginRegularSeasonFromPreseason(state).state;
    const currentDate = state.world.calendar.currentDate;
    const games = { ...state.competition.games };
    const ids = Object.keys(games).slice(0, 15);
    expect(ids.length).toBe(15);
    for (let index = 0; index < ids.length; index += 1) {
      const gameId = ids[index]!;
      const game = games[gameId]!;
      games[gameId] = {
        ...game,
        status: "final",
        date: addCalendarDays(currentDate, -(index + 1)),
        score: { home: 110, away: 100 },
      };
    }
    state = {
      ...state,
      competition: {
        ...state.competition,
        games,
      },
    };

    const capped = toLeagueScheduleView(state, {});
    expect(capped.recent.length).toBeLessThanOrEqual(12);

    const allFinals = toLeagueScheduleView(state, { status: "final" });
    expect(allFinals.recent.length).toBe(15);
    const grouped = groupLeagueScheduleRowsByDate(allFinals.recent);
    expect(grouped.length).toBeGreaterThan(0);
    expect(grouped.every((group) => group.games.length > 0)).toBe(true);
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
