/**
 * Pure pixel helpers for the portrait-library ingest step: chroma-key removal
 * and the team-colour jersey mask. Operate on raw RGBA buffers (no I/O, no
 * image library), so the logic is unit-testable. Offline tooling only.
 */

export type RawImage = {
  /** RGBA, 4 bytes per pixel, row-major. */
  data: Uint8Array;
  width: number;
  height: number;
};

/** Greenness (g above the larger of r/b) below LOW is opaque, above HIGH is background. */
const KEY_LOW = 24;
const KEY_HIGH = 96;

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/**
 * Removes a #00FF00 background in place: soft alpha from greenness, the
 * background's contribution subtracted from edge pixels, and remaining green
 * spill clamped to the larger of red/blue.
 */
export function removeChromaKey(image: RawImage): void {
  const { data } = image;
  for (let offset = 0; offset < data.length; offset += 4) {
    const r = data[offset]!;
    const g = data[offset + 1]!;
    const b = data[offset + 2]!;
    const greenness = g - Math.max(r, b);
    const alpha = 1 - clamp01((greenness - KEY_LOW) / (KEY_HIGH - KEY_LOW));
    if (alpha <= 0) {
      data[offset] = 0;
      data[offset + 1] = 0;
      data[offset + 2] = 0;
      data[offset + 3] = 0;
      continue;
    }
    if (alpha < 1) {
      // Edge pixel: c = a*fg + (1-a)*key, so recover the foreground colour.
      const fr = clamp01(r / 255 / alpha) * 255;
      const fg = clamp01((g / 255 - (1 - alpha)) / alpha) * 255;
      const fb = clamp01(b / 255 / alpha) * 255;
      data[offset] = Math.round(fr);
      data[offset + 1] = Math.round(Math.min(fg, Math.max(fr, fb)));
      data[offset + 2] = Math.round(fb);
    } else if (greenness > 0) {
      data[offset + 1] = Math.min(g, Math.max(r, b));
    }
    data[offset + 3] = Math.round(alpha * (data[offset + 3]! / 255) * 255);
  }
}

/** Part of the image (from the top) the jersey is searched in: the lower half. */
const JERSEY_TOP_FRACTION = 0.5;
const JERSEY_MIN_VALUE = 0.55;
const JERSEY_MAX_SATURATION = 0.14;

function isJerseyPixel(data: Uint8Array, offset: number): boolean {
  if (data[offset + 3]! < 200) return false;
  const r = data[offset]!;
  const g = data[offset + 1]!;
  const b = data[offset + 2]!;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max / 255 < JERSEY_MIN_VALUE) return false;
  return (max - min) / max <= JERSEY_MAX_SATURATION;
}

function boxBlur(mask: Uint8Array, width: number, height: number): Uint8Array {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      let count = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          sum += mask[ny * width + nx]!;
          count += 1;
        }
      }
      out[y * width + x] = Math.round(sum / count);
    }
  }
  return out;
}

/**
 * 8-bit alpha mask (255 = jersey) of the white jersey: the largest low-
 * saturation bright region in the lower half that reaches the bottom edge band,
 * lightly feathered. All zero when no jersey is found.
 */
export function computeJerseyMask(image: RawImage): Uint8Array {
  const { data, width, height } = image;
  const total = width * height;
  const firstRow = Math.floor(height * JERSEY_TOP_FRACTION);
  const candidate = new Uint8Array(total);
  for (let y = firstRow; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (isJerseyPixel(data, (y * width + x) * 4)) {
        candidate[y * width + x] = 1;
      }
    }
  }

  // A drawn outline can sit on the last rows, so "reaches the bottom" is a band.
  const bottomEdgeRow = height - Math.max(2, Math.round(height * 0.03));
  const label = new Int32Array(total);
  const stack: number[] = [];
  let bestLabel = 0;
  let bestSize = 0;
  let nextLabel = 0;
  for (let start = 0; start < total; start += 1) {
    if (candidate[start] === 0 || label[start] !== 0) continue;
    nextLabel += 1;
    let size = 0;
    let touchesBottom = false;
    stack.push(start);
    label[start] = nextLabel;
    while (stack.length > 0) {
      const index = stack.pop()!;
      size += 1;
      const x = index % width;
      const y = (index - x) / width;
      if (y >= bottomEdgeRow) touchesBottom = true;
      const neighbours = [
        x > 0 ? index - 1 : -1,
        x < width - 1 ? index + 1 : -1,
        y > 0 ? index - width : -1,
        y < height - 1 ? index + width : -1,
      ];
      for (const next of neighbours) {
        if (next >= 0 && candidate[next] === 1 && label[next] === 0) {
          label[next] = nextLabel;
          stack.push(next);
        }
      }
    }
    if (touchesBottom && size > bestSize) {
      bestSize = size;
      bestLabel = nextLabel;
    }
  }

  const mask = new Uint8Array(total);
  if (bestLabel === 0) return mask;
  for (let index = 0; index < total; index += 1) {
    if (label[index] === bestLabel) mask[index] = 255;
  }
  return boxBlur(mask, width, height);
}

/** Share of the outer frame that must be key green for an image to be accepted. */
export const KEY_BORDER_MIN_FRACTION = 0.95;
/** Outer frame thickness as a fraction of the image width. */
export const KEY_BORDER_FRAME_FRACTION = 0.02;

/** The frame ignores the bottom of the image, where a bust's shoulders reach the edge. */
export const KEY_BORDER_BOTTOM_EXCLUDED_FRACTION = 0.15;

/**
 * Fraction of the outer 2% frame (top, left and right edges above the bottom
 * 15%; measured on the RAW, un-keyed image) that is the #00FF00 key colour. A
 * generated portrait that did not keep the flat green background fails this
 * before any keying is attempted.
 */
export function keyBorderFraction(image: RawImage): number {
  const { data, width, height } = image;
  const frame = Math.max(1, Math.round(width * KEY_BORDER_FRAME_FRACTION));
  const lastRow = Math.floor(
    height * (1 - KEY_BORDER_BOTTOM_EXCLUDED_FRACTION),
  );
  let total = 0;
  let keyed = 0;
  for (let y = 0; y < lastRow; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const inFrame = x < frame || y < frame || x >= width - frame;
      if (!inFrame) continue;
      const offset = (y * width + x) * 4;
      const r = data[offset]!;
      const g = data[offset + 1]!;
      const b = data[offset + 2]!;
      total += 1;
      if (g >= 150 && g - Math.max(r, b) >= 100) keyed += 1;
    }
  }
  return total === 0 ? 0 : keyed / total;
}

// --- Jersey mask QA -------------------------------------------------------

export type JerseyMaskMetrics = {
  /** Share of all pixels with mask >= 128. */
  areaFraction: number;
  /** 4-connected components of mask >= 128. */
  componentCount: number;
  /** Highest masked row / height (1 when the mask is empty). */
  topRowFraction: number;
  /** Mean masked row / height (1 when the mask is empty). */
  centroidY: number;
  /** Share of masked pixels whose source colour looks like skin. */
  skinBleedFraction: number;
  /** Share of masked pixels whose source colour is dark (outline or hair). */
  darkBleedFraction: number;
  /** Share of opaque pixels in a 2 px ring just outside the mask that are near-white. */
  fringeFraction: number;
};

export const JERSEY_MASK_MIN_AREA = 0.08;
export const JERSEY_MASK_MAX_AREA = 0.5;
export const JERSEY_MASK_MAX_COMPONENTS = 2;
export const JERSEY_MASK_MIN_TOP_ROW = 0.5;
export const JERSEY_MASK_MAX_SKIN_BLEED = 0.01;
export const JERSEY_MASK_MAX_DARK_BLEED = 0.15;
export const JERSEY_MASK_MAX_FRINGE = 0.05;

const MASK_ON = 128;
const FRINGE_RING_PX = 2;

/** HSV of an 8-bit RGB triple: hue in degrees, s and v in [0, 1]. */
function hsv(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let hue = 0;
  if (delta > 0) {
    if (max === r) hue = 60 * (((g - b) / delta + 6) % 6);
    else if (max === g) hue = 60 * ((b - r) / delta + 2);
    else hue = 60 * ((r - g) / delta + 4);
  }
  return [hue, max === 0 ? 0 : delta / max, max / 255];
}

function isSkinLike(r: number, g: number, b: number): boolean {
  const [hue, s, v] = hsv(r, g, b);
  return s > 0.18 && hue >= 5 && hue <= 50 && v > 0.25;
}

/**
 * Measures how well a jersey mask fits its (already keyed) source image: size,
 * fragmentation, position, and whether it swallowed skin/outline or left an
 * untinted white halo. `mask` must be one byte per pixel of `image`.
 */
export function analyzeJerseyMask(
  image: RawImage,
  mask: Uint8Array,
): JerseyMaskMetrics {
  const { data, width, height } = image;
  const total = width * height;
  if (mask.length !== total) {
    throw new Error(
      `mask has ${mask.length} pixels; the image has ${total} (${width}x${height}).`,
    );
  }
  const on = new Uint8Array(total);
  let onCount = 0;
  let topRow = height;
  let rowSum = 0;
  let skin = 0;
  let dark = 0;
  for (let index = 0; index < total; index += 1) {
    if (mask[index]! < MASK_ON) continue;
    on[index] = 1;
    onCount += 1;
    const y = Math.floor(index / width);
    if (y < topRow) topRow = y;
    rowSum += y;
    const offset = index * 4;
    const r = data[offset]!;
    const g = data[offset + 1]!;
    const b = data[offset + 2]!;
    if (isSkinLike(r, g, b)) skin += 1;
    if (Math.max(r, g, b) / 255 < 0.3) dark += 1;
  }

  const seen = new Uint8Array(total);
  const stack: number[] = [];
  let components = 0;
  for (let start = 0; start < total; start += 1) {
    if (on[start] === 0 || seen[start] === 1) continue;
    components += 1;
    seen[start] = 1;
    stack.push(start);
    while (stack.length > 0) {
      const index = stack.pop()!;
      const x = index % width;
      const neighbours = [
        x > 0 ? index - 1 : -1,
        x < width - 1 ? index + 1 : -1,
        index >= width ? index - width : -1,
        index + width < total ? index + width : -1,
      ];
      for (const next of neighbours) {
        if (next >= 0 && on[next] === 1 && seen[next] === 0) {
          seen[next] = 1;
          stack.push(next);
        }
      }
    }
  }

  // Ring: pixels within FRINGE_RING_PX (Chebyshev) of the mask but not in it.
  let reach = on;
  for (let pass = 0; pass < FRINGE_RING_PX; pass += 1) {
    const grown = new Uint8Array(reach);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (reach[y * width + x] === 0) continue;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && ny >= 0 && nx < width && ny < height) {
              grown[ny * width + nx] = 1;
            }
          }
        }
      }
    }
    reach = grown;
  }
  let ringOpaque = 0;
  let ringWhite = 0;
  for (let index = 0; index < total; index += 1) {
    if (reach[index] === 0 || on[index] === 1) continue;
    const offset = index * 4;
    if (data[offset + 3]! < MASK_ON) continue;
    ringOpaque += 1;
    const [, s, v] = hsv(data[offset]!, data[offset + 1]!, data[offset + 2]!);
    if (v > 0.85 && s < 0.1) ringWhite += 1;
  }

  return {
    areaFraction: total === 0 ? 0 : onCount / total,
    componentCount: components,
    topRowFraction: onCount === 0 ? 1 : topRow / height,
    centroidY: onCount === 0 ? 1 : rowSum / onCount / height,
    skinBleedFraction: onCount === 0 ? 0 : skin / onCount,
    darkBleedFraction: onCount === 0 ? 0 : dark / onCount,
    fringeFraction: ringOpaque === 0 ? 0 : ringWhite / ringOpaque,
  };
}

/** Human-readable reasons a mask is not shippable (empty = passes). */
export function jerseyMaskProblems(metrics: JerseyMaskMetrics): string[] {
  const problems: string[] = [];
  const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
  if (
    metrics.areaFraction < JERSEY_MASK_MIN_AREA ||
    metrics.areaFraction > JERSEY_MASK_MAX_AREA
  ) {
    problems.push(
      `mask area ${pct(metrics.areaFraction)} is outside ${pct(JERSEY_MASK_MIN_AREA)}-${pct(JERSEY_MASK_MAX_AREA)}`,
    );
  }
  if (metrics.componentCount > JERSEY_MASK_MAX_COMPONENTS) {
    problems.push(
      `mask has ${metrics.componentCount} separate pieces (max ${JERSEY_MASK_MAX_COMPONENTS})`,
    );
  }
  if (metrics.topRowFraction < JERSEY_MASK_MIN_TOP_ROW) {
    problems.push(
      `mask starts at ${pct(metrics.topRowFraction)} of the height (must be in the lower half)`,
    );
  }
  if (metrics.skinBleedFraction > JERSEY_MASK_MAX_SKIN_BLEED) {
    problems.push(
      `mask covers skin (${pct(metrics.skinBleedFraction)} > ${pct(JERSEY_MASK_MAX_SKIN_BLEED)})`,
    );
  }
  if (metrics.darkBleedFraction > JERSEY_MASK_MAX_DARK_BLEED) {
    problems.push(
      `mask swallows outline or hair (${pct(metrics.darkBleedFraction)} dark > ${pct(JERSEY_MASK_MAX_DARK_BLEED)})`,
    );
  }
  if (metrics.fringeFraction > JERSEY_MASK_MAX_FRINGE) {
    problems.push(
      `white halo outside the mask (${pct(metrics.fringeFraction)} > ${pct(JERSEY_MASK_MAX_FRINGE)})`,
    );
  }
  return problems;
}

export const DHASH_WIDTH = 17;
export const DHASH_HEIGHT = 16;
/**
 * Hamming distance (of 256 bits, ~8%) at or below which two images are treated
 * as near-duplicates. Measured on the face crop (DHASH_FACE_CROP): across real
 * library art, distinct faces differed by >= 11%, while hashing the whole
 * frame at 9x8 flagged a third of all pairs because the shared backdrop and
 * jersey dominated it.
 */
export const DHASH_NEAR_DUPLICATE_DISTANCE = 20;
/** Fraction of the frame hashed: the head and neck, without backdrop or jersey. */
export const DHASH_FACE_CROP = {
  left: 0.15,
  top: 0.1,
  width: 0.7,
  height: 0.62,
} as const;

/**
 * 256-bit difference hash from a 17x16 grayscale buffer (row-major, 272 bytes):
 * a bit is set where a pixel is brighter than its right neighbour. Returns 64
 * hex characters.
 */
export function dHashFromGray(gray: Uint8Array): string {
  if (gray.length !== DHASH_WIDTH * DHASH_HEIGHT) {
    throw new Error(
      `dHash needs ${DHASH_WIDTH * DHASH_HEIGHT} gray bytes; got ${gray.length}.`,
    );
  }
  let hex = "";
  for (let y = 0; y < DHASH_HEIGHT; y += 1) {
    let nibble = 0;
    for (let x = 0; x < DHASH_WIDTH - 1; x += 1) {
      const bit =
        gray[y * DHASH_WIDTH + x]! > gray[y * DHASH_WIDTH + x + 1]! ? 1 : 0;
      nibble = (nibble << 1) | bit;
      if (x % 4 === 3) {
        hex += nibble.toString(16);
        nibble = 0;
      }
    }
  }
  return hex;
}

/** Number of differing bits between two equal-length hex hashes. */
export function dHashDistance(a: string, b: string): number {
  if (a.length !== b.length) {
    throw new Error("dHash values must have the same length.");
  }
  let distance = 0;
  for (let index = 0; index < a.length; index += 1) {
    let diff = Number.parseInt(a[index]!, 16) ^ Number.parseInt(b[index]!, 16);
    while (diff > 0) {
      distance += diff & 1;
      diff >>= 1;
    }
  }
  return distance;
}
