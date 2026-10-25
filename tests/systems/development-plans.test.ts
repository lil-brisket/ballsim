import { describe, expect, it } from "vitest";
import { DEVELOPMENT_FOCUS_ATTRIBUTES } from "@/domain/entities/development-plan";
import type { PlayerId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import type { GameState } from "@/state/game-state";
import {
  campSlotsForTeam,
  setDevelopmentFocus,
  setDevelopmentFocuses,
} from "@/systems/development-plans";
import { developPlayer } from "@/systems/player-development";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createTestGameState } from "../factories/game-state";
import { createPlayer } from "../factories/player";

describe("developPlayer with a focus", () => {
  const young = createPlayer({
    id: "p_dev" as PlayerId,
    age: 20,
    potential: { overall: 90 } as never,
  });

  it("balanced equals the default output", () => {
    expect(developPlayer(young, createSeededRng(3), 1, "balanced")).toEqual(
      developPlayer(young, createSeededRng(3)),
    );
  });

  it("is deterministic and favours the focus", () => {
    const a = developPlayer(young, createSeededRng(9), 1.2, "shooting");
    const b = developPlayer(young, createSeededRng(9), 1.2, "shooting");
    expect(a).toEqual(b);
    const plain = developPlayer(young, createSeededRng(9), 1.2);
    const gain = (p: typeof a) =>
      DEVELOPMENT_FOCUS_ATTRIBUTES.shooting.reduce(
        (sum, key) => sum + p.attributes[key] - young.attributes[key],
        0,
      );
    expect(gain(a)).toBeGreaterThanOrEqual(gain(plain));
  });
});

describe("setDevelopmentFocus", () => {
  function league(): GameState {
    const base = createTestGameState({ saveId: "dev_plans" });
    return bootstrapWorld(base, createSeededRng(base.meta.rngState)).state;
  }

  it("stores a focus for a young owner player and clears it on balanced", () => {
    let state = league();
    const teamId = state.user.activeOwnerTeamId;
    const playerId = state.world.teams[teamId]!.roster[0]!;
    state = {
      ...state,
      world: {
        ...state.world,
        players: {
          ...state.world.players,
          [playerId]: { ...state.world.players[playerId]!, age: 21 },
        },
      },
    };
    const set = setDevelopmentFocus(state, playerId, "defense");
    expect(set.ok).toBe(true);
    if (!set.ok) return;
    expect(set.state.business.developmentPlans[playerId]).toBe("defense");
    const cleared = setDevelopmentFocus(set.state, playerId, "balanced");
    expect(
      cleared.ok && cleared.state.business.developmentPlans[playerId],
    ).toBe(undefined);
  });

  it("accepts veterans; rejects other teams' players and unknown camps", () => {
    const state = league();
    const teamId = state.user.activeOwnerTeamId;
    const other = Object.keys(state.world.teams).find((id) => id !== teamId)!;
    const theirs = state.world.teams[other]!.roster[0]!;
    expect(setDevelopmentFocus(state, theirs, "defense").ok).toBe(false);
    const mine = state.world.teams[teamId]!.roster[0]!;
    const veteran: GameState = {
      ...state,
      world: {
        ...state.world,
        players: {
          ...state.world.players,
          [mine]: { ...state.world.players[mine]!, age: 33 },
        },
      },
    };
    expect(setDevelopmentFocus(veteran, mine, "iq").ok).toBe(true);
    expect(setDevelopmentFocus(state, mine, "juggling").ok).toBe(false);
  });

  it("caps camps at the trainer's slots, counting the final batch", () => {
    const state = league();
    const teamId = state.user.activeOwnerTeamId;
    const roster = state.world.teams[teamId]!.roster;
    const slots = campSlotsForTeam(state, teamId);
    const full = setDevelopmentFocuses(
      state,
      roster.slice(0, slots).map((playerId) => ({ playerId, focus: "iq" })),
    );
    expect(full.ok).toBe(true);
    if (!full.ok) return;
    const extra = roster[slots]!;
    expect(setDevelopmentFocus(full.state, extra, "defense").ok).toBe(false);
    // Swapping one camper out for another in one batch fits.
    const swap = setDevelopmentFocuses(full.state, [
      { playerId: extra, focus: "defense" },
      { playerId: roster[0]!, focus: "balanced" },
    ]);
    expect(swap.ok).toBe(true);
  });

  it("gives more slots to a better trainer, one without a trainer", () => {
    const state = league();
    const teamId = state.user.activeOwnerTeamId;
    const team = state.world.teams[teamId]!;
    const noTrainer: GameState = {
      ...state,
      world: {
        ...state.world,
        teams: {
          ...state.world.teams,
          [teamId]: {
            ...team,
            staff: (team.staff ?? []).filter(
              (id) => state.world.staff[id]?.role !== "trainer",
            ),
          },
        },
      },
    };
    expect(campSlotsForTeam(noTrainer, teamId)).toBe(1);
    const trainerId = (team.staff ?? []).find(
      (id) => state.world.staff[id]?.role === "trainer",
    );
    if (!trainerId) return;
    const withScore = (score: number): GameState => {
      const trainer = state.world.staff[trainerId]!;
      return {
        ...state,
        world: {
          ...state.world,
          staff: {
            ...state.world.staff,
            [trainerId]: {
              ...trainer,
              attributes: {
                ...trainer.attributes,
                playerDevelopment: score,
                skillDevelopment: score,
                potentialDevelopment: score,
              },
            },
          },
        },
      };
    };
    expect(campSlotsForTeam(withScore(30), teamId)).toBe(2);
    expect(campSlotsForTeam(withScore(55), teamId)).toBe(3);
    expect(campSlotsForTeam(withScore(70), teamId)).toBe(4);
    expect(campSlotsForTeam(withScore(90), teamId)).toBe(5);
  });

  it("sets a batch of camps all or nothing", () => {
    const state = league();
    const teamId = state.user.activeOwnerTeamId;
    const [a, b] = state.world.teams[teamId]!.roster;
    const other = Object.keys(state.world.teams).find((id) => id !== teamId)!;
    const theirs = state.world.teams[other]!.roster[0]!;
    const set = setDevelopmentFocuses(state, [
      { playerId: a!, focus: "finishing" },
      { playerId: b!, focus: "shooting" },
    ]);
    expect(set.ok && set.state.business.developmentPlans).toEqual({
      [a!]: "finishing",
      [b!]: "shooting",
    });
    const rejected = setDevelopmentFocuses(state, [
      { playerId: a!, focus: "finishing" },
      { playerId: theirs, focus: "shooting" },
    ]);
    expect(rejected.ok).toBe(false);
  });
});
