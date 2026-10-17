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
  /** Court lines, rims and the rim flash. */
  line: string;
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
};

/** WCAG 1.4.11 graphics contrast. */
export const COURT_LINE_MIN_CONTRAST = 3;
/** WCAG AA text contrast. */
export const COURT_TEXT_MIN_CONTRAST = 4.5;

/** Dark stained wood. */
const FLOOR = "#1A140E";
const WHITE_LINE = "#F4F4F5";
const BLACK_LINE = "#0A0A0A";
const NEUTRAL_LINE = "#D4D4D8";
const WHITE_OUTLINE = "#FFFFFF";
const MID_OUTLINE = "#7C7C7C";
const LOGO_OPACITY = 0.35;
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
  const apron = FLOOR;
  return {
    floor: FLOOR,
    lane: mix("#FFFFFF", FLOOR, 0.06),
    apron,
    line: NEUTRAL_LINE,
    ring: NEUTRAL_LINE,
    wordmark: readableTextOnBackground(apron),
    logo: null,
    logoOpacity: LOGO_OPACITY,
  };
}

export function buildCourtPalette(home: TeamBrandingView | null): CourtPalette {
  if (!home) {
    return neutralPalette();
  }

  const candidates = [WHITE_LINE, home.secondaryColor, BLACK_LINE];
  let lane = FLOOR;
  let line = WHITE_LINE;
  for (const alpha of alphaSteps(0.45)) {
    const tryLane = mix(home.primaryColor, FLOOR, alpha);
    const pick = candidates.find(
      (candidate) =>
        ratio(candidate, FLOOR) >= COURT_LINE_MIN_CONTRAST &&
        ratio(candidate, tryLane) >= COURT_LINE_MIN_CONTRAST,
    );
    if (pick !== undefined) {
      lane = tryLane;
      line = pick;
      break;
    }
  }

  let apron = FLOOR;
  let wordmark: string = readableTextOnBackground(FLOOR);
  for (const alpha of alphaSteps(0.7)) {
    apron = mix(home.primaryColor, FLOOR, alpha);
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
    ring,
    wordmark,
    logo: { ...home },
    logoOpacity: LOGO_OPACITY,
  };
}

export type TokenOutline = {
  /** Ring drawn on the token's edge; always 3:1 against the token fill. */
  ring: string;
  /**
   * Thin opposite-colour halo outside the ring, only when the ring alone
   * cannot also reach 3:1 against the lane (a white token on a mid-tone
   * lane); null otherwise.
   */
  halo: string | null;
};

/**
 * Token edge colours that keep a player token visible against both its own
 * fill and the lane it may sit on (including a home token on its own key).
 * One ring when a single colour can do both; otherwise a ring for the token
 * plus an opposite halo for the lane (black and white are ~19:1 apart, so the
 * ring and halo always separate).
 */
export function tokenOutline(
  tokenColor: string,
  palette: CourtPalette,
): TokenOutline {
  // Pure white clears saturated mid tones (magenta) that off-white misses;
  // the mid grey covers a white token on a dark lane.
  const candidates = [WHITE_OUTLINE, BLACK_LINE, palette.line, MID_OUTLINE];
  const single = candidates.find(
    (candidate) =>
      ratio(candidate, tokenColor) >= COURT_LINE_MIN_CONTRAST &&
      ratio(candidate, palette.lane) >= COURT_LINE_MIN_CONTRAST,
  );
  if (single !== undefined) {
    return { ring: single, halo: null };
  }
  const ring =
    ratio(WHITE_OUTLINE, tokenColor) >= ratio(BLACK_LINE, tokenColor)
      ? WHITE_OUTLINE
      : BLACK_LINE;
  return { ring, halo: ring === WHITE_OUTLINE ? BLACK_LINE : WHITE_OUTLINE };
}
