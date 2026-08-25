import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { bootstrapWorld } from "@/systems/world-pipeline";
import {
  advanceOffseasonStage,
  processOffseasonLifecycle,
} from "@/systems/simulation/offseason-lifecycle";
import { transitionPhase } from "@/systems/simulation/phase-machine";
import { advanceSimulation } from "@/systems/simulation/advance-simulation";
import { completeDraft } from "@/systems/draft";
import { draftClassIdFor } from "@/domain/entities/draft";
import { draftYearForSeason } from "@/systems/draft";

describe("offseason lifecycle", () => {
  function enterOffseason() {
    let state = createInitialGameState({
    saveId: "off_life",
      rngSeed: 21,
    settings: CBL_GAME_SETTINGS,
  });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    state = transitionPhase(state, "regular").state;
    state = transitionPhase(state, "postseason").state;
    state = transitionPhase(state, "offseason").state;
    state = {
      ...state,
      competition: {
        ...state.competition,
        season: {
          ...state.competition.season,
          offseasonStage: "season_finalization",
        },
      },
    };
    return { state, rng };
  }

  it("chains finalization and contract expiration into free_agency in one evaluation", () => {
    const { state, rng } = enterOffseason();
    const result = processOffseasonLifecycle(state, rng);
    expect(result.state.competition.season.phase).toBe("offseason");
    expect(result.state.competition.season.offseasonStage).toBe("free_agency");
  });

  it("keeps free_agency across advanceSimulation until advanceOffseasonStage", () => {
    const { state, rng } = enterOffseason();
    let current = processOffseasonLifecycle(state, rng).state;
    expect(current.competition.season.offseasonStage).toBe("free_agency");

    current = advanceSimulation(current, rng).state;
    expect(current.competition.season.offseasonStage).toBe("free_agency");

    current = advanceOffseasonStage(current).state;
    expect(current.competition.season.offseasonStage).toBe("draft");
  });

  it("creates and activates a draft, then initializes a new season after completion", () => {
    const { state, rng } = enterOffseason();
    let current = processOffseasonLifecycle(state, rng).state;
    current = advanceOffseasonStage(current).state;

    current = processOffseasonLifecycle(current, rng).state;
    expect(current.competition.season.offseasonStage).toBe("draft");

    const draftYear = draftYearForSeason(current.competition.season.year);
    const draftClassId = draftClassIdFor(draftYear);
    const draft = current.world.drafts[draftClassId];
    expect(draft).toBeDefined();
    expect(draft!.status).toBe("active");

    const yearBefore = current.competition.season.year;
    current = completeDraft(current, draftClassId).state;
    current = processOffseasonLifecycle(current, rng).state;

    expect(current.competition.season.phase).toBe("preseason");
    expect(current.competition.season.offseasonStage).toBe("none");
    expect(current.competition.season.year).toBe(yearBefore + 1);
    expect(current.competition.schedule.gameIds).toHaveLength(0);
    expect(current.competition.playoffs.status).toBe("not_started");
  });

  it("clears detailed game box scores on new season while preserving franchise history", () => {
    const { state, rng } = enterOffseason();
    const teamId = state.user.controlledTeamId;
    const teamIds = Object.keys(state.world.teams);
    const homeTeamId = teamIds[0]!;
    const awayTeamId = teamIds.find((id) => id !== homeTeamId)!;
    const gameId = `game_detail_${state.competition.season.id}`;

    let current = {
      ...state,
      competition: {
        ...state.competition,
        games: {
          [gameId]: {
            id: gameId,
            seasonId: state.competition.season.id,
            date: state.world.calendar.currentDate,
            homeTeamId,
            awayTeamId,
            competitionType: "regular_season" as const,
            status: "final" as const,
            score: { home: 100, away: 90 },
            periodScores: [{ home: 100, away: 90 }],
            events: [],
            playerStats: [
              {
                playerId: Object.values(state.world.players).find(
                  (p) => p.teamId === homeTeamId,
                )!.id,
                teamId: homeTeamId,
                firstName: "Box",
                lastName: "Score",
                minutes: 30,
                points: 100,
                rebounds: 5,
                offensiveRebounds: 2,
                defensiveRebounds: 3,
                assists: 4,
                steals: 0,
                blocks: 0,
                turnovers: 1,
                fouls: 2,
                fieldGoalsMade: 40,
                fieldGoalsAttempted: 80,
                threePointersMade: 10,
                threePointersAttempted: 30,
                freeThrowsMade: 10,
                freeThrowsAttempted: 12,
                touches: 0,
              },
            ],
            homeTeamSnapshot: {
              teamId: homeTeamId,
              city: "Home",
              name: "Team",
              abbreviation: "HOM",
            },
            awayTeamSnapshot: {
              teamId: awayTeamId,
              city: "Away",
              name: "Club",
              abbreviation: "AWY",
            },
          },
        },
        schedule: {
          seasonId: state.competition.season.id,
          gameIds: [gameId],
        },
      },
    };

    current = processOffseasonLifecycle(current, rng).state;
    expect(
      current.business.franchiseHistory[teamId]!.seasons.length,
    ).toBeGreaterThan(0);
    const historyYear =
      current.business.franchiseHistory[teamId]!.seasons[0]!.seasonYear;

    current = advanceOffseasonStage(current).state;
    current = processOffseasonLifecycle(current, rng).state;
    const draftYear = draftYearForSeason(current.competition.season.year);
    const draftClassId = draftClassIdFor(draftYear);
    current = completeDraft(current, draftClassId).state;
    current = processOffseasonLifecycle(current, rng).state;

    expect(Object.keys(current.competition.games)).toHaveLength(0);
    expect(current.competition.schedule.gameIds).toHaveLength(0);
    expect(
      current.business.franchiseHistory[teamId]!.seasons.some(
        (season) => season.seasonYear === historyYear,
      ),
    ).toBe(true);
  });

  it("appends exactly one franchise history record during season_finalization", () => {
    const { state, rng } = enterOffseason();
    const teamId = state.user.controlledTeamId;
    const year = state.competition.season.year;
    const seeded = {
      ...state,
      business: {
        ...state.business,
        finances: {
          ...state.business.finances,
          [teamId]: {
            ...state.business.finances[teamId]!,
            attendanceByYear: { [String(year)]: 750_000 },
          },
        },
      },
    };
    expect(seeded.business.franchiseHistory[teamId]!.seasons).toHaveLength(0);

    const once = processOffseasonLifecycle(seeded, rng);
    expect(once.state.business.franchiseHistory[teamId]!.seasons).toHaveLength(1);
    expect(
      once.state.business.franchiseHistory[teamId]!.seasons[0]!.attendance,
    ).toBe(750_000);

    const reentered = {
      ...once.state,
      competition: {
        ...once.state.competition,
        season: {
          ...once.state.competition.season,
          offseasonStage: "season_finalization" as const,
        },
      },
    };
    const twice = processOffseasonLifecycle(reentered, rng);
    expect(twice.state.business.franchiseHistory[teamId]!.seasons).toHaveLength(1);
  });
});
