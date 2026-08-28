import { describe, expect, it } from "vitest";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { asTeamId } from "@/domain/ids";
import { createInitialGameState } from "@/state/create-initial-state";
import {
  getActiveOwnerTeamId,
  withActiveOwnerTeam,
  withAddedOwnedFranchise,
  withOwnedFranchise,
} from "@/state/owner-context";
import { createDefaultOwnedFranchiseState } from "@/state/owned-franchise-state";

describe("wrong active team isolation", () => {
  function multiTeamState() {
    const state = createInitialGameState({
      saveId: "save_wrong_active",
      rngSeed: 21,
      nowIso: "2026-08-13T12:00:00.000Z",
      settings: CBL_GAME_SETTINGS,
    });
    const teamIds = Object.keys(state.world.teams).sort();
    const seattle = asTeamId(teamIds[0]!);
    const newYork = asTeamId(teamIds[1]!);
    let next = withAddedOwnedFranchise(
      state,
      newYork,
      createDefaultOwnedFranchiseState({
        seasonYear: 2026,
        currentDate: "2026-10-01",
        citySelectionConfirmed: true,
        franchiseIdentityConfirmed: true,
        ownerPhilosophy: "win_now",
        ownerPatience: 40,
      }),
    );
    next = withOwnedFranchise(next, seattle, (f) => ({
      ...f,
      ownerPatience: 70,
      ownerPhilosophy: "build_for_the_future",
    }));
    return { state: next, seattle, newYork };
  }

  it("keeps franchise owner state isolated across active switches", () => {
    const { state, seattle, newYork } = multiTeamState();
    expect(getActiveOwnerTeamId(state)).toBe(seattle);
    expect(state.user.ownedFranchises[seattle]!.ownerPatience).toBe(70);
    expect(state.user.ownedFranchises[newYork]!.ownerPatience).toBe(40);

    const switched = withActiveOwnerTeam(state, newYork);
    expect(getActiveOwnerTeamId(switched)).toBe(newYork);
    expect(switched.user.ownedFranchises[seattle]!.ownerPatience).toBe(70);
    expect(switched.user.ownedFranchises[newYork]!.ownerPatience).toBe(40);
    expect(switched.user.ownedFranchises[seattle]!.ownerPhilosophy).toBe(
      "build_for_the_future",
    );
    expect(switched.user.ownedFranchises[newYork]!.ownerPhilosophy).toBe(
      "win_now",
    );
  });

  it("mutating New York AI settings does not change Seattle", () => {
    const { state, seattle, newYork } = multiTeamState();
    const seattleAssistBefore = {
      ...state.user.ownedFranchises[seattle]!.aiAssistance,
    };
    const next = withOwnedFranchise(
      withActiveOwnerTeam(state, newYork),
      newYork,
      (f) => ({
        ...f,
        aiAssistance: {
          ...f.aiAssistance,
          freeAgency: "full",
        },
        managementPreset: "full_management",
      }),
    );
    expect(next.user.ownedFranchises[newYork]!.aiAssistance.freeAgency).toBe(
      "full",
    );
    expect(next.user.ownedFranchises[seattle]!.aiAssistance).toEqual(
      seattleAssistBefore,
    );
  });
});
