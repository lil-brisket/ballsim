import { describe, expect, it } from "vitest";
import { CBL_GAME_SETTINGS, type GameSettings } from "@/domain/game-settings";
import type { TeamId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import type { GameState } from "@/state/game-state";
import { getLeagueSalaryCap } from "@/systems/league-salary-cap";
import { luxuryTaxThreshold } from "@/systems/payroll-rules";
import { getTeamPayroll } from "@/systems/salary-cap";
import { beginRegularSeasonFromPreseason } from "@/systems/simulation/season-lifecycle";
import {
  aiVeteranRightsRoom,
  hasVeteranRights,
  seasonsWithTeam,
} from "@/systems/veteran-rights";
import { bootstrapWorld } from "@/systems/world-pipeline";

function league(settings: GameSettings = CBL_GAME_SETTINGS): GameState {
  const initial = createInitialGameState({
    saveId: "payroll_rules",
    rngSeed: 61,
    settings,
  });
  const state = bootstrapWorld(
    initial,
    createSeededRng(initial.meta.rngState),
  ).state;
  return beginRegularSeasonFromPreseason(state).state;
}

describe("veteran rights", () => {
  it("need the configured number of straight seasons with the team", () => {
    const state = league();
    const teamId = Object.keys(state.world.teams).sort()[0]! as TeamId;
    const playerId = state.world.teams[teamId]!.roster[0]!;
    // A fresh league: only the season in progress counts.
    expect(seasonsWithTeam(state, playerId, teamId)).toBe(1);
    expect(hasVeteranRights(state, playerId, teamId)).toBe(false);
    const year = state.competition.season.year;
    const record = (seasonYear: number, team: TeamId) => ({
      seasonYear,
      contractSnapshot: { contractId: null, salary: null, teamId: team },
    });
    const withHistory = (teams: TeamId[]): GameState => ({
      ...state,
      business: {
        ...state.business,
        playerHistory: {
          ...state.business.playerHistory,
          [playerId]: {
            playerId,
            trackingStartedSeasonYear: year - teams.length,
            seasons: teams.map((t, i) =>
              record(year - teams.length + i, t),
            ) as never,
          },
        },
      },
    });
    expect(
      hasVeteranRights(withHistory([teamId, teamId]), playerId, teamId),
    ).toBe(true);
    const other = Object.keys(state.world.teams).sort()[1]! as TeamId;
    expect(
      hasVeteranRights(withHistory([teamId, other]), playerId, teamId),
    ).toBe(false);
  });

  it("keep CPU teams under the tax line unless they chase a title", () => {
    const state = league();
    const teamId = Object.keys(state.world.teams).sort()[0]! as TeamId;
    const year = state.competition.season.year;
    const line = luxuryTaxThreshold(state.settings, getLeagueSalaryCap(state));
    const room = aiVeteranRightsRoom(state, teamId, year);
    expect(getTeamPayroll(teamId, year, state) + room).toBeLessThanOrEqual(
      line,
    );
  });
});
