import { describe, expect, it } from "vitest";
import {
  analyzeJerseyMask,
  computeJerseyMask,
  dHashDistance,
  dHashFromGray,
  jerseyMaskProblems,
  keyBorderFraction,
  removeChromaKey,
  type RawImage,
} from "@/presentation/portrait-library-image";
import {
  mixHex,
  QA_JERSEY_COLORS,
  QA_SIZES,
  qaBackdropSvg,
  qaSheetLayout,
} from "@/presentation/portrait-library-qa";

const SIZE = 64;
type Rgb = [number, number, number];
const GREEN: Rgb = [0, 255, 0];
const SKIN: Rgb = [198, 138, 99];
const WHITE: Rgb = [236, 236, 240];
const LINE: Rgb = [20, 20, 28];

function paint(
  image: RawImage,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  [r, g, b]: Rgb,
) {
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const offset = (y * image.width + x) * 4;
      image.data[offset] = r;
      image.data[offset + 1] = g;
      image.data[offset + 2] = b;
      image.data[offset + 3] = 255;
    }
  }
}

/** Keyed figure: skin head, white jersey (outlined at the top) reaching the bottom. */
function keyedFigure(): RawImage {
  const image: RawImage = {
    data: new Uint8Array(SIZE * SIZE * 4),
    width: SIZE,
    height: SIZE,
  };
  paint(image, 0, 0, SIZE, SIZE, GREEN);
  paint(image, 24, 10, 40, 36, SKIN);
  paint(image, 12, 40, 52, SIZE, WHITE);
  paint(image, 12, 40, 52, 41, LINE);
  removeChromaKey(image);
  return image;
}

function fill(
  mask: Uint8Array,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  value = 255,
) {
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) mask[y * SIZE + x] = value;
  }
}

describe("analyzeJerseyMask / jerseyMaskProblems", () => {
  it("passes a clean jersey mask", () => {
    const image = keyedFigure();
    const metrics = analyzeJerseyMask(image, computeJerseyMask(image));
    expect(metrics.componentCount).toBe(1);
    expect(metrics.topRowFraction).toBeGreaterThanOrEqual(0.5);
    expect(metrics.skinBleedFraction).toBe(0);
    expect(jerseyMaskProblems(metrics)).toEqual([]);
  });

  it("fails a mask painted over the skin head", () => {
    const image = keyedFigure();
    const mask = computeJerseyMask(image);
    fill(mask, 24, 12, 40, 34);
    const problems = jerseyMaskProblems(analyzeJerseyMask(image, mask));
    expect(problems.some((p) => p.includes("skin"))).toBe(true);
  });

  it("fails a mask that swallows the dark outline", () => {
    const image = keyedFigure();
    paint(image, 12, 41, 52, 56, LINE);
    const mask = new Uint8Array(SIZE * SIZE);
    fill(mask, 12, 41, 52, SIZE);
    const problems = jerseyMaskProblems(analyzeJerseyMask(image, mask));
    expect(problems.some((p) => p.includes("outline"))).toBe(true);
  });

  it("fails a white halo left outside the mask", () => {
    const image = keyedFigure();
    const mask = new Uint8Array(SIZE * SIZE);
    fill(mask, 18, 44, 46, SIZE);
    const problems = jerseyMaskProblems(analyzeJerseyMask(image, mask));
    expect(problems.some((p) => p.includes("halo"))).toBe(true);
  });

  it("fails stray blobs", () => {
    const image = keyedFigure();
    const mask = computeJerseyMask(image);
    fill(mask, 2, 20, 8, 26);
    fill(mask, 56, 20, 62, 26);
    const metrics = analyzeJerseyMask(image, mask);
    expect(metrics.componentCount).toBe(3);
    expect(jerseyMaskProblems(metrics).some((p) => p.includes("pieces"))).toBe(
      true,
    );
  });

  it("fails an empty mask on area", () => {
    const image = keyedFigure();
    const metrics = analyzeJerseyMask(image, new Uint8Array(SIZE * SIZE));
    expect(metrics.areaFraction).toBe(0);
    expect(jerseyMaskProblems(metrics).some((p) => p.includes("area"))).toBe(
      true,
    );
  });

  it("rejects a mask of the wrong size", () => {
    expect(() => analyzeJerseyMask(keyedFigure(), new Uint8Array(3))).toThrow();
  });
});

describe("keyBorderFraction", () => {
  it("is 1 for a green border and low for a busy one", () => {
    const green: RawImage = {
      data: new Uint8Array(100 * 100 * 4),
      width: 100,
      height: 100,
    };
    paint(green, 0, 0, 100, 100, GREEN);
    paint(green, 30, 30, 70, 70, SKIN);
    expect(keyBorderFraction(green)).toBe(1);
    paint(green, 0, 0, 100, 100, SKIN);
    expect(keyBorderFraction(green)).toBe(0);
  });
});

describe("dHash", () => {
  const ramp = (flip: boolean) =>
    Uint8Array.from({ length: 17 * 16 }, (_, i) => {
      const x = i % 17;
      return flip ? x * 10 : 255 - x * 10;
    });

  it("is 64 hex chars and stable", () => {
    const hash = dHashFromGray(ramp(false));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe("f".repeat(64));
    expect(dHashFromGray(ramp(true))).toBe("0".repeat(64));
  });

  it("measures Hamming distance", () => {
    expect(dHashDistance("ffffffffffffffff", "0000000000000000")).toBe(64);
    expect(dHashDistance("0f", "00")).toBe(4);
    expect(() => dHashDistance("0", "00")).toThrow();
  });

  it("rejects a wrongly sized buffer", () => {
    expect(() => dHashFromGray(new Uint8Array(10))).toThrow();
  });
});

describe("portrait QA layout", () => {
  it("mixes colours like color-mix", () => {
    expect(mixHex("#ffffff", "#000000", 0.5)).toBe("#808080");
    expect(mixHex("#ff0000", "#0000ff", 1)).toBe("#ff0000");
  });

  it("emits a radial backdrop at the cell size", () => {
    const svg = qaBackdropSvg(128);
    expect(svg).toContain('width="128"');
    expect(svg).toContain("radialGradient");
    expect(svg).toContain('cy="38.4"');
  });

  it("lays out one row per colour with non-overlapping cells", () => {
    const layout = qaSheetLayout();
    expect(layout.rows).toHaveLength(QA_JERSEY_COLORS.length);
    const row = layout.rows[1]!;
    expect(row.cells.map((c) => c.size)).toEqual([...QA_SIZES]);
    for (let i = 1; i < row.cells.length; i += 1) {
      const prev = row.cells[i - 1]!;
      expect(row.cells[i]!.left).toBeGreaterThanOrEqual(prev.left + prev.width);
    }
    const last = row.cells[row.cells.length - 1]!;
    expect(row.zoom.left).toBeGreaterThanOrEqual(last.left + last.width);
    expect(row.zoom.left + row.zoom.width).toBeLessThanOrEqual(layout.width);
    expect(row.zoom.width).toBe(row.crop.width * 3);
    expect(layout.rows[1]!.cells[0]!.top).toBeGreaterThan(
      layout.rows[0]!.cells[0]!.top + 511,
    );
  });
});
