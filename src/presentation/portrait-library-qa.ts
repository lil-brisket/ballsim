/**
 * Pure layout and colour maths for the portrait mask QA sheet
 * (scripts/qa-portrait-masks.ts). The sheet shows every library image on a
 * grid of jersey colours and sizes, composited the way PlayerPortrait does, so
 * a bad jersey mask is obvious. No I/O: the script does the image work.
 */

/** Jersey colours the QA sheet tries: white, grey, gold, red, navy, black. */
export const QA_JERSEY_COLORS = [
  "#ffffff",
  "#c4ced4",
  "#fdb927",
  "#c8102e",
  "#0b1f3a",
  "#111111",
] as const;

/** Rendered sizes (columns); each uses the matching shipped image variant. */
export const QA_SIZES = [128, 256, 512] as const;
export type QaSize = (typeof QA_SIZES)[number];

/** Trim colour fed to the backdrop mix (a bright team secondary). */
export const QA_TRIM_COLOR = "#fdb927";
export const QA_BACKDROP_BASE = "#09090b";
/** PlayerPortrait: color-mix(in srgb, trim 60%, #09090b). */
export const QA_BACKDROP_TRIM_SHARE = 0.6;

export const QA_ZOOM_FACTOR = 3;
/** Neck/shoulder crop of the 512 cell, as fractions of the cell. */
export const QA_ZOOM_CROP = { x: 0.25, y: 0.5, width: 0.5, height: 0.25 };

export type QaRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type QaRowLayout = {
  color: string;
  cells: Array<QaRect & { size: QaSize }>;
  /** Source rectangle inside the 512 cell (cell-relative). */
  crop: QaRect;
  /** Where the zoomed crop is drawn on the sheet. */
  zoom: QaRect;
};

export type QaSheetLayout = {
  width: number;
  height: number;
  rows: QaRowLayout[];
};

function parseHex(hex: string): [number, number, number] {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (match === null) throw new Error(`Expected a #rrggbb colour, got ${hex}.`);
  const value = Number.parseInt(match[1]!, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function toHex(channels: [number, number, number]): string {
  return `#${channels
    .map((channel) =>
      Math.max(0, Math.min(255, Math.round(channel)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/** sRGB mix like CSS color-mix(in srgb, a share%, b). */
export function mixHex(a: string, b: string, shareOfA: number): string {
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  return toHex([
    ar * shareOfA + br * (1 - shareOfA),
    ag * shareOfA + bg * (1 - shareOfA),
    ab * shareOfA + bb * (1 - shareOfA),
  ]);
}

/** Centre colour of the QA backdrop. */
export function qaBackdropCenter(trim: string = QA_TRIM_COLOR): string {
  return mixHex(trim, QA_BACKDROP_BASE, QA_BACKDROP_TRIM_SHARE);
}

/**
 * SVG of `radial-gradient(circle at 50% 30%, centre 0%, #09090b 100%)` for a
 * square cell. CSS sizes a circle to the farthest corner, which from (50%, 30%)
 * is sqrt(0.5^2 + 0.7^2) of the side away.
 */
export function qaBackdropSvg(size: number, trim: string = QA_TRIM_COLOR) {
  const radius = Math.sqrt(0.5 ** 2 + 0.7 ** 2) * size;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<defs><radialGradient id="g" gradientUnits="userSpaceOnUse" cx="${size * 0.5}" cy="${size * 0.3}" r="${radius}">` +
    `<stop offset="0" stop-color="${qaBackdropCenter(trim)}"/>` +
    `<stop offset="1" stop-color="${QA_BACKDROP_BASE}"/>` +
    `</radialGradient></defs>` +
    `<rect width="${size}" height="${size}" fill="url(#g)"/></svg>`
  );
}

/**
 * Grid placement: one row per jersey colour, cells left to right by size, then
 * the 3x zoomed neck/shoulder crop of the largest cell. Rows are as tall as the
 * largest cell (or the zoom, if taller) plus `gap`.
 */
export function qaSheetLayout(
  colors: readonly string[] = QA_JERSEY_COLORS,
  sizes: readonly QaSize[] = QA_SIZES,
  gap = 8,
): QaSheetLayout {
  const largest = Math.max(...sizes);
  const crop: QaRect = {
    left: Math.round(QA_ZOOM_CROP.x * largest),
    top: Math.round(QA_ZOOM_CROP.y * largest),
    width: Math.round(QA_ZOOM_CROP.width * largest),
    height: Math.round(QA_ZOOM_CROP.height * largest),
  };
  const zoomWidth = crop.width * QA_ZOOM_FACTOR;
  const zoomHeight = crop.height * QA_ZOOM_FACTOR;
  const rowHeight = Math.max(largest, zoomHeight);
  const cellsWidth = sizes.reduce((sum, size) => sum + size + gap, 0);

  const rows = colors.map((color, rowIndex): QaRowLayout => {
    const top = rowIndex * (rowHeight + gap);
    let left = 0;
    const cells = sizes.map((size) => {
      const cell = { size, left, top, width: size, height: size };
      left += size + gap;
      return cell;
    });
    return {
      color,
      cells,
      crop,
      zoom: { left: cellsWidth, top, width: zoomWidth, height: zoomHeight },
    };
  });
  return {
    width: cellsWidth + zoomWidth,
    height: colors.length * (rowHeight + gap) - gap,
    rows,
  };
}
