/**
 * Team-color theming for the broadcast UI chrome.
 *
 * Turns persisted team branding into the `--team-*` CSS custom properties that
 * `globals.css` defines with neutral amber defaults. Set the returned object as
 * an inline `style` on a container and every primitive below it picks up the
 * team colours. Pure and deterministic; never touches game state.
 */

import {
  contrastRatio,
  parseHexColor,
  readableTextOnBackground,
} from "@/domain/color-contrast";

export type TeamThemeColors = {
  primaryColor: string;
  secondaryColor: string;
  accentColor?: string;
};

export type TeamThemeVars = {
  "--team-primary": string;
  "--team-secondary": string;
  "--team-primary-rgb": string;
  /** Black or white text that is readable on a solid primary plate. */
  "--team-on-primary": string;
  /** A team colour that is readable as text/accents on the dark arena surfaces. */
  "--team-ink": string;
  "--team-ink-rgb": string;
};

/** Raised panel surface; team ink must stay readable on it. */
export const TEAM_INK_SURFACE = "#18181B";

/** WCAG AA for normal text. */
export const TEAM_INK_MIN_CONTRAST = 4.5;

export const DEFAULT_TEAM_THEME: TeamThemeVars = {
  "--team-primary": "#D97706",
  "--team-secondary": "#F59E0B",
  "--team-primary-rgb": "217 119 6",
  "--team-on-primary": "#0A0A0A",
  "--team-ink": "#F59E0B",
  "--team-ink-rgb": "245 158 11",
};

function toRgbTriplet(hex: string): string | null {
  const rgb = parseHexColor(hex);
  return rgb ? `${rgb.r} ${rgb.g} ${rgb.b}` : null;
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((c) => Math.round(c).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

/** Mix a colour toward white by `amount` (0..1). */
function lighten(hex: string, amount: number): string {
  const rgb = parseHexColor(hex);
  if (!rgb) {
    return hex;
  }
  return toHex(
    rgb.r + (255 - rgb.r) * amount,
    rgb.g + (255 - rgb.g) * amount,
    rgb.b + (255 - rgb.b) * amount,
  );
}

function isReadableInk(hex: string): boolean {
  return (contrastRatio(hex, TEAM_INK_SURFACE) ?? 0) >= TEAM_INK_MIN_CONTRAST;
}

/**
 * Pick the first team colour readable on dark surfaces (primary, then
 * secondary, then accent). If none is, lighten the primary until it is.
 */
export function resolveTeamInk(colors: TeamThemeColors): string {
  const candidates = [
    colors.primaryColor,
    colors.secondaryColor,
    colors.accentColor,
  ].filter((c): c is string => typeof c === "string" && !!parseHexColor(c));
  const readable = candidates.find(isReadableInk);
  if (readable) {
    return readable.toUpperCase();
  }
  const base = candidates[0];
  if (!base) {
    return DEFAULT_TEAM_THEME["--team-ink"];
  }
  for (let step = 1; step <= 10; step += 1) {
    const mixed = lighten(base, step / 10);
    if (isReadableInk(mixed)) {
      return mixed;
    }
  }
  return "#FFFFFF";
}

/**
 * CSS variables for a team. Invalid or missing branding falls back to the
 * neutral amber theme so callers never need to guard.
 */
export function teamThemeVars(
  colors: TeamThemeColors | null | undefined,
): TeamThemeVars {
  if (!colors) {
    return DEFAULT_TEAM_THEME;
  }
  const primaryRgb = toRgbTriplet(colors.primaryColor);
  const secondaryRgb = toRgbTriplet(colors.secondaryColor);
  if (!primaryRgb || !secondaryRgb) {
    return DEFAULT_TEAM_THEME;
  }
  const ink = resolveTeamInk(colors);
  return {
    "--team-primary": colors.primaryColor.toUpperCase(),
    "--team-secondary": colors.secondaryColor.toUpperCase(),
    "--team-primary-rgb": primaryRgb,
    "--team-on-primary": readableTextOnBackground(colors.primaryColor),
    "--team-ink": ink,
    "--team-ink-rgb": toRgbTriplet(ink) ?? DEFAULT_TEAM_THEME["--team-ink-rgb"],
  };
}
