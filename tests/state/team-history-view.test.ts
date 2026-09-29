import { describe, expect, it } from "vitest";
import {
  toFranchiseHistoryView,
  toTeamHistoryView,
  toTeamRecordsView,
} from "@/state/franchise-selectors";
import { createTestGameState } from "../factories/game-state";
import {
  seasonRecord,
  teamIds,
  withFranchiseHistory,
} from "./history-fixtures";

describe("toTeamHistoryView", () => {
  const base = createTestGameState({ saveId: "team_history" });
  const [a, b] = teamIds(base);

  const state = withFranchiseHistory(base, {
    [a!]: [
      seasonRecord({
        year: 2026,
        wins: 30,
        losses: 52,
        playoffResult: "missed",
      }),
      seasonRecord({
        year: 2027,
        wins: 55,
        losses: 27,
        playoffResult: "champion",
      }),
      seasonRecord({
        year: 2028,
        wins: 50,
        losses: 32,
        playoffResult: "finals",
      }),
      seasonRecord({
        year: 2029,
        wins: 60,
        losses: 22,
        playoffResult: "champion",
      }),
    ],
    [b!]: [
      seasonRecord({
        year: 2026,
        wins: 45,
        losses: 37,
        playoffResult: "first_round",
      }),
      seasonRecord({
        year: 2027,
        wins: 30,
        losses: 52,
        playoffResult: "missed",
      }),
    ],
  });

  it("counts championships, finals appearances, and playoff appearances", () => {
    const view = toTeamHistoryView(state, a!);
    expect(view.summary.championships).toBe(2);
    expect(view.summary.finalsAppearances).toBe(3);
    expect(view.summary.playoffAppearances).toBe(3);
    expect(view.summary.wins).toBe(195);
    expect(view.summary.losses).toBe(133);
  });

  it("picks best and worst seasons by win percentage", () => {
    const view = toTeamHistoryView(state, a!);
    expect(view.summary.bestRecord).toMatchObject({
      wins: 60,
      losses: 22,
      seasonYear: 2029,
    });
    expect(view.summary.worstRecord).toMatchObject({
      wins: 30,
      losses: 52,
      seasonYear: 2026,
    });
  });

  it("breaks identical records toward the earliest season", () => {
    const tied = withFranchiseHistory(base, {
      [a!]: [
        seasonRecord({ year: 2027, wins: 41, losses: 41 }),
        seasonRecord({ year: 2026, wins: 41, losses: 41 }),
      ],
    });
    const view = toTeamHistoryView(tied, a!);
    expect(view.summary.bestRecord?.seasonYear).toBe(2026);
    expect(view.summary.worstRecord?.seasonYear).toBe(2026);
  });

  it("handles a team with zero championships", () => {
    const view = toTeamHistoryView(state, b!);
    expect(view.summary.championships).toBe(0);
    expect(view.summary.finalsAppearances).toBe(0);
    expect(view.summary.playoffAppearances).toBe(1);
  });

  it("keeps relocated seasons on the same teamId with historical names", () => {
    const relocated = withFranchiseHistory(base, {
      [a!]: [
        seasonRecord({
          year: 2026,
          city: "Old City",
          name: "Originals",
          playoffResult: "champion",
        }),
        seasonRecord({
          year: 2027,
          city: "New City",
          name: "Movers",
          relocated: true,
        }),
      ],
    });
    const view = toTeamHistoryView(relocated, a!);
    expect(view.teamId).toBe(a);
    expect(view.seasons.map((s) => `${s.city} ${s.name}`)).toEqual([
      "Old City Originals",
      "New City Movers",
    ]);
    expect(view.summary.championships).toBe(1);
  });

  it("returns valid zeros for a team with no history", () => {
    const view = toTeamHistoryView(base, "team_missing");
    expect(view.hasHistory).toBe(false);
    expect(view.summary.totalSeasons).toBe(0);
    expect(view.summary.bestRecord).toBeNull();
    expect(view.summary.worstRecord).toBeNull();
    expect(view.teamName).toBe("team_missing");
  });

  it("feeds the owner franchise view so both stay consistent", () => {
    const ownerId = base.user.activeOwnerTeamId;
    const owned = withFranchiseHistory(base, {
      [ownerId]: [
        seasonRecord({ year: 2026, playoffResult: "champion" }),
        seasonRecord({ year: 2027, playoffResult: "first_round" }),
      ],
    });
    const team = toTeamHistoryView(owned, ownerId);
    const franchise = toFranchiseHistoryView(owned);
    expect(franchise.seasons).toEqual(team.seasons);
    expect(franchise.milestones.championships).toBe(team.summary.championships);
    expect(franchise.milestones.playoffAppearances).toBe(
      team.summary.playoffAppearances,
    );
  });
});

describe("toTeamRecordsView", () => {
  it("ranks teams by titles, then finals, then playoff apps and skips empty histories", () => {
    const base = createTestGameState({ saveId: "team_records" });
    const [a, b, c] = teamIds(base);
    const rows = toTeamRecordsView(
      withFranchiseHistory(base, {
        [a!]: [seasonRecord({ year: 2026, playoffResult: "finals" })],
        [b!]: [seasonRecord({ year: 2026, playoffResult: "champion" })],
        [c!]: [],
      }),
    );
    expect(rows.map((r) => r.teamId)).toEqual([b, a]);
  });
});
