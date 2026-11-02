import type {
  PortraitTraitKey,
  PortraitTraits,
} from "@/domain/entities/player-portrait";

/**
 * Prompt phrases per trait index, in the same order PortraitFace draws them.
 * Each phrase must read naturally after its template slot ("skin tone {skin}",
 * "eyes {eyes}", ...). A test pins every table length to
 * PORTRAIT_TRAIT_CARDINALITY, so adding an SVG option without a phrase fails.
 * Ears and accessory are deliberately absent: the library ignores them.
 */

export const PORTRAIT_PROMPT_TRAIT_KEYS = [
  "skinTone",
  "faceShape",
  "hairStyle",
  "hairColor",
  "facialHair",
  "brows",
  "eyes",
  "nose",
  "mouth",
] as const satisfies readonly PortraitTraitKey[];

export type PortraitPromptTraitKey =
  (typeof PORTRAIT_PROMPT_TRAIT_KEYS)[number];

export const PORTRAIT_TRAIT_LABELS: Record<
  PortraitPromptTraitKey,
  readonly string[]
> = {
  skinTone: [
    "very light with a warm undertone",
    "light",
    "light-medium tan",
    "medium tan",
    "medium brown",
    "warm brown",
    "deep brown",
    "dark brown",
    "very dark brown",
    "deepest ebony",
  ],
  faceShape: [
    "a balanced oval",
    "a rounder shape with soft cheeks",
    "a long, narrow shape with a high forehead",
    "a square shape with a strong jaw",
  ],
  hairStyle: [
    "completely shaved",
    "a very short faded buzz cut",
    "short cropped",
    "short textured waves",
    "a full rounded afro",
    "a high-top fade",
    "neat cornrow braids",
    "shoulder-length locs with shorter locs framing the face",
    "short voluminous curls with a tight fade",
    "tight short curls",
    "tied up in a top knot",
    "a mohawk with faded sides",
    "side-parted and swept",
    "long, straight and worn down to the shoulders",
  ],
  hairColor: [
    "jet black",
    "soft black",
    "dark brown",
    "chestnut brown",
    "auburn red",
    "dark blond",
    "golden blond",
  ],
  facialHair: [
    "none, clean-shaven",
    "light, even stubble across the jaw and upper lip",
    "a mustache with a clean-shaven chin and jaw",
    "a soul patch below the lower lip with a clean-shaven jaw",
    "a full, thick beard connected to a mustache",
    "a trimmed chin-strap beard tracing the jawline with no mustache",
    "a goatee around the mouth and chin joined to a mustache",
  ],
  brows: [
    "thin and straight",
    "thick and straight",
    "sharp, angled down toward the nose",
    "softly arched",
  ],
  eyes: [
    "small, dark and deep-set, with heavy hooded upper lids, a visible crease, little visible sclera, a small iris and a wide gap between brow and eye",
    "almond-shaped, with gently curved lids, a slight upward tilt at the outer corner, a moderate lid crease, a medium iris and a balanced amount of sclera",
    "narrow and focused, with flat, straight upper lids, slightly downturned outer corners, a thin lid crease, a partly covered iris and a close brow-to-eye gap",
    "round and wide open, with high-arched upper lids, no hooding, a large iris, visible white sclera above and below, and a tall width-to-height ratio",
  ],
  nose: [
    "small and subtle",
    "broad",
    "narrow and straight",
    "prominent and angular",
  ],
  mouth: [
    "closed, calm and neutral",
    "a faint, confident half-smile",
    "a relaxed smirk",
    "closed, stern and intense",
  ],
};

export function portraitTraitLabel(
  key: PortraitPromptTraitKey,
  index: number,
): string {
  const label = PORTRAIT_TRAIT_LABELS[key][index];
  if (label === undefined) {
    throw new Error(`No prompt label for ${key} index ${index}.`);
  }
  return label;
}

/** The nine template fields for one trait set. Hair colour is dropped for a shaved head. */
export function portraitPromptFields(
  traits: Pick<PortraitTraits, PortraitPromptTraitKey>,
): {
  skin: string;
  faceShape: string;
  eyes: string;
  brows: string;
  nose: string;
  mouth: string;
  hair: string;
  facialHair: string;
} {
  const style = portraitTraitLabel("hairStyle", traits.hairStyle);
  return {
    skin: portraitTraitLabel("skinTone", traits.skinTone),
    faceShape: portraitTraitLabel("faceShape", traits.faceShape),
    eyes: portraitTraitLabel("eyes", traits.eyes),
    brows: portraitTraitLabel("brows", traits.brows),
    nose: portraitTraitLabel("nose", traits.nose),
    mouth: portraitTraitLabel("mouth", traits.mouth),
    hair:
      traits.hairStyle === 0
        ? style
        : `${style}, ${portraitTraitLabel("hairColor", traits.hairColor)}`,
    facialHair: portraitTraitLabel("facialHair", traits.facialHair),
  };
}
