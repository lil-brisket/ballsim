import { describe, expect, it } from "vitest";
import { applyConfirmControlledFranchises } from "@/systems/confirm-controlled-franchises";
import { createInitialGameState } from "@/state/create-initial-state";
import { CBL_GAME_SETTINGS, cloneGameSettings } from "@/domain/game-settings";
import { withOwnedFranchise } from "@/state/owner-context";
import { applyOwnerCitySelection } from "@/systems/owner-city-selection";

describe("applyConfirmControlledFranchises", () => {
  function preparedState(controlledTeamCount: number) {
    const settings = cloneGameSettings(CBL_GAME_SETTINGS);
    settings.ownership = { controlledTeamCount };
    let state = createInitialGameState({
      saveId: "ctrl_franchises",
      rngSeed: 42,
      nowIso: "2026-08-13T12:00:00.000Z",
      settings,
    });
    state = withOwnedFranchise(state, state.user.activeOwnerTeamId, (f) => ({
      ...f,
      citySelectionConfirmed: false,
      franchiseIdentityConfirmed: false,
    }));
    const pickCity = Object.values(state.world.teams)[0]!.city;
    const cityResult = applyOwnerCitySelection(state, pickCity);
    expect(cityResult.ok).toBe(true);
    if (!cityResult.ok) {
      throw new Error(cityResult.error);
    }
    return withOwnedFranchise(
      cityResult.state,
      cityResult.state.user.activeOwnerTeamId,
      (f) => ({
        ...f,
        franchiseIdentityConfirmed: false,
      }),
    );
  }

  it("confirms a single controlled franchise with identity", () => {
    const state = preparedState(1);
    const anchorId = state.user.activeOwnerTeamId;
    const result = applyConfirmControlledFranchises(state, [
      {
        teamId: anchorId,
        nickname: "Orcas",
        primaryColor: "#112233",
        secondaryColor: "#445566",
        accentColor: "#778899",
        logoId: "wolf",
      },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.user.ownedTeamIds).toEqual([anchorId]);
    expect(result.state.world.teams[anchorId]!.name).toBe("Orcas");
    expect(result.state.world.teams[anchorId]!.branding.logoId).toBe("wolf");
    expect(
      result.state.user.ownedFranchises[anchorId]!.franchiseIdentityConfirmed,
    ).toBe(true);
    const other = Object.values(result.state.world.teams).find(
      (entry) => entry.id !== anchorId,
    )!;
    const originalOther = Object.values(state.world.teams).find(
      (entry) => entry.id !== anchorId,
    )!;
    expect(other.name).toBe(originalOther.name);
  });

  it("requires exact controlledTeamCount and includes anchor", () => {
    const state = preparedState(2);
    const anchorId = state.user.activeOwnerTeamId;
    const other = Object.values(state.world.teams).find(
      (team) => team.id !== anchorId,
    )!;
    const third = Object.values(state.world.teams).find(
      (team) => team.id !== anchorId && team.id !== other.id,
    )!;

    const missingAnchor = applyConfirmControlledFranchises(state, [
      {
        teamId: other.id,
        nickname: other.name,
        primaryColor: other.branding.primaryColor,
        secondaryColor: other.branding.secondaryColor,
        accentColor: other.branding.accentColor,
        logoId: other.branding.logoId,
      },
      {
        teamId: third.id,
        nickname: "TempName",
        primaryColor: "#111111",
        secondaryColor: "#222222",
        accentColor: "#333333",
        logoId: "bear",
      },
    ]);
    expect(missingAnchor.ok).toBe(false);

    const ok = applyConfirmControlledFranchises(state, [
      {
        teamId: anchorId,
        nickname: "Anchors",
        primaryColor: "#112233",
        secondaryColor: "#445566",
        accentColor: "#778899",
        logoId: "wolf",
      },
      {
        teamId: other.id,
        nickname: "Others",
        primaryColor: "#abcdef",
        secondaryColor: "#fedcba",
        accentColor: "#121212",
        logoId: "bear",
      },
    ]);
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.state.user.ownedTeamIds).toHaveLength(2);
    expect(ok.state.user.ownedTeamIds).toContain(anchorId);
    expect(ok.state.user.ownedTeamIds).toContain(other.id);
    expect(ok.state.user.activeOwnerTeamId).toBe(anchorId);
  });
});
