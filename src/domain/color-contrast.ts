/**
 * Luminance / contrast helpers for team identity previews.
 * Never assume primary colour is safe as text colour.
 */

const HEX_COLOR = /^#([0-9A-Fa-f]{6})$/;

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

export function contrastRatio(foregroundHex: string, backgroundHex: string): number | null {
  const fg = relativeLuminance(foregroundHex);
  const bg = relativeLuminance(backgroundHex);
  if (fg === null || bg === null) {
    return null;
  }
  const lighter = Math.max(fg, bg);
  const darker = Math.min(fg, bg);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Pick black or white text for readable contrast against a background colour.
 */
export function readableTextOnBackground(backgroundHex: string): "#FFFFFF" | "#0A0A0A" {
  const whiteRatio = contrastRatio("#FFFFFF", backgroundHex);
  const blackRatio = contrastRatio("#0A0A0A", backgroundHex);
  if (whiteRatio === null || blackRatio === null) {
    return "#FFFFFF";
  }
  return whiteRatio >= blackRatio ? "#FFFFFF" : "#0A0A0A";
}
