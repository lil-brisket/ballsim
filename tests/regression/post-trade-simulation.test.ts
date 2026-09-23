/**
 * Regression: create save → regular season → player trade → advance simulation.
 * Verifies roster/rotation/contract integrity and that the next game can finalize.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/persistence/save-game-repository", () => ({
  prismaSaveGameStore: {
    list: vi.fn(),
    create: vi.fn(),
    load: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  },
}));

import { advanceOwnerTime } from "@/application/game-service";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createSeededRng } from "@/domain/rng";
import { createMemorySaveGameStore } from "@/persistence/memory-save-game-store";
import { createInitialGameState } from "@/state/create-initial-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { beginRegularSeasonFromPreseason } from "@/systems/simulation/season-lifecycle";
import { resetDomainEventSequenceForTests } from "@/domain/events/domain-event";
import { executeTrade } from "@/systems/trades/trade-execution";
import {
  assertTeamRosterIntegrity,
  validateTeamRosterIntegrity,
} from "@/systems/roster-integrity";
import { getNextTeamGameDate } from "@/systems/calendar";
import type { TradeProposal } from "@/domain/entities/trade-proposal";
import type { GameState } from "@/state/game-state";
import type { TeamId } from "@/domain/ids";

const LONG_TIMEOUT_MS = 120_000;

function ownedTeamId(state: GameState): TeamId {
  return state.user.activeOwnerTeamId;
}

function pickCounterpartTeam(state: GameState, userTeamId: TeamId): TeamId {
  const nextGameDate = getNextTeamGameDate(state, userTeamId);
  if (nextGameDate) {
    const game = Object.values(state.competition.games).find(
      (g) =>
        g.date === nextGameDate &&
        (g.homeTeamId === userTeamId || g.awayTeamId === userTeamId),
    );
    if (game) {
      return game.homeTeamId === userTeamId
        ? game.awayTeamId
        : game.homeTeamId;
    }
  }
  const other = Object.keys(state.world.teams).find((id) => id !== userTeamId);
  if (!other) {
    throw new Error("No counterpart team found.");
  }
  return other as TeamId;
}

function playerForPlayerProposal(
  state: GameState,
  teamA: TeamId,
  teamB: TeamId,
): TradeProposal {
  const fromA = state.world.teams[teamA]!.roster[0]!;
  const fromB = state.world.teams[teamB]!.roster[0]!;
  return {
    sideA: { teamId: teamA, playerIds: [fromA], draftPickIds: [] },
    sideB: { teamId: teamB, playerIds: [fromB], draftPickIds: [] },
  };
}

async function seedRegularSave(id: string, seed: number) {
  resetDomainEventSequenceForTests();
  const store = createMemorySaveGameStore();
  let state = createInitialGameState({
    saveId: id,
    rngSeed: seed,
    settings: CBL_GAME_SETTINGS,
  });
  const rng = createSeededRng(state.meta.rngState);
  state = bootstrapWorld(state, rng).state;
  state = beginRegularSeasonFromPreseason(state).state;
  state = {
    ...state,
    meta: {
      ...state.meta,
      rngState: rng.getState(),
    },
  };
  await store.create({ id, name: id, state });
  return { store, state };
}

describe("post-trade simulation integrity", () => {
  it(
    "trade then advance next game keeps roster/rotation valid and finalizes",
    async () => {
      const saveId = "post_trade_sim";
      const { store } = await seedRegularSave(saveId, 64);
      const loaded = await store.load(saveId);
      expect(loaded).not.toBeNull();
      let state = loaded!.state;
      const userTeamId = ownedTeamId(state);
      const counterpartId = pickCounterpartTeam(state, userTeamId);

      const proposal = playerForPlayerProposal(state, userTeamId, counterpartId);
      const fromUser = proposal.sideA.playerIds[0]!;
      const fromOther = proposal.sideB.playerIds[0]!;

      const executed = executeTrade(state, proposal);
      expect(executed.success).toBe(true);
      state = executed.state;

      expect(state.world.players[fromUser]!.teamId).toBe(counterpartId);
      expect(state.world.players[fromOther]!.teamId).toBe(userTeamId);
      expect(state.world.teams[userTeamId]!.roster).toContain(fromOther);
      expect(state.world.teams[userTeamId]!.roster).not.toContain(fromUser);
      expect(state.world.teams[counterpartId]!.roster).toContain(fromUser);
      expect(state.world.teams[counterpartId]!.roster).not.toContain(fromOther);

      assertTeamRosterIntegrity(state, userTeamId);
      assertTeamRosterIntegrity(state, counterpartId);

      const userRotation = state.world.teams[userTeamId]!.rosterManagement.rotation;
      expect(userRotation.some((e) => e.playerId === fromUser)).toBe(false);
      const otherRotation =
        state.world.teams[counterpartId]!.rosterManagement.rotation;
      expect(otherRotation.some((e) => e.playerId === fromOther)).toBe(false);

      await store.save({ id: saveId, state });

      const nextGameDate = getNextTeamGameDate(state, userTeamId);
      expect(nextGameDate).not.toBeNull();

      const result =
        nextGameDate === state.world.calendar.currentDate
          ? await advanceOwnerTime(saveId, { days: 1 }, store)
          : await advanceOwnerTime(
              saveId,
              { targetDate: nextGameDate! },
              store,
            );
      if (!result.ok) {
        throw new Error(`advanceOwnerTime failed: ${result.error}`);
      }
      expect(result.ok).toBe(true);

      const after = await store.load(saveId);
      expect(after).not.toBeNull();
      assertTeamRosterIntegrity(after!.state, userTeamId);
      assertTeamRosterIntegrity(after!.state, counterpartId);

      const finalGame = Object.values(after!.state.competition.games).find(
        (g) =>
          g.date === nextGameDate &&
          (g.homeTeamId === userTeamId || g.awayTeamId === userTeamId),
      );
      expect(finalGame).toBeDefined();
      expect(finalGame!.status).toBe("final");

      const integrity = validateTeamRosterIntegrity(after!.state, userTeamId);
      expect(integrity.ok).toBe(true);
    },
    LONG_TIMEOUT_MS,
  );
});
