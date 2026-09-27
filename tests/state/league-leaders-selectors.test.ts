import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import type { GameState } from "@/state/game-state";
import { toLeagueLeadersView } from "@/state/league-leaders-selectors";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createTestGameState } from "../factories/game-state";
import { boxRow, injectGames, makeFinalGame } from "../systems/awards/helpers";
import {
  createEmptyTeamStanding,
  type TeamStanding,
} from "@/domain/entities/standings";
import type { TeamId } from "@/domain/ids";

function boot(saveId: string): GameState {
  return bootstrapWorld(
    createTestGameState({ saveId }),
    createSeededRng("leaders"),
  ).state;
}

function setMaxGames(state: GameState, gamesPlayed: number): GameState {
  const wins = Math.ceil(gamesPlayed / 2);
  const losses = gamesPlayed - wins;
  const byTeamId: Record<string, TeamStanding> = {
    ...state.competition.standings.byTeamId,
  };
  for (const teamId of Object.keys(state.world.teams)) {
    byTeamId[teamId] = {
      ...createEmptyTeamStanding(teamId as TeamId),
      wins,
      losses,
      winPercentage: gamesPlayed === 0 ? 0 : wins / gamesPlayed,
    };
  }
  return {
    ...state,
    competition: { ...state.competition, standings: { byTeamId } },
  };
}

function twoTeams(state: GameState): [string, string] {
  const ids = Object.keys(state.world.teams).sort();
  return [ids[0]!, ids[1]!];
}

function rosterPlayer(state: GameState, teamId: string, index = 0): string {
  const playerId = state.world.teams[teamId]!.roster[index];
  if (!playerId) {
    throw new Error(`no roster player on ${teamId}`);
  }
  return playerId;
}

describe("toLeagueLeadersView", () => {
  it("returns empty cards when no games have been played", () => {
    const view = toLeagueLeadersView(boot("empty_leaders"));
    expect(view.allEmpty).toBe(true);
    expect(view.cards).toHaveLength(6);
    expect(view.cards.every((card) => card.leader == null)).toBe(true);
  });

  it("picks the PPG leader among qualified players", () => {
    let state = setMaxGames(boot("ppg_leaders"), 2);
    const [home, away] = twoTeams(state);
    const scorer = rosterPlayer(state, home, 0);
    const other = rosterPlayer(state, away, 0);
    state = injectGames(state, [
      makeFinalGame({
        id: "g1",
        date: "2026-11-01",
        homeTeamId: home,
        awayTeamId: away,
        homeScore: 110,
        awayScore: 90,
        seasonId: state.competition.season.id,
        playerStats: [
          boxRow(scorer, home, { points: 40, minutes: 32 }),
          boxRow(other, away, { points: 10, minutes: 24 }),
        ],
      }),
      makeFinalGame({
        id: "g2",
        date: "2026-11-02",
        homeTeamId: away,
        awayTeamId: home,
        homeScore: 95,
        awayScore: 100,
        seasonId: state.competition.season.id,
        playerStats: [
          boxRow(scorer, home, { points: 20, minutes: 30 }),
          boxRow(other, away, { points: 8, minutes: 22 }),
        ],
      }),
    ]);
    const view = toLeagueLeadersView(state);
    expect(view.minGames).toBe(1);
    expect(view.cards.find((c) => c.key === "ppg")?.leader?.playerId).toBe(
      scorer,
    );
    expect(view.allEmpty).toBe(false);
  });

  it("excludes players below the min-games qualifier", () => {
    let state = setMaxGames(boot("min_games"), 4);
    const [home, away] = twoTeams(state);
    const flash = rosterPlayer(state, home, 0);
    const steady = rosterPlayer(state, away, 0);
    state = injectGames(state, [
      makeFinalGame({
        id: "g1",
        date: "2026-11-01",
        homeTeamId: home,
        awayTeamId: away,
        homeScore: 120,
        awayScore: 90,
        seasonId: state.competition.season.id,
        playerStats: [
          boxRow(flash, home, { points: 50, minutes: 30 }),
          boxRow(steady, away, { points: 12, minutes: 28 }),
        ],
      }),
      makeFinalGame({
        id: "g2",
        date: "2026-11-02",
        homeTeamId: home,
        awayTeamId: away,
        homeScore: 100,
        awayScore: 98,
        seasonId: state.competition.season.id,
        playerStats: [boxRow(steady, away, { points: 12, minutes: 28 })],
      }),
    ]);
    const view = toLeagueLeadersView(state);
    expect(view.minGames).toBe(2);
    expect(view.cards.find((c) => c.key === "ppg")?.leader?.playerId).toBe(
      steady,
    );
  });

  it("requires an FG% attempt floor", () => {
    let state = setMaxGames(boot("fg"), 2);
    const [home, away] = twoTeams(state);
    const tiny = rosterPlayer(state, home, 0);
    const volume = rosterPlayer(state, away, 0);
    const games = [1, 2].map((n) =>
      makeFinalGame({
        id: `fg_${n}`,
        date: `2026-11-0${n}`,
        homeTeamId: home,
        awayTeamId: away,
        homeScore: 100,
        awayScore: 90,
        seasonId: state.competition.season.id,
        playerStats: [
          boxRow(tiny, home, {
            points: 2,
            minutes: 20,
            fieldGoalsMade: 1,
            fieldGoalsAttempted: 1,
          }),
          boxRow(volume, away, {
            points: 12,
            minutes: 30,
            fieldGoalsMade: 6,
            fieldGoalsAttempted: 12,
          }),
        ],
      }),
    );
    state = injectGames(state, games);
    const view = toLeagueLeadersView(state);
    expect(view.minFgAttempts).toBe(3);
    expect(view.cards.find((c) => c.key === "fgPct")?.leader?.playerId).toBe(
      volume,
    );
  });

  it("breaks ties by playerId even when insertion order differs", () => {
    let state = setMaxGames(boot("ties"), 2);
    const [home, away] = twoTeams(state);
    const first = rosterPlayer(state, home, 0);
    const second = rosterPlayer(state, away, 0);
    const [lowId, highId] =
      first.localeCompare(second) < 0 ? [first, second] : [second, first];
    const games = [1, 2].map((n) =>
      makeFinalGame({
        id: `tie_${n}`,
        date: `2026-11-0${n}`,
        homeTeamId: home,
        awayTeamId: away,
        homeScore: 100,
        awayScore: 100,
        seasonId: state.competition.season.id,
        playerStats: [
          boxRow(highId, highId === first ? home : away, {
            points: 20,
            minutes: 30,
          }),
          boxRow(lowId, lowId === first ? home : away, {
            points: 20,
            minutes: 30,
          }),
        ],
      }),
    );
    state = injectGames(state, games);
    const leader = toLeagueLeadersView(state).cards.find(
      (c) => c.key === "ppg",
    )?.leader;
    expect(leader?.playerId).toBe(lowId);
  });
});
