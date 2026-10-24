import { describe, expect, it } from "vitest";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import type { TeamId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import type { GameState } from "@/state/game-state";
import { calculateTeamDraftNeeds } from "@/systems/draft/draft-needs";
import { calculateTradeNeeds } from "@/systems/trades/trade-needs";
import { bootstrapWorld } from "@/systems/world-pipeline";

function league(): { state: GameState; teamId: TeamId } {
  const initial = createInitialGameState({
    saveId: "team_needs_cache",
    rngSeed: 7,
    settings: CBL_GAME_SETTINGS,
  });
  const state = bootstrapWorld(
    initial,
    createSeededRng(initial.meta.rngState),
  ).state;
  return { state, teamId: Object.keys(state.world.teams).sort()[0] as TeamId };
}

describe("team needs cache", () => {
  it("returns the stored result while the state is unchanged", () => {
    const { state, teamId } = league();
    expect(calculateTradeNeeds(state, teamId)).toBe(
      calculateTradeNeeds(state, teamId),
    );
    expect(calculateTeamDraftNeeds(state, teamId)).toBe(
      calculateTeamDraftNeeds(state, teamId),
    );
  });

  it("recomputes when the roster changes", () => {
    const { state, teamId } = league();
    const before = calculateTradeNeeds(state, teamId);
    const team = state.world.teams[teamId]!;
    const cut: GameState = {
      ...state,
      world: {
        ...state.world,
        teams: {
          ...state.world.teams,
          [teamId]: { ...team, roster: team.roster.slice(0, 8) },
        },
      },
    };
    const after = calculateTradeNeeds(cut, teamId);
    expect(after).not.toBe(before);
    expect(after.byPosition.reduce((n, p) => n + p.depth, 0)).toBe(8);
  });

  it("recomputes when a player changes or the season moves on", () => {
    const { state, teamId } = league();
    const before = calculateTeamDraftNeeds(state, teamId);
    const playerId = state.world.teams[teamId]!.roster[0]!;
    const older: GameState = {
      ...state,
      world: {
        ...state.world,
        players: {
          ...state.world.players,
          [playerId]: { ...state.world.players[playerId]!, age: 40 },
        },
      },
    };
    expect(calculateTeamDraftNeeds(older, teamId)).not.toBe(before);
    const nextSeason: GameState = {
      ...state,
      competition: {
        ...state.competition,
        season: {
          ...state.competition.season,
          year: state.competition.season.year + 1,
        },
      },
    };
    expect(calculateTeamDraftNeeds(nextSeason, teamId)).not.toBe(before);
  });
});
