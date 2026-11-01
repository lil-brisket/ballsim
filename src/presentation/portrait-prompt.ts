/**
 * Image-generation prompts for the shared portrait library, one per library
 * entry. Presentation only: pure, no I/O, never touches simulation RNG. The
 * trait phrases live in portrait-trait-labels.ts beside the SVG trait set.
 */

import type { PortraitTraits } from "@/domain/entities/player-portrait";
import {
  portraitPromptFields,
  type PortraitPromptTraitKey,
} from "@/presentation/portrait-trait-labels";

/** Flat key colour the ingest step removes; never present in the artwork. */
export const PORTRAIT_CHROMA_KEY_HEX = "#00FF00";

export function buildPortraitLibraryPrompt(
  traits: Pick<PortraitTraits, PortraitPromptTraitKey>,
): string {
  const f = portraitPromptFields(traits);
  return [
    "Head-and-shoulders portrait of an adult male professional basketball player, clean cel-shaded anime illustration, bold clean line art, flat shading with soft highlights. Front-facing, shoulders square to the camera, perfectly centered, clear empty space above the head with the head top about 15% from the top edge, shoulders cut off at the bottom edge.",
    `Plain solid flat bright chroma-key green (${PORTRAIT_CHROMA_KEY_HEX}) background with no gradient, no floor and no cast shadow; no green anywhere on the character or jersey.`,
    "Plain white sleeveless basketball jersey with no logos, no numbers and no text. Soft even studio lighting, no dramatic shadows, no props. Ageless late-20s look.",
    `Character: skin tone ${f.skin}; face shape ${f.faceShape}; eyes ${f.eyes}; eyebrows ${f.brows}; nose ${f.nose}; mouth ${f.mouth}; hair ${f.hair}; facial hair ${f.facialHair}.`,
  ].join("\n");
}
