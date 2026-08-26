/**
 * Owner franchise identity confirmation (new-game branding step).
 *
 * franchiseIdentityConfirmed is ONBOARDING ONLY — it does not permanently lock branding.
 */

import type { TeamColorPaletteId } from "@/data/team-branding/color-palettes";
import {
  isTeamColorPaletteId,
  brandingFromPalette,
} from "@/domain/entities/team-branding";
import { isTeamLogoId, type TeamLogoId } from "@/data/team-branding/logo-catalog";
import { validateTeamNickname } from "@/domain/team-nickname";
import type { GameState } from "@/state/game-state";
import { TEAM_NICKNAMES } from "@/data/league/team-nicknames";
import { nextNicknameFromPool } from "@/domain/team-nickname";
import {
  TEAM_COLOR_PALETTES,
} from "@/data/team-branding/color-palettes";
import { TEAM_LOGO_IDS } from "@/data/team-branding/logo-catalog";

export type ApplyOwnerFranchiseBrandingInput = {
  nickname: string;
  paletteId: string;
  logoId: string;
};

export type ApplyOwnerFranchiseBrandingResult =
  | { ok: true; state: GameState }
  | { ok: false; error: string };

export type RandomizedTeamIdentity = {
  nickname: string;
  paletteId: TeamColorPaletteId;
  logoId: TeamLogoId;
};

/**
 * Pure state transition: persist customized nickname + branding and mark
 * initial franchise identity setup complete.
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

  if (!isTeamColorPaletteId(input.paletteId)) {
    return { ok: false, error: `Unknown colour palette "${input.paletteId}".` };
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

  const branding = brandingFromPalette(input.paletteId, input.logoId);

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
 * Client helper: cycle nickname + palette + logo while keeping city fixed.
 * Pure — does not mutate GameState.
 */
export function randomizeTeamIdentityDraft(input: {
  currentNickname: string;
  currentPaletteId: TeamColorPaletteId;
  currentLogoId: TeamLogoId;
  usedNicknames: readonly string[];
  step?: number;
}): RandomizedTeamIdentity {
  const step = input.step ?? 1;
  const nickname =
    nextNicknameFromPool(
      input.currentNickname,
      TEAM_NICKNAMES,
      input.usedNicknames,
    ) ?? input.currentNickname;

  const paletteIndex = TEAM_COLOR_PALETTES.findIndex(
    (palette) => palette.id === input.currentPaletteId,
  );
  const logoIndex = TEAM_LOGO_IDS.indexOf(input.currentLogoId);
  const nextPalette =
    TEAM_COLOR_PALETTES[
      ((paletteIndex < 0 ? 0 : paletteIndex) + step) %
        TEAM_COLOR_PALETTES.length
    ]!;
  const nextLogo =
    TEAM_LOGO_IDS[
      ((logoIndex < 0 ? 0 : logoIndex) + step) % TEAM_LOGO_IDS.length
    ]!;

  return {
    nickname,
    paletteId: nextPalette.id,
    logoId: nextLogo,
  };
}
