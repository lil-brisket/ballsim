import { describe, expect, it } from "vitest";
import {
  applyOwnerFranchiseBranding,
  randomizeLogoId,
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
import {
  brandingFromPalette,
  resolvePaletteIdFromBranding,
} from "@/domain/entities/team-branding";
import { createSeededRng } from "@/domain/rng";
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
  it("confirms customized nickname and branding via paletteId fallback", () => {
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

  it("persists explicit hex colours when all three are present", () => {
    const state = createStateAfterCity();
    const teamId = state.user.controlledTeamId;
    const result = applyOwnerFranchiseBranding(state, {
      nickname: "Titans",
      logoId: "shield",
      primaryColor: "#123456",
      secondaryColor: "#F5F5F5",
      accentColor: "#FFB000",
      paletteId: "crimson_gold",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const team = result.state.world.teams[teamId]!;
    expect(team.branding.primaryColor).toBe("#123456");
    expect(team.branding.secondaryColor).toBe("#F5F5F5");
    expect(team.branding.accentColor).toBe("#FFB000");
    expect(team.branding.logoId).toBe("shield");
    expect(resolvePaletteIdFromBranding(team.branding)).toBeNull();
  });

  it("persists a modified preset without reconstructing the original palette", () => {
    const state = createStateAfterCity();
    const teamId = state.user.controlledTeamId;
    const base = brandingFromPalette("royal_purple", "crown");
    const result = applyOwnerFranchiseBranding(state, {
      nickname: "Royals",
      logoId: "crown",
      primaryColor: base.primaryColor,
      secondaryColor: base.secondaryColor,
      accentColor: "#AABBCC",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const team = result.state.world.teams[teamId]!;
    expect(team.branding.accentColor).toBe("#AABBCC");
    expect(resolvePaletteIdFromBranding(team.branding)).toBeNull();
  });

  it("rejects partial explicit colour submissions", () => {
    const state = createStateAfterCity();
    const result = applyOwnerFranchiseBranding(state, {
      nickname: "Storm",
      logoId: "shield",
      primaryColor: "#123456",
      paletteId: "midnight_navy",
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toMatch(/all three colours/i);
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
  it("changes identity while remaining valid and never returns city", () => {
    const rng = createSeededRng(42);
    const next = randomizeTeamIdentityDraft({
      currentNickname: "Huskies",
      currentPaletteId: "midnight_navy",
      currentLogoId: "shield",
      usedNicknames: ["Huskies"],
      rng,
    });
    expect(next.nickname.length).toBeGreaterThan(0);
    expect(next.primaryColor).toMatch(/^#[0-9A-F]{6}$/i);
    expect(next.secondaryColor).toMatch(/^#[0-9A-F]{6}$/i);
    expect(next.accentColor).toMatch(/^#[0-9A-F]{6}$/i);
    expect(next.logoId.length).toBeGreaterThan(0);
    expect(
      `${next.nickname}|${next.paletteId}|${next.logoId}`,
    ).not.toBe("Huskies|midnight_navy|shield");
    expect(next).not.toHaveProperty("city");
  });

  it("randomizeLogoId picks a different logo", () => {
    const rng = createSeededRng(7);
    const next = randomizeLogoId("wolf", rng);
    expect(next).not.toBe("wolf");
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
