/**
 * How a player looks on the court, from the same portrait traits and height
 * the rest of the game shows. Pure, with no Pixi. A player with no portrait
 * still looks the same every time, picked from their id.
 */
import {
  PORTRAIT_HAIR,
  PORTRAIT_SKIN,
  PORTRAIT_SKIN_SHADOW,
} from "@/components/basketball/portrait-palette";
import type { WatchPlayer } from "@/state/watch-game-view";
import { fxUnit } from "./fx-events";

export type HairShape =
  | "none"
  | "buzz"
  | "cap"
  | "afro"
  | "high_top"
  | "locs"
  | "long"
  | "top_knot"
  | "mohawk";

/** Shape on court for each portrait hair style, by trait index. */
const HAIR_SHAPES: readonly HairShape[] = [
  "none", // completely shaved
  "buzz", // faded buzz cut
  "cap", // short cropped
  "cap", // short waves
  "afro", // full afro
  "high_top", // high-top fade
  "cap", // cornrows
  "locs", // shoulder-length locs
  "cap", // short curls
  "cap", // tight curls
  "top_knot", // top knot
  "mohawk", // mohawk
  "cap", // side part
  "long", // long, straight
];

export function hairShape(hairStyle: number): HairShape {
  return HAIR_SHAPES[hairStyle] ?? "cap";
}

const DEFAULT_INCHES = 78;
/** Keeps an extreme listed height from breaking the figure's proportions. */
const MIN_INCHES = 66;
const MAX_INCHES = 90;

function idSeed(id: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i += 1) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function pick<T>(list: readonly T[], index: number): T {
  return list[index] ?? list[0]!;
}

export function athleteAppearance(
  player: Pick<WatchPlayer, "playerId" | "look"> | undefined,
  fallbackId: string,
) {
  const look = player?.look ?? null;
  const seed = idSeed(player?.playerId ?? fallbackId);
  const randomIndex = (length: number, salt: number) =>
    Math.floor(fxUnit(seed, salt) * length);
  const skinTone = look?.skinTone ?? randomIndex(PORTRAIT_SKIN.length, 0);
  const hairColor = look?.hairColor ?? randomIndex(PORTRAIT_HAIR.length, 1);
  return {
    skin: pick(PORTRAIT_SKIN, skinTone),
    skinShadow: pick(PORTRAIT_SKIN_SHADOW, skinTone),
    hair: pick(PORTRAIT_HAIR, hairColor),
    hairStyle: look?.hairStyle ?? randomIndex(HAIR_SHAPES.length, 2),
    heightInches: Math.min(
      MAX_INCHES,
      Math.max(MIN_INCHES, look?.heightInches ?? DEFAULT_INCHES),
    ),
  };
}
