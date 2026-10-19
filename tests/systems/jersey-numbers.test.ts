import { describe, expect, it } from "vitest";
import type { PlayerId, TeamId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import type { GameState } from "@/state/game-state";
import {
  reconcileJerseyNumbers,
  teamJerseyNumbers,
} from "@/systems/jersey-numbers";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createTestGameState } from "../factories/game-state";

function league(): GameState {
  const base = createTestGameState({ saveId: "jersey_numbers" });
  return bootstrapWorld(base, createSeededRng(base.meta.rngState)).state;
}

function franchiseNumbers(state: GameState, teamId: TeamId): number[] {
  return Object.values(state.world.players)
    .filter((p) => p.teamId === teamId && p.retired !== true)
    .map((p) => p.jerseyNumber);
}

function setNumber(
  state: GameState,
  playerId: PlayerId,
  jerseyNumber: number,
  extra: Partial<GameState["world"]["players"][PlayerId]> = {},
): GameState {
  return {
    ...state,
    world: {
      ...state.world,
      players: {
        ...state.world.players,
        [playerId]: {
          ...state.world.players[playerId]!,
          jerseyNumber,
          ...extra,
        },
      },
    },
  };
}

describe("reconcileJerseyNumbers", () => {
  it("leaves a generated league unique and unchanged", () => {
    const state = league();
    for (const teamId of Object.keys(state.world.teams) as TeamId[]) {
      const numbers = franchiseNumbers(state, teamId);
      expect(new Set(numbers).size).toBe(numbers.length);
    }
    expect(reconcileJerseyNumbers(state)).toBe(state);
  });

  it("lets the longer-serving player keep a shared number", () => {
    const state = league();
    const teamId = Object.keys(state.world.teams)[0] as TeamId;
    const [veteran, newcomer] = state.world.teams[teamId]!.roster;
    const number = state.world.players[veteran!]!.jerseyNumber;
    const doubled = setNumber(state, newcomer!, number);

    const fixed = reconcileJerseyNumbers(doubled);
    expect(fixed.world.players[veteran!]!.jerseyNumber).toBe(number);
    expect(fixed.world.players[newcomer!]!.jerseyNumber).not.toBe(number);
    const numbers = franchiseNumbers(fixed, teamId);
    expect(new Set(numbers).size).toBe(numbers.length);
    // Only the newcomer changed.
    const changed = Object.keys(fixed.world.players).filter(
      (id) =>
        fixed.world.players[id as PlayerId]!.jerseyNumber !==
        doubled.world.players[id as PlayerId]!.jerseyNumber,
    );
    expect(changed).toEqual([newcomer]);
  });

  it("ranks players off the top-league roster after the roster", () => {
    const state = league();
    const teamId = Object.keys(state.world.teams)[0] as TeamId;
    const team = state.world.teams[teamId]!;
    const [first, offRoster] = team.roster;
    const number = state.world.players[first!]!.jerseyNumber;
    // Take the second player off the roster (as a development-league
    // assignee would be) and give him the first player's number.
    const moved: GameState = {
      ...setNumber(state, offRoster!, number),
    };
    moved.world.teams = {
      ...moved.world.teams,
      [teamId]: {
        ...team,
        roster: team.roster.filter((id) => id !== offRoster),
      },
    };
    const fixed = reconcileJerseyNumbers(moved);
    expect(fixed.world.players[first!]!.jerseyNumber).toBe(number);
    expect(fixed.world.players[offRoster!]!.jerseyNumber).not.toBe(number);
  });

  it("ignores retired players and free agents", () => {
    const state = league();
    const teamId = Object.keys(state.world.teams)[0] as TeamId;
    const [first, second] = state.world.teams[teamId]!.roster;
    const number = state.world.players[first!]!.jerseyNumber;
    const retired = setNumber(state, second!, number, { retired: true });
    expect(reconcileJerseyNumbers(retired)).toBe(retired);
    const freeAgent = setNumber(state, second!, number, { teamId: null });
    expect(reconcileJerseyNumbers(freeAgent)).toBe(freeAgent);
  });

  it("agrees with the teamJerseyNumbers selector", () => {
    const state = league();
    const teamId = Object.keys(state.world.teams)[0] as TeamId;
    const [first, second] = state.world.teams[teamId]!.roster;
    const doubled = setNumber(
      state,
      second!,
      state.world.players[first!]!.jerseyNumber,
    );
    const fixed = reconcileJerseyNumbers(doubled);
    for (const [id, n] of teamJerseyNumbers(doubled.world, teamId)) {
      expect(fixed.world.players[id]!.jerseyNumber).toBe(n);
    }
  });
});
