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

const AGE_BANDS = [
  "early-20s look, youthful and smooth-skinned",
  "late-20s look",
  "mid-30s look, a few faint lines around the eyes",
  "early-40s look, mature with visible lines and a slightly fuller face",
] as const;

const EXPRESSION_INTENSITIES = [
  "subtle, relaxed and understated",
  "moderate, natural and clearly readable",
  "strong, pronounced and emphatic",
] as const;

/** FNV-1a over `salt:id`, so each dimension is stable per id and independent. */
function idHash(id: string, salt: string): number {
  let hash = 0x811c9dc5;
  const text = `${salt}:${id}`;
  for (let i = 0; i < text.length; i++) {
    hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193) >>> 0;
  }
  return hash;
}

/**
 * With `id`, the prompt also varies age band and expression intensity (stable
 * per id) so faces that share a template do not converge. Without it the
 * prompt keeps the fixed "ageless late-20s" wording.
 */
export function buildPortraitLibraryPrompt(
  traits: Pick<PortraitTraits, PortraitPromptTraitKey>,
  id?: string,
): string {
  const f = portraitPromptFields(traits);
  const age =
    id === undefined
      ? "Ageless late-20s look."
      : `Age: ${AGE_BANDS[idHash(id, "age") % AGE_BANDS.length]}.`;
  const intensity =
    id === undefined
      ? ""
      : ` Expression intensity: ${EXPRESSION_INTENSITIES[idHash(id, "expression") % EXPRESSION_INTENSITIES.length]}, matching the mouth and brow description.`;
  return [
    "Square 1:1 canvas (equal width and height, 1024x1024 px). Head-and-shoulders portrait of an adult male professional basketball player, clean cel-shaded anime illustration, bold clean line art, flat shading with soft highlights. Front-facing, shoulders square to the camera, perfectly centered, clear empty space above the head with the head top about 15% from the top edge, shoulders cut off at the bottom edge.",
    `Plain solid flat bright chroma-key green (${PORTRAIT_CHROMA_KEY_HEX}) background with no gradient, no floor and no cast shadow; no green anywhere on the character or jersey.`,
    `Plain white sleeveless basketball jersey with no logos, no numbers and no text. Soft even studio lighting, no dramatic shadows, no props. ${age}${intensity}`,
    "The eyes must have individually distinctive anatomy, not a standardized anime eye: follow the eye description exactly for width-to-height ratio, upper and lower eyelid curvature, lid crease and hooding, inner and outer corner angles, visible sclera, iris-to-eye proportion, and eye depth and brow-to-eye spacing. Keep natural facial anatomy and believable proportions, and avoid sharp elongated anime eyes, identical upper eyelid lines or identical iris proportions, so eye differences are immediately noticeable side by side. Keep the same cel-shaded style and consistent facial rendering.",
    `Character: skin tone ${f.skin}; face shape ${f.faceShape}; eyes ${f.eyes}; eyebrows ${f.brows}; nose ${f.nose}; mouth ${f.mouth}; hair ${f.hair}; facial hair ${f.facialHair}.`,
  ].join("\n");
}
