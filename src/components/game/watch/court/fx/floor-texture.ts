import { fxUnit } from "./fx-events";

/** Texture size; the sprite stretches it, so a resize never repaints it. */
const WIDTH = 1024;
const HEIGHT = Math.round((WIDTH * 50) / 94);
const SEED = 0x5eed;
const PLANKS = 40;
const GRAIN_STREAKS = 700;

/**
 * Finish over the painted floor: plank tone, wood grain, overhead light, sheen
 * and a vignette. Every pass is low opacity, because this sits above the court
 * lines and they must stay the strongest thing on the floor.
 */
function paintFloorFinish(ctx: CanvasRenderingContext2D) {
  const plankHeight = HEIGHT / PLANKS;
  for (let row = 0; row < PLANKS; row += 1) {
    let x = -fxUnit(SEED, row) * 180;
    let n = 0;
    while (x < WIDTH) {
      const length = 120 + fxUnit(SEED + row, n) * 180;
      const tone = fxUnit(SEED + row, n + 500);
      ctx.fillStyle =
        tone > 0.5
          ? `rgb(255 235 205 / ${(tone - 0.5) * 0.09})`
          : `rgb(60 30 5 / ${(0.5 - tone) * 0.11})`;
      ctx.fillRect(x, row * plankHeight, length, plankHeight);
      x += length;
      n += 1;
    }
  }

  for (let i = 0; i < GRAIN_STREAKS; i += 1) {
    const dark = fxUnit(SEED, i + 2000) > 0.4;
    ctx.fillStyle = dark
      ? `rgb(50 25 5 / ${0.02 + fxUnit(SEED, i + 3000) * 0.04})`
      : `rgb(255 245 225 / ${0.015 + fxUnit(SEED, i + 3000) * 0.03})`;
    ctx.fillRect(
      fxUnit(SEED, i + 4000) * WIDTH,
      fxUnit(SEED, i + 5000) * HEIGHT,
      30 + fxUnit(SEED, i + 6000) * 150,
      1,
    );
  }

  // Overhead arena lights pooling on each half.
  for (const cx of [0.27, 0.73]) {
    const light = ctx.createRadialGradient(
      cx * WIDTH,
      HEIGHT * 0.45,
      0,
      cx * WIDTH,
      HEIGHT * 0.45,
      WIDTH * 0.3,
    );
    light.addColorStop(0, "rgb(255 250 235 / 0.07)");
    light.addColorStop(1, "rgb(255 250 235 / 0)");
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  const sheen = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  sheen.addColorStop(0.3, "rgb(255 255 255 / 0)");
  sheen.addColorStop(0.46, "rgb(255 255 255 / 0.07)");
  sheen.addColorStop(0.62, "rgb(255 255 255 / 0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const vignette = ctx.createRadialGradient(
    WIDTH / 2,
    HEIGHT / 2,
    HEIGHT * 0.45,
    WIDTH / 2,
    HEIGHT / 2,
    WIDTH * 0.62,
  );
  vignette.addColorStop(0, "rgb(10 5 0 / 0)");
  vignette.addColorStop(1, "rgb(10 5 0 / 0.2)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

let cached: HTMLCanvasElement | null = null;

/** The floor finish, painted once per page load. Null without a 2D context. */
export function floorFinishCanvas(): HTMLCanvasElement | null {
  if (cached) {
    return cached;
  }
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }
  paintFloorFinish(ctx);
  cached = canvas;
  return canvas;
}
