import { describe, expect, it } from "vitest";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import { PRESEASON_GAMES_PER_TEAM } from "@/systems/preseason-schedule-config";
import { generatePreseasonSchedule } from "@/systems/preseason-schedule-generation";
import { generateSchedule } from "@/systems/schedule-generation";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { FIXTURE_PRESEASON_START, FIXTURE_SEASON_START } from "../fixtures/dates";

describe("generatePreseasonSchedule", () => {
  it("adds five exhibition games per team during the preseason window", () => {
    let state = createInitialGameState({
      saveId: "preseason_sched",
      rngSeed: 12,
      settings: CBL_GAME_SETTINGS,
    });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;

    const teamIds = Object.keys(state.world.teams).sort();
    const preseasonGames = Object.values(state.competition.games).filter(
      (game) => game.competitionType === "preseason",
    );
    expect(preseasonGames.length).toBe(
      (teamIds.length * PRESEASON_GAMES_PER_TEAM) / 2,
    );

    for (const teamId of teamIds) {
      const teamPreseason = preseasonGames.filter(
        (game) => game.homeTeamId === teamId || game.awayTeamId === teamId,
      );
      expect(teamPreseason).toHaveLength(PRESEASON_GAMES_PER_TEAM);
      for (const game of teamPreseason) {
        expect(game.date >= FIXTURE_PRESEASON_START).toBe(true);
        expect(game.date < FIXTURE_SEASON_START).toBe(true);
      }
    }

    const preseasonCount = preseasonGames.length;
    const second = generatePreseasonSchedule(state);
    expect(
      Object.values(second.state.competition.games).filter(
        (g) => g.competitionType === "preseason",
      ).length,
    ).toBe(preseasonCount);
  });

  it("requires regular-season schedule before preseason materialization", () => {
    const state = createInitialGameState({
      saveId: "preseason_no_rs",
      rngSeed: 3,
      settings: CBL_GAME_SETTINGS,
    });
    expect(() => generatePreseasonSchedule(state)).toThrow(
      /non-empty regular-season schedule/,
    );

    const withRegular = generateSchedule(state).state;
    const withPreseason = generatePreseasonSchedule(withRegular).state;
    expect(
      Object.values(withPreseason.competition.games).some(
        (g) => g.competitionType === "preseason",
      ),
    ).toBe(true);
  });
});
