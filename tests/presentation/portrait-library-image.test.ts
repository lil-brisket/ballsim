import { describe, expect, it } from "vitest";
import {
  computeJerseyMask,
  removeChromaKey,
  type RawImage,
} from "@/presentation/portrait-library-image";

const SIZE = 64;
const GREEN: [number, number, number] = [0, 255, 0];
const SKIN: [number, number, number] = [198, 138, 99];
const WHITE: [number, number, number] = [236, 236, 240];
const LINE: [number, number, number] = [20, 20, 28];

/** Green screen, a skin head, then a white jersey with a dark outline at the bottom. */
function synthetic(): RawImage {
  const data = new Uint8Array(SIZE * SIZE * 4);
  const put = (x: number, y: number, [r, g, b]: [number, number, number]) => {
    const offset = (y * SIZE + x) * 4;
    data[offset] = r;
    data[offset + 1] = g;
    data[offset + 2] = b;
    data[offset + 3] = 255;
  };
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      let color = GREEN;
      if (x >= 24 && x < 40 && y >= 10 && y < 36) color = SKIN;
      if (x >= 12 && x < 52 && y >= 40) color = WHITE;
      if (x >= 12 && x < 52 && y === 40) color = LINE;
      put(x, y, color);
    }
  }
  return { data, width: SIZE, height: SIZE };
}

const at = (image: RawImage, x: number, y: number) => (y * image.width + x) * 4;

describe("removeChromaKey", () => {
  it("clears the green background and keeps the figure opaque", () => {
    const image = synthetic();
    removeChromaKey(image);
    expect(image.data[at(image, 2, 2) + 3]).toBe(0);
    expect(image.data[at(image, 30, 20) + 3]).toBe(255);
    expect(image.data[at(image, 30, 50) + 3]).toBe(255);
  });

  it("recovers edge colour and removes green spill", () => {
    const image: RawImage = {
      data: new Uint8Array([190, 250, 190, 255]),
      width: 1,
      height: 1,
    };
    removeChromaKey(image);
    const [r, g, b, a] = image.data;
    expect(a).toBeGreaterThan(0);
    expect(g).toBeLessThanOrEqual(Math.max(r!, b!));
  });
});

describe("computeJerseyMask", () => {
  it("masks the white jersey but not skin, outline or background", () => {
    const image = synthetic();
    removeChromaKey(image);
    const mask = computeJerseyMask(image);
    expect(mask[50 * SIZE + 32]).toBe(255);
    expect(mask[20 * SIZE + 30]).toBe(0);
    expect(mask[2 * SIZE + 2]).toBe(0);
    expect(mask[40 * SIZE + 5]).toBe(0);
  });

  it("feathers the edge", () => {
    const image = synthetic();
    removeChromaKey(image);
    const mask = computeJerseyMask(image);
    const edge = mask[50 * SIZE + 12]!;
    expect(edge).toBeGreaterThan(0);
    expect(edge).toBeLessThan(255);
  });

  it("returns an empty mask when there is no jersey", () => {
    const image: RawImage = {
      data: new Uint8Array(SIZE * SIZE * 4).fill(0),
      width: SIZE,
      height: SIZE,
    };
    expect(computeJerseyMask(image).every((value) => value === 0)).toBe(true);
  });

  it("ignores white regions that never reach the bottom edge", () => {
    const image = synthetic();
    for (let y = SIZE - 4; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        const offset = at(image, x, y);
        image.data[offset] = 20;
        image.data[offset + 1] = 20;
        image.data[offset + 2] = 28;
        image.data[offset + 3] = 255;
      }
    }
    removeChromaKey(image);
    expect(computeJerseyMask(image).every((value) => value === 0)).toBe(true);
  });
});
