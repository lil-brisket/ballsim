/**
 * Deterministic team branding generation with league visual diversity.
 */

import {
  TEAM_COLOR_PALETTES,
  type TeamColorPaletteId,
} from "@/data/team-branding/color-palettes";
import {
  TEAM_LOGO_IDS,
  type TeamLogoId,
} from "@/data/team-branding/logo-catalog";
import {
  brandingFromPalette,
  type TeamBranding,
} from "@/domain/entities/team-branding";
import type { Rng } from "@/domain/rng";
import { paletteLogoKey } from "@/domain/team-identity";

export type GenerateTeamBrandingInput = {
  teamId: string;
  city?: string;
  name?: string;
  /** Existing league branding keys (paletteId|logoId) to encourage diversity. */
  usedPaletteLogoKeys?: ReadonlySet<string>;
};

/**
 * Hash team identity into a stable non-negative integer for seeded picks
 * when no RNG is available (migration fallbacks).
 */
export function hashTeamIdentitySeed(
  teamId: string,
  city = "",
  name = "",
): number {
  const source = `${teamId}|${city}|${name}`;
  let hash = 2166136261;
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pickFromIndex<T>(items: readonly T[], index: number): T {
  return items[((index % items.length) + items.length) % items.length]!;
}

function candidateOrder(
  startPaletteIndex: number,
  startLogoIndex: number,
): Array<{ paletteId: TeamColorPaletteId; logoId: TeamLogoId }> {
  const candidates: Array<{
    paletteId: TeamColorPaletteId;
    logoId: TeamLogoId;
  }> = [];
  const paletteCount = TEAM_COLOR_PALETTES.length;
  const logoCount = TEAM_LOGO_IDS.length;
  const total = paletteCount * logoCount;
  for (let offset = 0; offset < total; offset += 1) {
    const paletteIndex = (startPaletteIndex + offset) % paletteCount;
    const logoIndex =
      (startLogoIndex + Math.floor(offset / paletteCount)) % logoCount;
    candidates.push({
      paletteId: TEAM_COLOR_PALETTES[paletteIndex]!.id,
      logoId: TEAM_LOGO_IDS[logoIndex]!,
    });
  }
  return candidates;
}

/**
 * Choose branding for a team. Prefer unused palette+logo pairs when
 * `usedPaletteLogoKeys` is provided; falls back to first candidate if all taken.
 */
export function selectTeamBrandingCandidate(
  input: GenerateTeamBrandingInput,
  startPaletteIndex: number,
  startLogoIndex: number,
): { paletteId: TeamColorPaletteId; logoId: TeamLogoId; branding: TeamBranding } {
  const used = input.usedPaletteLogoKeys;
  const candidates = candidateOrder(startPaletteIndex, startLogoIndex);
  let chosen = candidates[0]!;
  if (used && used.size > 0) {
    const fresh = candidates.find(
      (candidate) =>
        !used.has(paletteLogoKey(candidate.paletteId, candidate.logoId)),
    );
    if (fresh) {
      chosen = fresh;
    }
  }
  return {
    paletteId: chosen.paletteId,
    logoId: chosen.logoId,
    branding: brandingFromPalette(chosen.paletteId, chosen.logoId),
  };
}

/**
 * Deterministic branding from team identity seed (no RNG).
 * Used for migration defaults and stable fallbacks.
 */
export function deriveDefaultTeamBranding(
  teamId: string,
  city = "",
  name = "",
  usedPaletteLogoKeys?: ReadonlySet<string>,
): TeamBranding {
  const seed = hashTeamIdentitySeed(teamId, city, name);
  const startPaletteIndex = seed % TEAM_COLOR_PALETTES.length;
  const startLogoIndex =
    Math.floor(seed / TEAM_COLOR_PALETTES.length) % TEAM_LOGO_IDS.length;
  return selectTeamBrandingCandidate(
    { teamId, city, name, usedPaletteLogoKeys },
    startPaletteIndex,
    startLogoIndex,
  ).branding;
}

/**
 * RNG-backed branding for league generation. Same seed + order → same result.
 */
export function generateTeamBranding(
  input: GenerateTeamBrandingInput,
  rng: Rng,
): TeamBranding {
  const startPaletteIndex = rng.nextInt(0, TEAM_COLOR_PALETTES.length - 1);
  const startLogoIndex = rng.nextInt(0, TEAM_LOGO_IDS.length - 1);
  return selectTeamBrandingCandidate(
    input,
    startPaletteIndex,
    startLogoIndex,
  ).branding;
}

export function pickRandomPaletteAndLogo(rng: Rng): {
  paletteId: TeamColorPaletteId;
  logoId: TeamLogoId;
} {
  return {
    paletteId: pickFromIndex(
      TEAM_COLOR_PALETTES,
      rng.nextInt(0, TEAM_COLOR_PALETTES.length - 1),
    ).id,
    logoId: pickFromIndex(
      TEAM_LOGO_IDS,
      rng.nextInt(0, TEAM_LOGO_IDS.length - 1),
    ),
  };
}
