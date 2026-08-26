import { describe, expect, it } from "vitest";
import {
  applyOwnerFranchiseBranding,
  randomizeTeamIdentityDraft,
} from "@/systems/owner-franchise-branding";
import { applyOwnerCitySelection } from "@/systems/owner-city-selection";
import {
  CBL_GAME_SETTINGS,
  cloneGameSettings,
} from "@/domain/game-settings";
import { createInitialGameState } from "@/state/create-initial-state";
import { listCitiesForTeamPick } from "@/state/selectors";
import { getTeamIdentityFingerprint } from "@/domain/team-identity";
import { resolvePaletteIdFromBranding } from "@/domain/entities/team-branding";
import { TEST_RNG_SEED } from "../helpers/determinism";

function createStateAfterCity() {
  const settings = cloneGameSettings(CBL_GAME_SETTINGS);
  settings.league.area = "north_america";
  const state = createInitialGameState({
    saveId: "branding_test",
    rngSeed: TEST_RNG_SEED,
    settings,
  });
  const city = listCitiesForTeamPick(state)[0]!.city;
  const applied = applyOwnerCitySelection(state, city);
  if (!applied.ok) {
    throw new Error(applied.error);
  }
  return applied.state;
}

describe("applyOwnerFranchiseBranding", () => {
  it("confirms customized nickname and branding", () => {
    const state = createStateAfterCity();
    const teamId = state.user.controlledTeamId;
    const result = applyOwnerFranchiseBranding(state, {
      nickname: "Titans",
      paletteId: "crimson_gold",
      logoId: "wolf",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const team = result.state.world.teams[teamId]!;
    expect(team.name).toBe("Titans");
    expect(team.branding.logoId).toBe("wolf");
    expect(resolvePaletteIdFromBranding(team.branding)).toBe("crimson_gold");
    expect(result.state.user.franchiseIdentityConfirmed).toBe(true);
  });

  it("rejects empty nicknames", () => {
    const state = createStateAfterCity();
    const result = applyOwnerFranchiseBranding(state, {
      nickname: "   ",
      paletteId: "midnight_navy",
      logoId: "shield",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects before city selection", () => {
    const settings = cloneGameSettings(CBL_GAME_SETTINGS);
    const state = createInitialGameState({
      saveId: "branding_early",
      rngSeed: TEST_RNG_SEED,
      settings,
    });
    const result = applyOwnerFranchiseBranding(state, {
      nickname: "Storm",
      paletteId: "midnight_navy",
      logoId: "shield",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects after already confirmed", () => {
    const state = createStateAfterCity();
    const first = applyOwnerFranchiseBranding(state, {
      nickname: "Storm",
      paletteId: "midnight_navy",
      logoId: "shield",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    const second = applyOwnerFranchiseBranding(first.state, {
      nickname: "Wolves",
      paletteId: "crimson_gold",
      logoId: "wolf",
    });
    expect(second.ok).toBe(false);
  });
});

describe("randomizeTeamIdentityDraft", () => {
  it("changes nickname palette or logo while remaining valid", () => {
    const next = randomizeTeamIdentityDraft({
      currentNickname: "Huskies",
      currentPaletteId: "midnight_navy",
      currentLogoId: "shield",
      usedNicknames: ["Huskies"],
    });
    expect(next.paletteId).not.toBe("midnight_navy");
    expect(next.logoId).not.toBe("shield");
    expect(next.nickname.length).toBeGreaterThan(0);
  });
});

describe("identity fingerprint stability after branding", () => {
  it("fingerprint reflects confirmed branding", () => {
    const state = createStateAfterCity();
    const teamId = state.user.controlledTeamId;
    const result = applyOwnerFranchiseBranding(state, {
      nickname: "Royals",
      paletteId: "royal_purple",
      logoId: "crown",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const fingerprint = getTeamIdentityFingerprint(
      result.state.world.teams[teamId]!,
    );
    expect(fingerprint.name).toBe("Royals");
    expect(fingerprint.logoId).toBe("crown");
  });
});
