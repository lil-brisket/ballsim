import { describe, expect, it } from "vitest";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import type { GameState } from "@/state/game-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { processCpuContractExtensions } from "@/systems/contract-extensions";
import { getContractSigningYear } from "@/systems/salary-cap";

/**
 * Owner team with one star (all ratings 95) on a near-minimum deal that
 * expires this season, so the CPU extension pass would rewrite it.
 */
function ownerWithUnderpaidStar(contractsMode: "off" | "full"): {
  state: GameState;
  starId: string;
  contractId: string;
} {
  const initial = createInitialGameState({
    saveId: "extensions",
    rngSeed: 21,
    settings: CBL_GAME_SETTINGS,
  });
  let state = bootstrapWorld(
    initial,
    createSeededRng(initial.meta.rngState),
  ).state;
  const ownerTeamId = state.user.activeOwnerTeamId;
  const team = state.world.teams[ownerTeamId]!;
  const starId = team.roster.find(
    (id) => state.world.players[id]?.contractId != null,
  )!;
  const star = state.world.players[starId]!;
  const contractId = star.contractId!;
  const contract = state.business.contracts[contractId]!;
  const year = getContractSigningYear(state);
  const attributes = Object.fromEntries(
    Object.keys(star.attributes).map((key) => [key, 95]),
  ) as typeof star.attributes;

  state = {
    ...state,
    world: {
      ...state.world,
      players: { ...state.world.players, [starId]: { ...star, attributes } },
    },
    business: {
      ...state.business,
      contracts: {
        ...state.business.contracts,
        [contractId]: {
          ...contract,
          startYear: year - 1,
          endYear: year,
          salaryByYear: {
            [String(year - 1)]: 100_000,
            [String(year)]: 100_000,
          },
        },
      },
    },
    user: {
      ...state.user,
      ownedFranchises: {
        ...state.user.ownedFranchises,
        [ownerTeamId]: {
          ...state.user.ownedFranchises[ownerTeamId]!,
          managementPreset: "custom",
          aiAssistance: {
            ...state.user.ownedFranchises[ownerTeamId]!.aiAssistance,
            contracts: contractsMode,
          },
        },
      },
    },
  };
  return { state, starId, contractId };
}

function extensionFor(
  events: ReturnType<typeof processCpuContractExtensions>["events"],
  playerId: string,
) {
  return events.find(
    (event) =>
      event.type === "ContractSigned" &&
      event.payload.playerId === playerId &&
      event.payload.reason === "extension",
  );
}

describe("processCpuContractExtensions", () => {
  it("leaves an owner's star alone when contracts are not delegated", () => {
    const { state, starId, contractId } = ownerWithUnderpaidStar("off");
    const result = processCpuContractExtensions(state);
    expect(extensionFor(result.events, starId)).toBeUndefined();
    expect(result.state.business.contracts[contractId]).toEqual(
      state.business.contracts[contractId],
    );
  });

  it("extends an owner's underpaid star when contracts are fully delegated", () => {
    const { state, starId } = ownerWithUnderpaidStar("full");
    const result = processCpuContractExtensions(state);
    expect(extensionFor(result.events, starId)).toBeDefined();
  });
});
