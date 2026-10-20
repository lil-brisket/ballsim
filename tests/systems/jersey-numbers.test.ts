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

  it("registers every franchise player's number with his team", () => {
    const state = league();
    for (const player of Object.values(state.world.players)) {
      if (player.teamId !== null) {
        expect(player.jerseyTeamId).toBe(player.teamId);
      }
    }
  });

  it("lets the incumbent keep a number a newcomer brings in", () => {
    const state = league();
    const [teamId, otherTeamId] = Object.keys(state.world.teams) as TeamId[];
    const veteran = state.world.teams[teamId!]!.roster.at(-1)!;
    const newcomer = state.world.teams[otherTeamId!]!.roster[0]!;
    const number = state.world.players[veteran]!.jerseyNumber;
    // The newcomer signs and is put at the front of the roster, wearing the
    // veteran's number from his old team.
    const signed = setNumber(state, newcomer, number, { teamId: teamId! });
    signed.world.teams = {
      ...signed.world.teams,
      [teamId!]: {
        ...signed.world.teams[teamId!]!,
        roster: [newcomer, ...signed.world.teams[teamId!]!.roster],
      },
      [otherTeamId!]: {
        ...signed.world.teams[otherTeamId!]!,
        roster: signed.world.teams[otherTeamId!]!.roster.filter(
          (id) => id !== newcomer,
        ),
      },
    };

    const fixed = reconcileJerseyNumbers(signed);
    expect(fixed.world.players[veteran]!.jerseyNumber).toBe(number);
    expect(fixed.world.players[newcomer]!.jerseyNumber).not.toBe(number);
    expect(fixed.world.players[newcomer]!.jerseyTeamId).toBe(teamId);
    const numbers = franchiseNumbers(fixed, teamId!);
    expect(new Set(numbers).size).toBe(numbers.length);
    // Only the newcomer changed number.
    const changed = Object.keys(fixed.world.players).filter(
      (id) =>
        fixed.world.players[id as PlayerId]!.jerseyNumber !==
        signed.world.players[id as PlayerId]!.jerseyNumber,
    );
    expect(changed).toEqual([newcomer]);
  });

  it("lets a newcomer keep his old number when it is free", () => {
    const state = league();
    const [teamId, otherTeamId] = Object.keys(state.world.teams) as TeamId[];
    const newcomer = state.world.teams[otherTeamId!]!.roster[0]!;
    const taken = new Set(franchiseNumbers(state, teamId!));
    const free = [...Array(100).keys()].find((n) => !taken.has(n))!;
    const signed = setNumber(state, newcomer, free, { teamId: teamId! });
    const fixed = reconcileJerseyNumbers(signed);
    expect(fixed.world.players[newcomer]!.jerseyNumber).toBe(free);
    expect(fixed.world.players[newcomer]!.jerseyTeamId).toBe(teamId);
  });

  it("keeps a development-league assignee's number while he is off the roster", () => {
    const state = league();
    const teamId = Object.keys(state.world.teams)[0] as TeamId;
    const otherTeamId = Object.keys(state.world.teams)[1] as TeamId;
    const team = state.world.teams[teamId]!;
    const assignee = team.roster[0]!;
    const newcomer = state.world.teams[otherTeamId]!.roster[0]!;
    const number = state.world.players[assignee]!.jerseyNumber;
    // Assignee goes to the Development League (off Team.roster, same
    // teamId); a newcomer wearing his number joins the roster.
    const moved = setNumber(state, newcomer, number, { teamId });
    moved.world.teams = {
      ...moved.world.teams,
      [teamId]: {
        ...team,
        roster: [...team.roster.filter((id) => id !== assignee), newcomer],
      },
    };
    const fixed = reconcileJerseyNumbers(moved);
    expect(fixed.world.players[assignee]!.jerseyNumber).toBe(number);
    expect(fixed.world.players[newcomer]!.jerseyNumber).not.toBe(number);
  });

  it("ignores retired players and releases free agents' registration", () => {
    const state = league();
    const teamId = Object.keys(state.world.teams)[0] as TeamId;
    const [first, second] = state.world.teams[teamId]!.roster;
    const number = state.world.players[first!]!.jerseyNumber;
    const retired = setNumber(state, second!, number, { retired: true });
    expect(reconcileJerseyNumbers(retired)).toBe(retired);

    const freeAgent = setNumber(state, second!, number, { teamId: null });
    const fixed = reconcileJerseyNumbers(freeAgent);
    expect(fixed.world.players[second!]!.jerseyNumber).toBe(number);
    expect(fixed.world.players[second!]!.jerseyTeamId).toBeUndefined();
    expect(fixed.world.players[first!]!.jerseyNumber).toBe(number);
  });

  it("treats a returning player as a newcomer", () => {
    const state = league();
    const teamId = Object.keys(state.world.teams)[0] as TeamId;
    const [stayer, leaver] = state.world.teams[teamId]!.roster;
    const leaverNumber = state.world.players[leaver!]!.jerseyNumber;
    // He leaves as a free agent; while he is gone a teammate takes #.
    let current = reconcileJerseyNumbers(
      setNumber(state, leaver!, leaverNumber, { teamId: null }),
    );
    current = reconcileJerseyNumbers(setNumber(current, stayer!, leaverNumber));
    expect(current.world.players[stayer!]!.jerseyNumber).toBe(leaverNumber);
    // He re-signs: the number now belongs to the teammate.
    const back = reconcileJerseyNumbers(
      setNumber(current, leaver!, leaverNumber, { teamId }),
    );
    expect(back.world.players[stayer!]!.jerseyNumber).toBe(leaverNumber);
    expect(back.world.players[leaver!]!.jerseyNumber).not.toBe(leaverNumber);
  });

  it("falls back to roster order for numbers not yet registered", () => {
    const state = league();
    const teamId = Object.keys(state.world.teams)[0] as TeamId;
    const [first, second] = state.world.teams[teamId]!.roster;
    const number = state.world.players[first!]!.jerseyNumber;
    const legacy = setNumber(
      setNumber(state, first!, number, { jerseyTeamId: undefined }),
      second!,
      number,
      { jerseyTeamId: undefined },
    );
    const fixed = reconcileJerseyNumbers(legacy);
    expect(fixed.world.players[first!]!.jerseyNumber).toBe(number);
    expect(fixed.world.players[second!]!.jerseyNumber).not.toBe(number);
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
