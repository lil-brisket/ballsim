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
