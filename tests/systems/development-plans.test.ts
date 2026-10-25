import { describe, expect, it } from "vitest";
import {
  DEVELOPMENT_FOCUS_ATTRIBUTES,
  DEVELOPMENT_FOCUSES,
} from "@/domain/entities/development-plan";
import { PLAYER_ATTRIBUTE_KEYS } from "@/domain/entities/player";
import type { PlayerId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import type { GameState } from "@/state/game-state";
import {
  setDevelopmentFocus,
  setDevelopmentFocuses,
} from "@/systems/development-plans";
import {
  developPlayer,
  redistributeForFocus,
} from "@/systems/player-development";
import { MAX_ANNUAL_ATTRIBUTE_CHANGE } from "@/systems/player-development-config";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createTestGameState } from "../factories/game-state";
import { createPlayer } from "../factories/player";

function sum(deltas: Record<string, number | undefined>): number {
  return Object.values(deltas).reduce<number>((a, b) => a + (b ?? 0), 0);
}

describe("redistributeForFocus", () => {
  const deltas = Object.fromEntries(
    PLAYER_ATTRIBUTE_KEYS.map((key, i) => [key, (i % 4) - 1]),
  );

  it("keeps total growth for every focus", () => {
    for (const focus of DEVELOPMENT_FOCUSES) {
      expect(sum(redistributeForFocus(deltas, focus))).toBe(sum(deltas));
    }
  });

  it("moves growth into the focus attributes within the annual cap", () => {
    const moved = redistributeForFocus(deltas, "shooting");
    const targets = DEVELOPMENT_FOCUS_ATTRIBUTES.shooting;
    const before = targets.reduce((a, k) => a + (deltas[k] ?? 0), 0);
    const after = targets.reduce((a, k) => a + (moved[k] ?? 0), 0);
    expect(after).toBeGreaterThan(before);
    for (const key of targets) {
      expect(moved[key]!).toBeLessThanOrEqual(MAX_ANNUAL_ATTRIBUTE_CHANGE);
    }
    // Focus declines are shielded; other declines only deepen.
    for (const key of PLAYER_ATTRIBUTE_KEYS) {
      if ((deltas[key] ?? 0) >= 0) continue;
      if (targets.includes(key))
        expect(moved[key]!).toBeGreaterThan(deltas[key]!);
      else expect(moved[key]!).toBeLessThanOrEqual(deltas[key]!);
    }
  });

  it("leaves balanced untouched", () => {
    expect(redistributeForFocus(deltas, "balanced")).toBe(deltas);
  });
});

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
