import { describe, expect, it } from "vitest";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createSeededRng } from "@/domain/rng";
import {
  createPlayer,
  PLAYER_POSITIONS,
  playsPosition,
} from "@/domain/entities/player";
import { createInitialGameState } from "@/state/create-initial-state";
import type { GameState } from "@/state/game-state";
import { runAiTeamDecisions } from "@/systems/ai-team-decisions";
import { listFreeAgents } from "@/systems/free-agency";
import {
  ensureFreeAgentPool,
  FREE_AGENT_POOL_MIN_PER_POSITION,
} from "@/systems/free-agent-pool";
import { bootstrapWorld } from "@/systems/world-pipeline";

function league(): GameState {
  let state = createInitialGameState({
    saveId: "fa_pool",
    rngSeed: 611,
    settings: CBL_GAME_SETTINGS,
  });
  state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
  return state;
}

/** Retires every free agent, leaving the pool empty. */
function drained(state: GameState): GameState {
  const players = { ...state.world.players };
  for (const id of listFreeAgents(state).playerIds) {
    players[id] = createPlayer({ ...players[id]!, retired: true });
  }
  return { ...state, world: { ...state.world, players } };
}

function coverage(state: GameState) {
  const pool = listFreeAgents(state).playerIds.map(
    (id) => state.world.players[id]!,
  );
  return PLAYER_POSITIONS.map(
    (position) =>
      pool.filter((player) => playsPosition(player, position)).length,
  );
}

describe("ensureFreeAgentPool", () => {
  it("tops an empty pool up to the floor at every position", () => {
    const empty = drained(league());
    expect(listFreeAgents(empty).playerIds).toHaveLength(0);
    const filled = ensureFreeAgentPool(empty, createSeededRng(1)).state;
    for (const count of coverage(filled)) {
      expect(count).toBeGreaterThanOrEqual(FREE_AGENT_POOL_MIN_PER_POSITION);
    }
  });

  it("adds nobody when the pool is already full", () => {
    const state = league();
    expect(
      coverage(state).every((c) => c >= FREE_AGENT_POOL_MIN_PER_POSITION),
    ).toBe(true);
    expect(ensureFreeAgentPool(state, createSeededRng(1)).state).toBe(state);
  });

  it("is deterministic and does not consume the rng", () => {
    const empty = drained(league());
    const rng = createSeededRng(7);
    const before = rng.getState();
    const a = ensureFreeAgentPool(empty, rng).state;
    expect(rng.getState()).toBe(before);
    const b = ensureFreeAgentPool(empty, createSeededRng(7)).state;
    expect(a.world.players).toEqual(b.world.players);
  });

  it("gives every new player a unique id and name, with no team or contract", () => {
    const empty = drained(league());
    const filled = ensureFreeAgentPool(empty, createSeededRng(3)).state;
    const added = Object.values(filled.world.players).filter((p) =>
      p.id.startsWith("player_fa_pool_"),
    );
    expect(added.length).toBeGreaterThanOrEqual(
      FREE_AGENT_POOL_MIN_PER_POSITION * PLAYER_POSITIONS.length,
    );
    expect(new Set(added.map((p) => p.id)).size).toBe(added.length);
    const names = Object.values(filled.world.players)
      .filter((p) => p.retired !== true)
      .map((p) => `${p.firstName} ${p.lastName}`);
    expect(new Set(names).size).toBe(names.length);
    for (const player of added) {
      expect(player.teamId).toBeNull();
      expect(player.contractId).toBeNull();
    }
  });

  it("never reuses an id when it tops up again later", () => {
    const first = ensureFreeAgentPool(
      drained(league()),
      createSeededRng(2),
    ).state;
    const second = ensureFreeAgentPool(
      drained(first),
      createSeededRng(9),
    ).state;
    const ids = Object.keys(second.world.players).filter((id) =>
      id.startsWith("player_fa_pool_"),
    );
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThan(
      Object.keys(first.world.players).filter((id) =>
        id.startsWith("player_fa_pool_"),
      ).length,
    );
  });

  it("leaves an unfinished fantasy draft's player pool alone", () => {
    const empty = drained(league());
    const fantasy = {
      ...empty,
      world: {
        ...empty.world,
        fantasyDraft: {
          status: "active",
        } as GameState["world"]["fantasyDraft"],
      },
    };
    expect(ensureFreeAgentPool(fantasy, createSeededRng(1)).state).toBe(
      fantasy,
    );
  });
});

describe("ensureFreeAgentPool demand", () => {
  /** Puts the league in the regular season with `count` teams missing every center. */
  function withCenterlessTeams(state: GameState, count: number): GameState {
    const players = { ...state.world.players };
    const teamIds = Object.keys(state.world.teams)
      .filter((id) => id !== state.user.activeOwnerTeamId)
      .sort()
      .slice(0, count);
    for (const teamId of teamIds) {
      for (const id of state.world.teams[teamId]!.roster) {
        const player = players[id]!;
        if (playsPosition(player, "C")) {
          players[id] = createPlayer({ ...player, availability: "out" });
        }
      }
    }
    return {
      ...state,
      competition: {
        ...state.competition,
        season: { ...state.competition.season, phase: "regular" },
      },
      world: { ...state.world, players },
    };
  }

  function centers(state: GameState): number {
    return listFreeAgents(state).playerIds.filter((id) =>
      playsPosition(state.world.players[id]!, "C"),
    ).length;
  }

  it("holds a free agent for every team that needs a center", () => {
    const state = withCenterlessTeams(drained(league()), 6);
    const filled = ensureFreeAgentPool(state, createSeededRng(4)).state;
    expect(centers(filled)).toBeGreaterThanOrEqual(6);
  });

  it("keeps only the floor when no team needs the position", () => {
    const state = {
      ...drained(league()),
    };
    const regular = withCenterlessTeams(state, 0);
    const filled = ensureFreeAgentPool(regular, createSeededRng(4)).state;
    expect(centers(filled)).toBeGreaterThanOrEqual(
      FREE_AGENT_POOL_MIN_PER_POSITION,
    );
    expect(centers(filled)).toBeLessThan(6);
  });

  it("does not size the pool to demand outside the preseason and regular season", () => {
    const inOffseason = (state: GameState): GameState => ({
      ...state,
      competition: {
        ...state.competition,
        season: { ...state.competition.season, phase: "offseason" as const },
      },
    });
    const needy = inOffseason(withCenterlessTeams(drained(league()), 6));
    const calm = inOffseason(withCenterlessTeams(drained(league()), 0));
    const withDemand = ensureFreeAgentPool(needy, createSeededRng(4)).state;
    const without = ensureFreeAgentPool(calm, createSeededRng(4)).state;
    expect(listFreeAgents(withDemand).playerIds).toEqual(
      listFreeAgents(without).playerIds,
    );
  });
});

describe("daily AI decisions", () => {
  it("restore the pool when teams have signed everyone", () => {
    const empty = drained(league());
    const after = runAiTeamDecisions(empty, createSeededRng(5)).state;
    for (const count of coverage(after)) {
      expect(count).toBeGreaterThanOrEqual(FREE_AGENT_POOL_MIN_PER_POSITION);
    }
  });
});
