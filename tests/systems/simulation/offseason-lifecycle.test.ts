import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import type { GameState } from "@/state/game-state";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { bootstrapWorld } from "@/systems/world-pipeline";
import {
  advanceLeaguePhase,
  processOffseasonLifecycle,
} from "@/systems/simulation/offseason-lifecycle";
import { transitionPhase } from "@/systems/simulation/phase-machine";
import { advanceSimulation } from "@/systems/simulation/advance-simulation";
import { completeDraft, createDraft, activateDraft } from "@/systems/draft";
import { draftClassIdFor } from "@/domain/entities/draft";
import { draftYearForSeason } from "@/systems/draft";
import {
  getActivePhaseId,
  setActivePhase,
} from "@/systems/phase-engine";

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
    state = setActivePhase(state, "offseason.season_transition");
    return { state, rng };
  }

  it("chains season_transition into roster_decisions in one evaluation", () => {
    const { state, rng } = enterOffseason();
    const result = processOffseasonLifecycle(state, rng);
    expect(result.state.competition.season.phase).toBe("offseason");
    expect(getActivePhaseId(result.state)).toBe("offseason.roster_decisions");
    expect(result.state.competition.season.offseasonStage).toBe(
      "roster_decisions",
    );
  });

  it("keeps roster_decisions across daily sim until user advances", () => {
    const { state, rng } = enterOffseason();
    let current = processOffseasonLifecycle(state, rng).state;
    expect(getActivePhaseId(current)).toBe("offseason.roster_decisions");

    current = advanceSimulation(current, rng).state;
    expect(getActivePhaseId(current)).toBe("offseason.roster_decisions");

    current = advanceLeaguePhase(current, rng).state;
    expect(getActivePhaseId(current)).toBe("offseason.draft_preparation");
  });

  it("creates draft on draft phase enter and initializes new season after staff_development", () => {
    const { state, rng } = enterOffseason();
    let current = processOffseasonLifecycle(state, rng).state;
    // roster → draft prep → draft → FA → staff
    current = advanceLeaguePhase(current, rng).state;
    expect(getActivePhaseId(current)).toBe("offseason.draft_preparation");
    current = advanceLeaguePhase(current, rng).state;
    expect(getActivePhaseId(current)).toBe("offseason.draft");

    current = processOffseasonLifecycle(current, rng).state;
    const draftYear = draftYearForSeason(current.competition.season.year);
    const draftClassId = draftClassIdFor(draftYear);
    let draft = current.world.drafts[draftClassId];
    if (draft === undefined) {
      current = createDraft(current, rng).state;
      current = activateDraft(current, draftClassId).state;
      draft = current.world.drafts[draftClassId];
    }
    expect(draft).toBeDefined();
    expect(draft!.status).toBe("active");

    const yearBefore = current.competition.season.year;
    current = completeDraft(current, draftClassId).state;
    current = advanceLeaguePhase(current, rng).state;
    expect(getActivePhaseId(current)).toBe("offseason.free_agency");
    current = advanceLeaguePhase(current, rng).state;
    expect(getActivePhaseId(current)).toBe("offseason.staff_development");
    current = advanceLeaguePhase(current, rng).state;

    expect(current.competition.season.phase).toBe("preseason");
    expect(getActivePhaseId(current)).toBe("preseason.preparation");
    expect(current.competition.season.year).toBe(yearBefore + 1);
    expect(current.competition.schedule.gameIds).toHaveLength(0);
    expect(current.competition.playoffs.status).toBe("not_started");
  });

  it("clears detailed game box scores on new season while preserving franchise history", () => {
    const { state, rng } = enterOffseason();
    const teamId = state.user.activeOwnerTeamId;
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
            status: "final" as const,
            competitionType: "regular" as const,
            homeScore: 100,
            awayScore: 90,
            boxScore: [],
            events: [],
            playerStats: [],
            homeTeamSnapshot: null,
            awayTeamSnapshot: null,
          },
        },
        schedule: {
          ...state.competition.schedule,
          gameIds: [gameId],
          gameIdsByDate: {
            [state.world.calendar.currentDate]: [gameId],
          },
        },
      },
    } as GameState;

    current = processOffseasonLifecycle(current, rng).state;
    expect(
      current.business.franchiseHistory[teamId]!.seasons.length,
    ).toBeGreaterThan(0);

    // Advance through remaining offseason to new season
    while (
      getActivePhaseId(current) !== "preseason.preparation" &&
      current.competition.season.year === state.competition.season.year
    ) {
      if (getActivePhaseId(current) === "offseason.draft") {
        const draftYear = draftYearForSeason(current.competition.season.year);
        const draftClassId = draftClassIdFor(draftYear);
        if (current.world.drafts[draftClassId] === undefined) {
          current = createDraft(current, rng).state;
          current = activateDraft(current, draftClassId).state;
        }
        current = completeDraft(current, draftClassId).state;
      }
      current = advanceLeaguePhase(current, rng).state;
    }

    expect(current.competition.season.year).toBe(
      state.competition.season.year + 1,
    );
    expect(Object.keys(current.competition.games)).toHaveLength(0);
    expect(
      current.business.franchiseHistory[teamId]!.seasons.length,
    ).toBeGreaterThan(0);
  });

  it("appends exactly one franchise history record during season_transition", () => {
    const { state, rng } = enterOffseason();
    const teamId = state.user.activeOwnerTeamId;
    const seeded = {
      ...state,
      business: {
        ...state.business,
        franchiseHistory: {
          ...state.business.franchiseHistory,
          [teamId]: {
            teamId,
            seasons: [],
          },
        },
      },
    };

    const once = processOffseasonLifecycle(seeded, rng);
    expect(once.state.business.franchiseHistory[teamId]!.seasons).toHaveLength(
      1,
    );

    const twice = processOffseasonLifecycle(once.state, rng);
    expect(twice.state.business.franchiseHistory[teamId]!.seasons).toHaveLength(
      1,
    );
  });
});
