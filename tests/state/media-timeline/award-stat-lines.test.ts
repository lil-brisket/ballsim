import { describe, expect, it } from "vitest";
import type {
  AwardDefinitionId,
  AwardStatSnapshot,
} from "@/domain/entities/awards";
import {
  awardStatLine,
  priorSeasonPointsPerGame,
  priorSeasonWins,
} from "@/state/media-timeline/award-stat-lines";
import {
  awardResult,
  playerSeason,
  seasonRecord,
  withFranchiseHistory,
  withPlayerHistory,
} from "../history-fixtures";
import { timelineState } from "./fixtures";

function snapshot(): AwardStatSnapshot {
  const s = awardResult({ awardId: "mvp", seasonYear: 2026, winnerId: "p1" })
    .context.statSnapshot;
  return {
    ...s,
    perGame: {
      points: 24.26,
      rebounds: 9.5,
      assists: 3.3,
      steals: 2.14,
      blocks: 1.8,
      turnovers: 2,
      minutes: 27.9,
    },
    teamRecord: { wins: 50, losses: 32, winPct: 0.61 },
    teamRank: 3,
  };
}

function statsFor(
  awardId: AwardDefinitionId,
  extra: { prior?: number | null; priorWins?: number | null } = {},
) {
  return awardStatLine({
    awardId,
    snapshot: snapshot(),
    isPlayer: awardId !== "coach_of_year",
    priorPointsPerGame: extra.prior ?? null,
    priorWins: extra.priorWins ?? null,
  });
}

const labels = (
  id: AwardDefinitionId,
  extra?: Parameters<typeof statsFor>[1],
) => statsFor(id, extra).stats.map((s) => s.label);

describe("awardStatLine", () => {
  it("gives scoring awards points, rebounds and assists", () => {
    for (const id of [
      "mvp",
      "player_of_month",
      "roy",
      "rookie_of_month",
    ] as const) {
      expect(labels(id)).toEqual(["PPG", "RPG", "APG"]);
    }
    expect(statsFor("mvp").stats.map((s) => s.value)).toEqual([
      "24.3",
      "9.5",
      "3.3",
    ]);
  });

  it("gives defensive awards steals and blocks, never assists", () => {
    for (const id of ["dpoy", "defensive_player_of_month"] as const) {
      expect(labels(id)).toEqual(["SPG", "BPG", "RPG"]);
      expect(statsFor(id).stats[0]!.value).toBe("2.1");
    }
  });

  it("gives the sixth man points and minutes", () => {
    expect(labels("sixth_man")).toEqual(["PPG", "MPG", "RPG"]);
    expect(statsFor("sixth_man").stats[1]!.value).toBe("27.9");
  });

  it("gives most improved this season, last season and the signed change", () => {
    const result = statsFor("most_improved", { prior: 15.2 });
    expect(result.stats).toEqual([
      { label: "PPG", value: "24.3" },
      { label: "Last season", value: "15.2" },
      { label: "Change", value: "+9.1", tone: "win" },
    ]);
    expect(result.improvement).toBeCloseTo(9.1);
    // Without a prior season there is no change to show.
    expect(labels("most_improved")).toEqual(["PPG", "RPG", "APG"]);
    expect(statsFor("most_improved").improvement).toBeNull();
  });

  it("gives coach of the year the record, the change in wins and the rank", () => {
    const result = statsFor("coach_of_year", { priorWins: 32 });
    expect(result.stats).toEqual([
      { label: "Record", value: "50–32" },
      { label: "Wins vs last season", value: "+18", tone: "win" },
      { label: "League rank", value: "3rd" },
    ]);
    expect(result.improvement).toBe(18);
    expect(labels("coach_of_year")).toEqual(["Record", "League rank"]);
    expect(statsFor("coach_of_year", { priorWins: 55 }).stats[1]).toEqual({
      label: "Wins vs last season",
      value: "−5",
      tone: "loss",
    });
  });
});

describe("prior-season lookups", () => {
  it("reads last season's points per game and wins from history", () => {
    const base = timelineState();
    const season = playerSeason({ year: 2025, teamId: null });
    season.competition.regular = {
      ...season.competition.regular,
      games: 10,
      points: 152,
    };
    const state = withFranchiseHistory(
      withPlayerHistory(base, { p1: [season] }),
      { t1: [seasonRecord({ year: 2025, wins: 30 })] },
    );
    expect(priorSeasonPointsPerGame(state, "p1", 2026)).toBeCloseTo(15.2);
    expect(priorSeasonPointsPerGame(state, "p1", 2027)).toBeNull();
    expect(priorSeasonPointsPerGame(state, "nobody", 2026)).toBeNull();
    expect(priorSeasonWins(state, "t1", 2026)).toBe(30);
    expect(priorSeasonWins(state, "t1", 2025)).toBeNull();
  });
});
