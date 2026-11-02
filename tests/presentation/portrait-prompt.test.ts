import { describe, expect, it } from "vitest";
import {
  PORTRAIT_TRAIT_CARDINALITY,
  type PortraitTraits,
} from "@/domain/entities/player-portrait";
import {
  buildPortraitLibraryPrompt,
  PORTRAIT_CHROMA_KEY_HEX,
} from "@/presentation/portrait-prompt";
import {
  PORTRAIT_PROMPT_TRAIT_KEYS,
  PORTRAIT_TRAIT_LABELS,
} from "@/presentation/portrait-trait-labels";

const BASE: PortraitTraits = {
  skinTone: 6,
  faceShape: 3,
  hairStyle: 4,
  hairColor: 1,
  facialHair: 5,
  brows: 2,
  eyes: 1,
  nose: 1,
  mouth: 3,
  ears: 2,
  accessory: 3,
};

describe("portrait trait labels", () => {
  it("has exactly one phrase per SVG trait option", () => {
    for (const key of PORTRAIT_PROMPT_TRAIT_KEYS) {
      expect(PORTRAIT_TRAIT_LABELS[key]).toHaveLength(
        PORTRAIT_TRAIT_CARDINALITY[key],
      );
      expect(new Set(PORTRAIT_TRAIT_LABELS[key]).size).toBe(
        PORTRAIT_TRAIT_CARDINALITY[key],
      );
    }
  });
});

describe("buildPortraitLibraryPrompt", () => {
  it("fills every template slot from the traits", () => {
    const prompt = buildPortraitLibraryPrompt(BASE);
    expect(prompt).toContain("skin tone deep brown;");
    expect(prompt).toContain("face shape a square shape with a strong jaw;");
    expect(prompt).toContain("hair a full rounded afro, soft black;");
    expect(prompt).toContain(
      "facial hair a trimmed chin-strap beard tracing the jawline with no mustache.",
    );
    expect(prompt).toContain(PORTRAIT_CHROMA_KEY_HEX);
    expect(prompt).not.toMatch(/\{[a-z_]+\}/);
  });

  it("asks for a square canvas, which the ingest step requires", () => {
    expect(buildPortraitLibraryPrompt(BASE)).toMatch(/^Square 1:1 canvas/);
  });

  it("omits hair colour for a shaved head", () => {
    const prompt = buildPortraitLibraryPrompt({ ...BASE, hairStyle: 0 });
    expect(prompt).toContain("hair completely shaved; facial hair");
  });

  it("ignores ears and accessory", () => {
    const other: PortraitTraits = { ...BASE, ears: 0, accessory: 0 };
    expect(buildPortraitLibraryPrompt(BASE)).toBe(
      buildPortraitLibraryPrompt(other),
    );
    expect(buildPortraitLibraryPrompt(BASE)).not.toMatch(
      /headband|earring|ears/,
    );
  });

  it("is deterministic and varies with the traits", () => {
    expect(buildPortraitLibraryPrompt(BASE)).toBe(
      buildPortraitLibraryPrompt({ ...BASE }),
    );
    expect(buildPortraitLibraryPrompt(BASE)).not.toBe(
      buildPortraitLibraryPrompt({ ...BASE, skinTone: 1 }),
    );
  });

  it("keeps the fixed age wording without an id", () => {
    const prompt = buildPortraitLibraryPrompt(BASE);
    expect(prompt).toContain("Ageless late-20s look.");
    expect(prompt).not.toContain("Expression intensity");
  });

  it("varies age band and expression intensity by id, stably", () => {
    const ids = Array.from({ length: 40 }, (_, i) => `p${i + 1}`);
    const prompts = ids.map((id) => buildPortraitLibraryPrompt(BASE, id));
    expect(prompts[0]).toBe(buildPortraitLibraryPrompt(BASE, ids[0]));
    expect(prompts[0]).toContain("Expression intensity:");
    expect(prompts[0]).not.toContain("Ageless");
    const ages = new Set(prompts.map((p) => /Age: ([^.]*)\./.exec(p)?.[1]));
    const intensities = new Set(
      prompts.map((p) => /Expression intensity: ([^,]*),/.exec(p)?.[1]),
    );
    expect(ages.size).toBe(4);
    expect(intensities.size).toBe(3);
  });
});
