/**
 * Owner franchise identity confirmation (new-game branding step).
 *
 * franchiseIdentityConfirmed is ONBOARDING ONLY — it does not permanently lock branding.
 */

import type { TeamColorPaletteId } from "@/data/team-branding/color-palettes";
import {
  brandingFromPalette,
  isTeamColorPaletteId,
  validateTeamBranding,
} from "@/domain/entities/team-branding";
import { isTeamLogoId, type TeamLogoId } from "@/data/team-branding/logo-catalog";
import { validateTeamNickname } from "@/domain/team-nickname";
import type { GameState } from "@/state/game-state";
import { TEAM_NICKNAMES } from "@/data/league/team-nicknames";
import {
  TEAM_COLOR_PALETTES,
} from "@/data/team-branding/color-palettes";
import { TEAM_LOGO_IDS } from "@/data/team-branding/logo-catalog";
import type { Rng } from "@/domain/rng";
import { createSeededRng } from "@/domain/rng";

export type ApplyOwnerFranchiseBrandingInput = {
  nickname: string;
  logoId: string;
  /** Legacy path: used only when all three colour fields are absent. */
  paletteId?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
};

export type ApplyOwnerFranchiseBrandingResult =
  | { ok: true; state: GameState }
  | { ok: false; error: string };

export type RandomizedTeamIdentity = {
  nickname: string;
  paletteId: TeamColorPaletteId;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoId: TeamLogoId;
};

function isPresentColor(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Pure state transition: persist customized nickname + branding and mark
 * initial franchise identity setup complete.
 *
 * Explicit colour input is atomic:
 * - all three hex present → validate and persist those colours
 * - none present → legacy paletteId fallback
 * - some but not all → validation error (no silent palette fallback)
 */
export function applyOwnerFranchiseBranding(
  state: GameState,
  input: ApplyOwnerFranchiseBrandingInput,
): ApplyOwnerFranchiseBrandingResult {
  if (!state.user.citySelectionConfirmed) {
    return {
      ok: false,
      error: "Choose a city before confirming team identity.",
    };
  }
  if (state.user.franchiseIdentityConfirmed) {
    return {
      ok: false,
      error: "Franchise identity is already confirmed for this save.",
    };
  }
  if (state.world.calendar.lastSimulatedDate !== null) {
    return {
      ok: false,
      error:
        "Team identity setup is locked after the first time advance for this save.",
    };
  }

  if (!isTeamLogoId(input.logoId)) {
    return { ok: false, error: `Unknown logo "${input.logoId}".` };
  }

  const teamId = state.user.controlledTeamId;
  const team = state.world.teams[teamId];
  if (!team) {
    return {
      ok: false,
      error: `Controlled team "${teamId}" is missing from world.teams.`,
    };
  }

  const nick = validateTeamNickname(input.nickname, {
    city: team.city,
    existingTeams: Object.values(state.world.teams).map((entry) => ({
      id: entry.id,
      city: entry.city,
      name: entry.name,
    })),
    excludeTeamId: teamId,
  });
  if (!nick.ok) {
    return { ok: false, error: nick.error };
  }

  const hasPrimary = isPresentColor(input.primaryColor);
  const hasSecondary = isPresentColor(input.secondaryColor);
  const hasAccent = isPresentColor(input.accentColor);
  const presentCount = [hasPrimary, hasSecondary, hasAccent].filter(Boolean)
    .length;

  let branding;
  if (presentCount === 3) {
    const validated = validateTeamBranding({
      primaryColor: input.primaryColor!,
      secondaryColor: input.secondaryColor!,
      accentColor: input.accentColor!,
      logoId: input.logoId,
    });
    if (!validated.ok) {
      return { ok: false, error: validated.error };
    }
    branding = validated.value;
  } else if (presentCount === 0) {
    if (!input.paletteId || !isTeamColorPaletteId(input.paletteId)) {
      return {
        ok: false,
        error: `Unknown colour palette "${input.paletteId ?? ""}".`,
      };
    }
    branding = brandingFromPalette(input.paletteId, input.logoId);
  } else {
    return {
      ok: false,
      error:
        "Provide all three colours (primary, secondary, and accent) or none.",
    };
  }

  return {
    ok: true,
    state: {
      ...state,
      world: {
        ...state.world,
        teams: {
          ...state.world.teams,
          [teamId]: {
            ...team,
            name: nick.value,
            branding,
          },
        },
      },
      user: {
        ...state.user,
        franchiseIdentityConfirmed: true,
      },
    },
  };
}

/**
 * Client helper: randomly select nickname + curated palette + logo.
 * Never changes city. Pure — does not mutate GameState.
 * Avoids returning the exact same complete identity when alternatives exist.
 */
export function randomizeTeamIdentityDraft(input: {
  currentNickname: string;
  currentPaletteId: TeamColorPaletteId | null;
  currentLogoId: TeamLogoId;
  currentPrimaryColor?: string;
  currentSecondaryColor?: string;
  currentAccentColor?: string;
  usedNicknames: readonly string[];
  rng?: Rng;
}): RandomizedTeamIdentity {
  const rng = input.rng ?? createSeededRng(Date.now());

  const used = new Set(
    input.usedNicknames.map((name) => name.toLowerCase()),
  );
  const availableNicknames = TEAM_NICKNAMES.filter((name) => {
    const key = name.toLowerCase();
    if (key === input.currentNickname.toLowerCase()) {
      return true;
    }
    return !used.has(key);
  });
  const nicknamePool =
    availableNicknames.length > 0 ? availableNicknames : [...TEAM_NICKNAMES];

  const currentKey = identityKey({
    nickname: input.currentNickname,
    paletteId: input.currentPaletteId,
    logoId: input.currentLogoId,
  });

  const maxAttempts = 24;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const palette = rng.pick(TEAM_COLOR_PALETTES);
    const logoId = rng.pick(TEAM_LOGO_IDS);
    const nickname = rng.pick(nicknamePool);
    const nextKey = identityKey({
      nickname,
      paletteId: palette.id,
      logoId,
    });
    if (nextKey !== currentKey) {
      return {
        nickname,
        paletteId: palette.id,
        primaryColor: palette.primaryColor,
        secondaryColor: palette.secondaryColor,
        accentColor: palette.accentColor,
        logoId,
      };
    }
  }

  const palette = TEAM_COLOR_PALETTES[0]!;
  const logoId =
    TEAM_LOGO_IDS.find((id) => id !== input.currentLogoId) ??
    TEAM_LOGO_IDS[0]!;
  const nickname =
    nicknamePool.find(
      (name) => name.toLowerCase() !== input.currentNickname.toLowerCase(),
    ) ?? nicknamePool[0]!;
  return {
    nickname,
    paletteId: palette.id,
    primaryColor: palette.primaryColor,
    secondaryColor: palette.secondaryColor,
    accentColor: palette.accentColor,
    logoId,
  };
}

function identityKey(input: {
  nickname: string;
  paletteId: TeamColorPaletteId | null;
  logoId: TeamLogoId;
}): string {
  return `${input.nickname.toLowerCase()}|${input.paletteId ?? "custom"}|${input.logoId}`;
}

/**
 * Pick a different logo from the catalog (random).
 */
export function randomizeLogoId(
  currentLogoId: TeamLogoId,
  rng?: Rng,
): TeamLogoId {
  const generator = rng ?? createSeededRng(Date.now());
  const alternatives = TEAM_LOGO_IDS.filter((id) => id !== currentLogoId);
  if (alternatives.length === 0) {
    return currentLogoId;
  }
  return generator.pick(alternatives);
}
