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

import {
  createNewOwnerSave,
  signOwnerFreeAgent,
} from "@/application/game-service";
import { createPlayer } from "../factories/player";
import { CBL_GAME_SETTINGS, cloneGameSettings } from "@/domain/game-settings";
import { asPlayerId } from "@/domain/ids";
import { createMemorySaveGameStore } from "@/persistence/memory-save-game-store";
import {
  evaluateInterestAtSalary,
  listFreeAgents,
} from "@/systems/free-agency";
import { getLeagueSalaryCap } from "@/systems/league-salary-cap";
import { maxContractSalary, vetMinSalary } from "@/systems/salary-scale";
import { TEST_RNG_SEED } from "../helpers/determinism";

/**
 * The owner supplies the salary of a free-agent signing, so the application
 * layer has to hold it to the league minimum and maximum. Found by the
 * offseason soak: a below-minimum signing was accepted and left a contract
 * that breaks the league invariants for the rest of the save.
 */
describe("owner free-agent signing salary bounds", () => {
  async function setup() {
    const store = createMemorySaveGameStore();
    const created = await createNewOwnerSave(
      {
        settings: cloneGameSettings(CBL_GAME_SETTINGS),
        name: "Salary bounds",
        rngSeed: TEST_RNG_SEED,
      },
      store,
    );
    if (!created.ok) {
      throw new Error(created.error);
    }
    const saveId = created.save.id;
    const loaded = (await store.load(saveId))!;
    // A new league starts in the preseason, when free agents can be signed.
    const freeAgentId = asPlayerId("player_salary_bounds_fa");
    await store.save({
      id: saveId,
      state: {
        ...loaded.state,
        world: {
          ...loaded.state.world,
          players: {
            ...loaded.state.world.players,
            [freeAgentId]: createPlayer({
              id: freeAgentId,
              teamId: null,
              contractId: null,
            }),
          },
        },
      },
    });
    return {
      store,
      saveId,
      freeAgentId,
      cap: getLeagueSalaryCap(loaded.state),
    };
  }

  it.each([
    [
      "below the minimum",
      (cap: number) => vetMinSalary(cap) - 1_000,
      /minimum/,
    ],
    [
      "above the maximum",
      (cap: number) => maxContractSalary(cap) + 1_000,
      /maximum/,
    ],
    ["not a whole number", () => 2_500_000.5, /minimum/],
  ])(
    "refuses a salary %s and leaves the save unchanged",
    async (_, salaryOf, message) => {
      const { store, saveId, freeAgentId, cap } = await setup();
      const before = (await store.load(saveId))!.state;
      const result = await signOwnerFreeAgent(
        saveId,
        { playerId: freeAgentId, salary: salaryOf(cap), years: 1 },
        store,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(message);
      }
      const after = (await store.load(saveId))!.state;
      expect(after.world.players[freeAgentId]!.contractId).toBeNull();
      expect(Object.keys(after.business.contracts)).toEqual(
        Object.keys(before.business.contracts),
      );
    },
  );

  it("answers a signing on the spot: a turned-down deal saves nothing (#183)", async () => {
    const { store, saveId, cap } = await setup();
    const before = (await store.load(saveId))!.state;
    const teamId = before.user.activeOwnerTeamId;
    const salary = vetMinSalary(cap);
    const holdout = listFreeAgents(before).playerIds.find(
      (playerId) =>
        !evaluateInterestAtSalary(before, playerId, teamId, salary).interested,
    );
    expect(holdout).toBeDefined();

    const result = await signOwnerFreeAgent(
      saveId,
      { playerId: holdout!, salary, years: 1 },
      store,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/turned down the offer/);
    }
    const after = (await store.load(saveId))!.state;
    expect(after.world.players[holdout!]!.contractId).toBeNull();
    expect(after.business.freeAgency.offers).toEqual(
      before.business.freeAgency.offers,
    );
  });
});
