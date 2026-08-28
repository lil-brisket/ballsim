import { describe, expect, it } from "vitest";
import {
  getActiveOwnerTeamId,
  getActiveOwnedFranchise,
  getOwnedTeamIds,
  isAiControlledTeam,
  isOwnedFranchise,
  withActiveOwnerTeam,
  withAddedOwnedFranchise,
  withOwnedFranchise,
  withRelinquishedOwnedFranchise,
} from "@/state/owner-context";
import { createDefaultOwnedFranchiseState } from "@/state/owned-franchise-state";
import { createInitialGameState } from "@/state/create-initial-state";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { asTeamId } from "@/domain/ids";
import { GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";

describe("owner-context", () => {
  function freshState() {
    return createInitialGameState({
      saveId: "save_owner_context",
      rngSeed: 11,
      nowIso: "2026-08-13T12:00:00.000Z",
      settings: CBL_GAME_SETTINGS,
    });
  }

  it("exposes owned and active team ids for a new save", () => {
    const state = freshState();
    const active = getActiveOwnerTeamId(state);
    expect(getOwnedTeamIds(state)).toEqual([active]);
    expect(isOwnedFranchise(state, active)).toBe(true);
    expect(getActiveOwnedFranchise(state).ownerStartSeasonYear).toBe(2026);
  });

  it("switches active team without changing owned set", () => {
    const state = freshState();
    const teamIds = Object.keys(state.world.teams).sort();
    const primary = asTeamId(teamIds[0]!);
    const secondary = asTeamId(teamIds[1]!);
    const withSecond = withAddedOwnedFranchise(
      state,
      secondary,
      createDefaultOwnedFranchiseState({
        seasonYear: 2026,
        currentDate: "2026-10-01",
        citySelectionConfirmed: true,
        franchiseIdentityConfirmed: true,
        ownerPhilosophy: "win_now",
      }),
    );
    expect(getOwnedTeamIds(withSecond)).toEqual([primary, secondary]);
    const switched = withActiveOwnerTeam(withSecond, secondary);
    expect(getActiveOwnerTeamId(switched)).toBe(secondary);
    expect(getActiveOwnedFranchise(switched).ownerPhilosophy).toBe("win_now");
    expect(getOwnedFranchisePhilosophy(switched, primary)).toBe("balanced");
  });

  it("isolates franchise mutations", () => {
    const state = freshState();
    const teamIds = Object.keys(state.world.teams).sort();
    const primary = asTeamId(teamIds[0]!);
    const secondary = asTeamId(teamIds[1]!);
    let next = withAddedOwnedFranchise(
      state,
      secondary,
      createDefaultOwnedFranchiseState({
        seasonYear: 2026,
        currentDate: "2026-10-01",
        citySelectionConfirmed: true,
        franchiseIdentityConfirmed: true,
      }),
    );
    next = withOwnedFranchise(next, secondary, (f) => ({
      ...f,
      ownerPatience: 42,
    }));
    expect(getActiveOwnedFranchise(next).ownerPatience).not.toBe(42);
    expect(next.user.ownedFranchises[secondary]!.ownerPatience).toBe(42);
  });

  it("supports relinquishing an owned franchise", () => {
    const state = freshState();
    const teamIds = Object.keys(state.world.teams).sort();
    const primary = asTeamId(teamIds[0]!);
    const secondary = asTeamId(teamIds[1]!);
    const withSecond = withAddedOwnedFranchise(
      state,
      secondary,
      createDefaultOwnedFranchiseState({
        seasonYear: 2026,
        currentDate: "2026-10-01",
        citySelectionConfirmed: true,
        franchiseIdentityConfirmed: true,
      }),
      { setActive: true },
    );
    expect(getActiveOwnerTeamId(withSecond)).toBe(secondary);
    const released = withRelinquishedOwnedFranchise(withSecond, secondary);
    expect(getOwnedTeamIds(released)).toEqual([primary]);
    expect(getActiveOwnerTeamId(released)).toBe(primary);
    expect(isAiControlledTeam(released, secondary)).toBe(true);
  });
});

function getOwnedFranchisePhilosophy(
  state: ReturnType<typeof createInitialGameState>,
  teamId: ReturnType<typeof asTeamId>,
) {
  return state.user.ownedFranchises[teamId]!.ownerPhilosophy;
}

describe("v42 → v43 multi-team migration", () => {
  it("migrates controlledTeamId into ownedTeamIds + ownedFranchises", () => {
    const modern = createInitialGameState({
      saveId: "save_migrate_v43",
      rngSeed: 9,
      nowIso: "2026-08-13T12:00:00.000Z",
      settings: CBL_GAME_SETTINGS,
    });
    const active = modern.user.activeOwnerTeamId;
    const franchise = modern.user.ownedFranchises[active]!;

    const v42 = {
      ...modern,
      meta: {
        ...modern.meta,
        schemaVersion: 42,
      },
      user: {
        controlledTeamId: active,
        mode: modern.user.mode,
        citySelectionConfirmed: franchise.citySelectionConfirmed,
        franchiseIdentityConfirmed: franchise.franchiseIdentityConfirmed,
        ownerStartSeasonYear: franchise.ownerStartSeasonYear,
        ownerPhilosophy: franchise.ownerPhilosophy,
        ownerPatience: franchise.ownerPatience,
        ownershipConfidence: franchise.ownershipConfidence,
        objectives: franchise.objectives,
        notifications: franchise.notifications,
        eventLog: franchise.eventLog,
        appliedGameplayConsequenceKeys: franchise.appliedGameplayConsequenceKeys,
        explicitDecisions: franchise.explicitDecisions,
        phaseSkips: franchise.phaseSkips,
        aiAssistState: franchise.aiAssistState,
        pendingOwnerDecisions: [],
        ownerDecisionHistory: [],
        narrative: franchise.narrative,
      },
    };

    const migrated = deserializeGameState(JSON.stringify(v42));
    expect(migrated.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    expect(migrated.user.ownedTeamIds).toEqual([active]);
    expect(migrated.user.activeOwnerTeamId).toBe(active);
    expect(migrated.user.ownedFranchises[active]?.ownerPhilosophy).toBe(
      franchise.ownerPhilosophy,
    );
    expect(migrated.user.ownedFranchises[active]?.aiAssistance).toEqual(
      modern.settings.ai.assistance,
    );
    expect(migrated.user.ownedFranchises[active]?.managementPreset).toBe(
      modern.settings.ai.managementPreset,
    );
    // Round-trip
    const again = deserializeGameState(serializeGameState(migrated));
    expect(again.user.ownedTeamIds).toEqual([active]);
  });
});
