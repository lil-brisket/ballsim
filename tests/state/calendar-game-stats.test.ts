import { describe, expect, it } from "vitest";
import type {
  BoxScoreSideView,
  GameBoxScoreView,
  PlayerBoxScoreRowView,
} from "@/state/selectors/box-score";
import { toCalendarGameStatsView } from "@/state/selectors/calendar-game-stats";

function row(
  playerId: string,
  points: number,
  rebounds = 0,
  assists = 0,
): PlayerBoxScoreRowView {
  return {
    playerId,
    playerName: `Player ${playerId}`,
    minutes: 30,
    points,
    fieldGoals: "0/0",
    threePointers: "0/0",
    freeThrows: "0/0",
    rebounds,
    assists,
    turnovers: 0,
    fouls: 0,
  };
}

function side(
  teamId: string,
  score: number,
  players: PlayerBoxScoreRowView[],
): BoxScoreSideView {
  return {
    teamId,
    city: "City",
    name: "Team",
    abbreviation: teamId.toUpperCase(),
    score,
    teamStats: {
      points: score,
      fieldGoals: "40/85",
      threePointers: "12/30",
      freeThrows: "18/22",
      rebounds: 44,
      assists: 25,
      turnovers: 12,
      fouls: 19,
    },
    players,
    branding: null,
  };
}

function boxScore(): GameBoxScoreView {
  return {
    gameId: "g1",
    date: "2026-11-02",
    competitionTypeLabel: "Regular Season",
    seasonGameNumber: 3,
    home: side("hom", 110, [
      row("h1", 12),
      row("h2", 30),
      row("h3", 20, 2, 1),
      row("h4", 20, 10, 5),
    ]),
    away: side("awy", 104, [row("a1", 25), row("a2", 8)]),
    winner: "home",
    winnerName: "City Team",
    margin: 6,
    isCurrentSeason: true,
    periods: [
      { home: 25, away: 24 },
      { home: 28, away: 26 },
      { home: 27, away: 27 },
      { home: 22, away: 23 },
      { home: 8, away: 4 },
    ],
    rotation: null,
  };
}

describe("toCalendarGameStatsView", () => {
  it("keeps the top three scorers, breaking ties on rebounds plus assists", () => {
    const view = toCalendarGameStatsView(boxScore(), true);
    expect(view.home.topPerformers.map((p) => p.playerId)).toEqual([
      "h2",
      "h4",
      "h3",
    ]);
    expect(view.away.topPerformers.map((p) => p.playerId)).toEqual([
      "a1",
      "a2",
    ]);
  });

  it("labels periods and carries scores, team stats and canWatch", () => {
    const view = toCalendarGameStatsView(boxScore(), false);
    expect(view.periods.map((p) => p.label)).toEqual([
      "Q1",
      "Q2",
      "Q3",
      "Q4",
      "OT",
    ]);
    expect(view.home.score).toBe(110);
    expect(view.away.abbreviation).toBe("AWY");
    expect(view.home.teamStats.fieldGoals).toBe("40/85");
    expect(view.canWatch).toBe(false);
  });
});
