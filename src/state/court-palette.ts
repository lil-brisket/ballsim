/**
 * Colour palette for the Watch Game full-court broadcast floor. The floor is
 * painted in the HOME team's colours, with lines, rings and text colours
 * chosen so contrast holds whatever the franchise palette is. Pure and
 * deterministic: no React, no randomness. Callers pass
 * `team.hasBranding ? team.branding : null` to get the neutral floor.
 */
import {
  contrastRatio,
  parseHexColor,
  readableTextOnBackground,
} from "@/domain/color-contrast";
import type { TeamBrandingView } from "@/state/team-branding-view";

export type CourtPalette = {
  /** Wood under everything. */
  floor: string;
  /** Painted lanes (both keys). */
  lane: string;
  /** Band outside the boundary lines. */
  apron: string;
  /** Court lines on the bare wood. */
  line: string;
  /** Court lines, rim and backboard inside the painted lanes. */
  laneLine: string;
  /** Centre-circle ring. */
  ring: string;
  /** Baseline wordmark / apron text. */
  wordmark: string;
  /** Colours for TeamLogoMark at centre court; null on a neutral floor. */
  logo: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    logoId: string;
  } | null;
  /** Opacity for the centre logo so it never hides tokens or the ball. */
  logoOpacity: number;
  /** Courtside LED ribbon panel along the far sideline. */
  ribbon: string;
  /** LED text on the ribbon: a home colour when one reads at 4.5:1. */
  ribbonInk: string;
};

/** WCAG 1.4.11 graphics contrast. */
export const COURT_LINE_MIN_CONTRAST = 3;
/** WCAG AA text contrast. */
export const COURT_TEXT_MIN_CONTRAST = 4.5;

/** Light maple hardwood, lit. Lines on it must be dark. */
const FLOOR = "#D9B382";
/** Dark stained wood the apron blends toward. */
const APRON_BASE = "#2B2118";
const WHITE_LINE = "#F4F4F5";
const BLACK_LINE = "#0A0A0A";
const NEUTRAL_LINE = "#1C1917";
const WHITE_OUTLINE = "#FFFFFF";
const MID_OUTLINE = "#7C7C7C";
const LOGO_OPACITY = 0.35;
const RIBBON = "#0B0B0C";
const ALPHA_STEP = 0.05;

function toHex(channel: number): string {
  return Math.round(Math.min(255, Math.max(0, channel)))
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
}

/** Blend `fg` over `bg` at `alpha` (1 = all fg). Returns uppercase #RRGGBB. */
function mix(fg: string, bg: string, alpha: number): string {
  const a = parseHexColor(fg);
  const b = parseHexColor(bg);
  if (!a || !b) {
    return bg.toUpperCase();
  }
  return `#${toHex(a.r * alpha + b.r * (1 - alpha))}${toHex(
    a.g * alpha + b.g * (1 - alpha),
  )}${toHex(a.b * alpha + b.b * (1 - alpha))}`;
}

function ratio(a: string, b: string): number {
  return contrastRatio(a, b) ?? 0;
}

/** Alpha steps from `start` down to 0, computed on integers to avoid drift. */
function alphaSteps(start: number): number[] {
  const steps: number[] = [];
  const count = Math.round(start / ALPHA_STEP);
  for (let i = count; i >= 0; i -= 1) {
    steps.push(Math.round(i * ALPHA_STEP * 100) / 100);
  }
  return steps;
}

function neutralPalette(): CourtPalette {
  const apron = APRON_BASE;
  return {
    floor: FLOOR,
    lane: mix("#000000", FLOOR, 0.12),
    apron,
    line: NEUTRAL_LINE,
    laneLine: NEUTRAL_LINE,
    ring: NEUTRAL_LINE,
    wordmark: readableTextOnBackground(apron),
    logo: null,
    logoOpacity: LOGO_OPACITY,
    ribbon: RIBBON,
    ribbonInk: "#D4D4D8",
  };
}

export function buildCourtPalette(home: TeamBrandingView | null): CourtPalette {
  if (!home) {
    return neutralPalette();
  }

  const lane = home.primaryColor.toUpperCase();
  const line =
    [BLACK_LINE, home.secondaryColor].find(
      (candidate) => ratio(candidate, FLOOR) >= COURT_LINE_MIN_CONTRAST,
    ) ?? BLACK_LINE;
  const laneLine =
    [WHITE_LINE, home.secondaryColor, BLACK_LINE].find(
      (candidate) => ratio(candidate, lane) >= COURT_LINE_MIN_CONTRAST,
    ) ?? WHITE_LINE;

  let apron = APRON_BASE;
  let wordmark: string = readableTextOnBackground(APRON_BASE);
  for (const alpha of alphaSteps(0.7)) {
    apron = mix(home.primaryColor, APRON_BASE, alpha);
    wordmark = readableTextOnBackground(apron);
    if (ratio(wordmark, apron) >= COURT_TEXT_MIN_CONTRAST) {
      break;
    }
  }

  const ring =
    ratio(home.accentColor, FLOOR) >= COURT_LINE_MIN_CONTRAST
      ? home.accentColor
      : line;

  return {
    floor: FLOOR,
    lane,
    apron,
    line,
    laneLine,
    ring,
    wordmark,
    logo: { ...home },
    logoOpacity: LOGO_OPACITY,
    ribbon: RIBBON,
    ribbonInk:
      [home.primaryColor, home.secondaryColor, home.accentColor].find(
        (color) => ratio(color, RIBBON) >= COURT_TEXT_MIN_CONTRAST,
      ) ?? WHITE_LINE,
  };
}

export type TokenOutline = {
  /** Ring drawn on the token's edge; always 3:1 against the token fill. */
  ring: string;
  /**
   * Thin opposite-colour halo outside the ring, only when no single ring
   * clears the token, the lane and the floor; null otherwise.
   */
  halo: string | null;
};

/**
 * Token edge colours that keep a player token visible against its own fill,
 * the lane it may sit on and the bare floor (where tokens spend most time).
 * One ring when a single colour can do all three; otherwise a ring for the
 * token plus the palette line colour as a halo, which clears the floor. The
 * halo separates the token from the wood; on a lane, whichever of ring and
 * halo contrasts with the lane does that job.
 */
export function tokenOutline(
  tokenColor: string,
  palette: CourtPalette,
): TokenOutline {
  const clears = (a: string, b: string) =>
    ratio(a, b) >= COURT_LINE_MIN_CONTRAST;
  // Pure white clears saturated mid tones that off-white misses.
  const single = [WHITE_OUTLINE, BLACK_LINE, palette.line, MID_OUTLINE].find(
    (candidate) =>
      clears(candidate, tokenColor) &&
      clears(candidate, palette.lane) &&
      clears(candidate, palette.floor),
  );
  if (single !== undefined) {
    return { ring: single, halo: null };
  }
  const halo = palette.line;
  const ring =
    [WHITE_OUTLINE, BLACK_LINE, MID_OUTLINE].find(
      (candidate) => clears(candidate, tokenColor) && clears(candidate, halo),
    ) ??
    (ratio(WHITE_OUTLINE, tokenColor) >= ratio(BLACK_LINE, tokenColor)
      ? WHITE_OUTLINE
      : BLACK_LINE);
  return { ring, halo };
}
