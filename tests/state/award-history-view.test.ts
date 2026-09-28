import { describe, expect, it } from "vitest";
import { asSeasonId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import {
  toAwardHistoryView,
  toCurrentSeasonAwardGroups,
  type CurrentSeasonAwardSlot,
} from "@/state/awards-hub-selectors";
import { addPlayerToState, createAwardsTestState } from "../systems/awards/helpers";
import { awardResult, teamIds, withAwards } from "./history-fixtures";

function slot(
  state: GameState,
  awardId: string,
): CurrentSeasonAwardSlot | undefined {
  return toCurrentSeasonAwardGroups(state)
    .flatMap((group) => group.slots)
    .find((s) => s.awardId === awardId);
}

function withMidseason(
  state: GameState,
  status: "scheduled" | "announced" | "cancelled",
  currentDate: string,
): GameState {
  return {
    ...state,
    world: {
      ...state.world,
      calendar: { ...state.world.calendar, currentDate },
    },
    competition: {
      ...state.competition,
      seasonEvents: {
        ...state.competition.seasonEvents,
        midseasonAwards: {
          seasonId: state.competition.season.id,
          cutoffDate: "2026-01-15",
          announceDate: "2026-01-20",
          status,
          resultIds: [],
        },
      },
    },
  };
}

describe("toAwardHistoryView", () => {
  it("only lists completed results and sorts seasons descending", () => {
    let state = createAwardsTestState({ seasonYear: 2028 });
    const [teamA] = teamIds(state);
    state = addPlayerToState(state, "p1", teamA!);
    state = withAwards(state, [
      awardResult({ awardId: "mvp", seasonYear: 2026, winnerId: "p1", teamId: teamA }),
      awardResult({ awardId: "mvp", seasonYear: 2027, winnerId: "p1", teamId: teamA }),
      awardResult({ awardId: "midseason_mvp", seasonYear: 2028, winnerId: "p1" }),
    ]);

    const view = toAwardHistoryView(state, { seasonYear: "all" });
    expect(view.availableSeasons).toEqual([2028, 2027, 2026]);
    expect(view.seasons.map((s) => s.seasonYear)).toEqual([2028, 2027, 2026]);
    expect(view.seasons[0]!.yearlyByAwardId.mvp).toBeUndefined();
    expect(view.seasons[1]!.yearlyByAwardId.mvp?.winnerName).toBe("p1 Player");
  });

  it("defaults to the most recent completed season, not an in-progress one", () => {
    let state = createAwardsTestState({ seasonYear: 2028 });
    state = withAwards(state, [
      awardResult({ awardId: "mvp", seasonYear: 2027, winnerId: "p1" }),
      awardResult({ awardId: "midseason_mvp", seasonYear: 2028, winnerId: "p1" }),
    ]);
    const view = toAwardHistoryView(state);
    expect(view.selectedSeason).toBe(2027);
    expect(view.seasons).toHaveLength(1);
  });

  it("keeps midseason and full-season awards distinguishable", () => {
    let state = createAwardsTestState({ seasonYear: 2026, phase: "playoffs" });
    state = withAwards(state, [
      awardResult({ awardId: "mvp", seasonYear: 2026, winnerId: "p1" }),
      awardResult({ awardId: "midseason_mvp", seasonYear: 2026, winnerId: "p2" }),
    ]);
    const season = toAwardHistoryView(state).seasons[0]!;
    expect(season.yearlyByAwardId.mvp?.winnerSubjectId).toBe("p1");
    expect(season.yearlyByAwardId.midseason_mvp).toBeUndefined();
    const midseason = season.winners.find((w) => w.awardId === "midseason_mvp");
    expect(midseason?.result.period).toBe("midseason");
    expect(midseason?.tier).toBe("midseason");
  });

  it("filters to a single award without turning it into a column", () => {
    let state = createAwardsTestState({ seasonYear: 2026, phase: "playoffs" });
    state = withAwards(state, [
      awardResult({ awardId: "mvp", seasonYear: 2026, winnerId: "p1" }),
      awardResult({
        awardId: "player_of_month",
        seasonYear: 2026,
        winnerId: "p2",
        period: "2026-01",
      }),
    ]);
    const view = toAwardHistoryView(state, { awardId: "player_of_month" });
    expect(view.awardFilter).toBe("player_of_month");
    expect(view.seasons[0]!.winners.map((w) => w.awardId)).toEqual([
      "player_of_month",
    ]);
    expect(view.pivotAwardIds).not.toContain("player_of_month");
  });

  it("returns an empty view when no awards exist", () => {
    const view = toAwardHistoryView(createAwardsTestState());
    expect(view.hasHistory).toBe(false);
    expect(view.selectedSeason).toBeNull();
    expect(view.seasons).toEqual([]);
  });
});

describe("toCurrentSeasonAwardGroups", () => {
  it("marks yearly majors not_started in preseason and pending in regular season", () => {
    const pre = createAwardsTestState({ phase: "preseason" });
    expect(slot(pre, "mvp")?.status).toBe("not_started");
    const regular = createAwardsTestState({ phase: "regular" });
    expect(slot(regular, "mvp")?.status).toBe("pending");
  });

  it("marks decided awards won and undecided majors not_applicable after the regular season", () => {
    let state = createAwardsTestState({ phase: "playoffs" });
    state = withAwards(state, [
      awardResult({ awardId: "mvp", seasonYear: 2026, winnerId: "p1" }),
    ]);
    expect(slot(state, "mvp")?.status).toBe("won");
    expect(slot(state, "mvp")?.winner?.winnerSubjectId).toBe("p1");
    expect(slot(state, "dpoy")?.status).toBe("not_applicable");
  });

  it("derives midseason status from the scheduled event and cutoff", () => {
    const base = createAwardsTestState({ phase: "regular" });
    expect(slot(base, "midseason_mvp")?.status).toBe("not_applicable");
    expect(
      slot(withMidseason(base, "scheduled", "2025-12-01"), "midseason_mvp")?.status,
    ).toBe("not_started");
    expect(
      slot(withMidseason(base, "scheduled", "2026-01-16"), "midseason_mvp")?.status,
    ).toBe("pending");
    expect(
      slot(withMidseason(base, "cancelled", "2026-01-16"), "midseason_mvp")?.status,
    ).toBe("not_applicable");
  });

  it("shows a pending slot for the current month and won slots for decided months", () => {
    let state = createAwardsTestState({ phase: "regular" });
    state = withAwards(state, [
      awardResult({
        awardId: "player_of_month",
        seasonYear: 2026,
        winnerId: "p1",
        period: "2026-03",
      }),
    ]);
    const monthly = toCurrentSeasonAwardGroups(state).find((g) => g.tier === "monthly")!;
    const current = monthly.slots.filter((s) => s.period === "2026-04");
    expect(current.every((s) => s.status === "pending")).toBe(true);
    const march = monthly.slots.find((s) => s.period === "2026-03");
    expect(march?.status).toBe("won");
    expect(march?.periodLabel).toBe("March 2026");
  });

  it("never invents catalog entries such as Finals MVP", () => {
    const ids = toCurrentSeasonAwardGroups(createAwardsTestState())
      .flatMap((g) => g.slots)
      .map((s) => s.awardId as string);
    expect(ids.some((id) => id.includes("finals"))).toBe(false);
  });

  it("ignores midseason state from a different season", () => {
    const base = createAwardsTestState({ phase: "regular" });
    const stale = withMidseason(base, "scheduled", "2026-01-16");
    const other: GameState = {
      ...stale,
      competition: {
        ...stale.competition,
        seasonEvents: {
          ...stale.competition.seasonEvents,
          midseasonAwards: {
            ...stale.competition.seasonEvents.midseasonAwards!,
            seasonId: asSeasonId("season_2025"),
          },
        },
      },
    };
    expect(slot(other, "midseason_mvp")?.status).toBe("not_applicable");
  });
});
