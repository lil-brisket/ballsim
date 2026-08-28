/**
 * Luminance / contrast helpers for team identity previews.
 * Never assume primary colour is safe as text colour.
 */

const HEX_COLOR = /^#([0-9A-Fa-f]{6})$/;

/** Distinguishability heuristic for franchise colour pairs (not a WCAG gate). */
export const IDENTITY_DISTINGUISHABILITY_RATIO = 3;

/**
 * Accent pairs below 3:1 only warn when also chromatically close.
 * Avoids false positives like light secondary + gold accents on curated palettes.
 */
export const IDENTITY_ACCENT_CHROMA_DISTANCE = 80;

export type TeamIdentityContrastWarning = {
  kind: "primary_accent" | "secondary_accent" | "primary_secondary";
  message: string;
};

export function parseHexColor(
  hex: string,
): { r: number; g: number; b: number } | null {
  const match = HEX_COLOR.exec(hex.trim());
  if (!match) {
    return null;
  }
  const value = match[1]!;
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

/** Relative luminance per WCAG (sRGB). */
export function relativeLuminance(hex: string): number | null {
  const rgb = parseHexColor(hex);
  if (!rgb) {
    return null;
  }
  const channel = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel(rgb.r) +
    0.7152 * channel(rgb.g) +
    0.0722 * channel(rgb.b)
  );
}

export function contrastRatio(
  foregroundHex: string,
  backgroundHex: string,
): number | null {
  const fg = relativeLuminance(foregroundHex);
  const bg = relativeLuminance(backgroundHex);
  if (fg === null || bg === null) {
    return null;
  }
  const lighter = Math.max(fg, bg);
  const darker = Math.min(fg, bg);
  return (lighter + 0.05) / (darker + 0.05);
}

export function rgbDistance(aHex: string, bHex: string): number | null {
  const a = parseHexColor(aHex);
  const b = parseHexColor(bHex);
  if (!a || !b) {
    return null;
  }
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Pick black or white text for readable contrast against a background colour.
 */
export function readableTextOnBackground(
  backgroundHex: string,
): "#FFFFFF" | "#0A0A0A" {
  const whiteRatio = contrastRatio("#FFFFFF", backgroundHex);
  const blackRatio = contrastRatio("#0A0A0A", backgroundHex);
  if (whiteRatio === null || blackRatio === null) {
    return "#FFFFFF";
  }
  return whiteRatio >= blackRatio ? "#FFFFFF" : "#0A0A0A";
}

function homeAwayHardToDistinguish(a: string, b: string): boolean {
  const ratio = contrastRatio(a, b);
  if (ratio === null) {
    return false;
  }
  return ratio < IDENTITY_DISTINGUISHABILITY_RATIO;
}

function accentHardToDistinguish(base: string, accent: string): boolean {
  const ratio = contrastRatio(base, accent);
  const distance = rgbDistance(base, accent);
  if (ratio === null || distance === null) {
    return false;
  }
  if (ratio >= IDENTITY_DISTINGUISHABILITY_RATIO) {
    return false;
  }
  return distance < IDENTITY_ACCENT_CHROMA_DISTANCE;
}

/**
 * Design/readability warnings for franchise colour combinations.
 * Non-blocking — never treat these as accessibility failures or hard gates.
 */
export function evaluateTeamIdentityContrast(input: {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}): TeamIdentityContrastWarning[] {
  const warnings: TeamIdentityContrastWarning[] = [];
  if (accentHardToDistinguish(input.primaryColor, input.accentColor)) {
    warnings.push({
      kind: "primary_accent",
      message:
        "Accent colour may be difficult to distinguish from primary.",
    });
  }
  if (accentHardToDistinguish(input.secondaryColor, input.accentColor)) {
    warnings.push({
      kind: "secondary_accent",
      message:
        "Accent colour may be difficult to distinguish from secondary.",
    });
  }
  if (homeAwayHardToDistinguish(input.primaryColor, input.secondaryColor)) {
    warnings.push({
      kind: "primary_secondary",
      message: "Home and away colours may be hard to tell apart.",
    });
  }
  return warnings;
}
