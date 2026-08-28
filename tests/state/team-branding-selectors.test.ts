import { describe, expect, it } from "vitest";
import { createGame } from "@/domain/entities/game";
import { asGameId, asTeamId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import { createTestGameState } from "../factories/game-state";
import { toPlayerGameLogView } from "@/state/player-profile-selectors";
import { toGameBoxScoreView, toStandingsView } from "@/state/selectors";
import { bootstrapWorld } from "@/systems/world-pipeline";

describe("team branding in selectors", () => {
  it("includes branding on every standings row", () => {
    let state = createTestGameState({ saveId: "standings_branding" });
    state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
    const rows = toStandingsView(state);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.branding).not.toBeNull();
      expect(row.branding!.logoId).toBeTruthy();
      expect(row.branding!.primaryColor).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it("prefers snapshot branding over live team branding for box scores", () => {
    let state = createTestGameState({ saveId: "snapshot_branding" });
    state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
    const teamIds = Object.keys(state.world.teams);
    const homeTeamId = asTeamId(teamIds[0]!);
    const awayTeamId = asTeamId(teamIds[1]!);
    const homeLive = state.world.teams[homeTeamId]!;
    const awayLive = state.world.teams[awayTeamId]!;

    const snapshotLogo = "wolf";
    expect(snapshotLogo).not.toBe(homeLive.branding.logoId);

    const homePlayer = Object.values(state.world.players).find(
      (player) => player.teamId === homeTeamId,
    )!;
    const awayPlayer = Object.values(state.world.players).find(
      (player) => player.teamId === awayTeamId,
    )!;

    const game = createGame({
      id: asGameId("game_snapshot_branding"),
      seasonId: state.competition.season.id,
      date: state.world.calendar.currentDate,
      homeTeamId,
      awayTeamId,
      competitionType: "regular_season",
      status: "final",
      score: { home: 101, away: 99 },
      periodScores: [{ home: 101, away: 99 }],
      events: [],
      playerStats: [
        {
          playerId: homePlayer.id,
          teamId: homeTeamId,
          firstName: homePlayer.firstName,
          lastName: homePlayer.lastName,
          minutes: 30,
          points: 20,
          rebounds: 5,
          offensiveRebounds: 1,
          defensiveRebounds: 4,
          assists: 3,
          steals: 0,
          blocks: 0,
          turnovers: 1,
          fouls: 2,
          fieldGoalsMade: 8,
          fieldGoalsAttempted: 16,
          threePointersMade: 2,
          threePointersAttempted: 5,
          freeThrowsMade: 2,
          freeThrowsAttempted: 2,
          touches: 0,
        },
        {
          playerId: awayPlayer.id,
          teamId: awayTeamId,
          firstName: awayPlayer.firstName,
          lastName: awayPlayer.lastName,
          minutes: 30,
          points: 18,
          rebounds: 4,
          offensiveRebounds: 1,
          defensiveRebounds: 3,
          assists: 2,
          steals: 0,
          blocks: 0,
          turnovers: 2,
          fouls: 3,
          fieldGoalsMade: 7,
          fieldGoalsAttempted: 15,
          threePointersMade: 1,
          threePointersAttempted: 4,
          freeThrowsMade: 3,
          freeThrowsAttempted: 4,
          touches: 0,
        },
      ],
      homeTeamSnapshot: {
        teamId: homeTeamId,
        city: homeLive.city,
        name: homeLive.name,
        abbreviation: homeLive.abbreviation,
        branding: {
          primaryColor: "#111111",
          secondaryColor: "#222222",
          accentColor: "#333333",
          logoId: snapshotLogo,
        },
      },
      awayTeamSnapshot: {
        teamId: awayTeamId,
        city: awayLive.city,
        name: awayLive.name,
        abbreviation: awayLive.abbreviation,
        branding: { ...awayLive.branding },
      },
    });

    state = {
      ...state,
      world: {
        ...state.world,
        teams: {
          ...state.world.teams,
          [homeTeamId]: {
            ...homeLive,
            branding: {
              ...homeLive.branding,
              logoId: "bear",
              primaryColor: "#ABCDEF",
            },
          },
        },
      },
      competition: {
        ...state.competition,
        games: { [game.id]: game },
        schedule: {
          seasonId: state.competition.season.id,
          gameIds: [game.id],
        },
      },
    };

    const view = toGameBoxScoreView(state, game.id);
    expect(view).not.toBeNull();
    expect(view!.home.branding).not.toBeNull();
    expect(view!.home.branding!.logoId).toBe(snapshotLogo);
    expect(view!.home.branding!.primaryColor).toBe("#111111");
    expect(view!.home.branding!.logoId).not.toBe("bear");
  });

  it("uses snapshot branding for player game-log opponents", () => {
    let state = createTestGameState({ saveId: "player_log_branding" });
    state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
    const teamIds = Object.keys(state.world.teams);
    const homeTeamId = asTeamId(teamIds[0]!);
    const awayTeamId = asTeamId(teamIds[1]!);
    const homeLive = state.world.teams[homeTeamId]!;
    const awayLive = state.world.teams[awayTeamId]!;
    const snapshotLogo = "wolf";
    expect(snapshotLogo).not.toBe(awayLive.branding.logoId);

    const homePlayer = Object.values(state.world.players).find(
      (player) => player.teamId === homeTeamId,
    )!;

    const game = createGame({
      id: asGameId("game_player_log_branding"),
      seasonId: state.competition.season.id,
      date: state.world.calendar.currentDate,
      homeTeamId,
      awayTeamId,
      competitionType: "regular_season",
      status: "final",
      score: { home: 100, away: 90 },
      periodScores: [{ home: 100, away: 90 }],
      events: [],
      playerStats: [
        {
          playerId: homePlayer.id,
          teamId: homeTeamId,
          firstName: homePlayer.firstName,
          lastName: homePlayer.lastName,
          minutes: 30,
          points: 20,
          rebounds: 5,
          offensiveRebounds: 1,
          defensiveRebounds: 4,
          assists: 4,
          steals: 1,
          blocks: 0,
          turnovers: 2,
          fouls: 2,
          fieldGoalsMade: 8,
          fieldGoalsAttempted: 15,
          threePointersMade: 2,
          threePointersAttempted: 5,
          freeThrowsMade: 2,
          freeThrowsAttempted: 2,
          touches: 0,
        },
      ],
      homeTeamSnapshot: {
        teamId: homeTeamId,
        city: homeLive.city,
        name: homeLive.name,
        abbreviation: homeLive.abbreviation,
        branding: { ...homeLive.branding },
      },
      awayTeamSnapshot: {
        teamId: awayTeamId,
        city: awayLive.city,
        name: awayLive.name,
        abbreviation: awayLive.abbreviation,
        branding: {
          primaryColor: "#010101",
          secondaryColor: "#020202",
          accentColor: "#030303",
          logoId: snapshotLogo,
        },
      },
    });

    state = {
      ...state,
      competition: {
        ...state.competition,
        games: { [game.id]: game },
        schedule: {
          seasonId: state.competition.season.id,
          gameIds: [game.id],
        },
      },
    };

    const rows = toPlayerGameLogView(state, homePlayer.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.opponentBranding).not.toBeNull();
    expect(rows[0]!.opponentBranding!.logoId).toBe(snapshotLogo);
    expect(rows[0]!.opponentBranding!.primaryColor).toBe("#010101");
  });
});
