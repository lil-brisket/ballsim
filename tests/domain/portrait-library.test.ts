import { describe, expect, it } from "vitest";
import { isValidPortraitAssignment } from "@/domain/entities/player-portrait";
import {
  validatePortraitManifest,
  type PortraitLibraryEntry,
} from "@/domain/portrait-library";

function entry(id: string, skinTone = 0): PortraitLibraryEntry {
  return {
    id,
    file: `${id}.webp`,
    traits: {
      skinTone,
      faceShape: 0,
      hairStyle: 2,
      hairColor: 1,
      facialHair: 0,
      brows: 0,
      eyes: 0,
      nose: 0,
      mouth: 0,
    },
  };
}

const manifest = (entries: unknown[]) => ({ version: 1, entries });

describe("validatePortraitManifest", () => {
  it("accepts an empty manifest and entries without ears/accessory", () => {
    expect(validatePortraitManifest(manifest([]))).toEqual([]);
    expect(
      validatePortraitManifest(manifest([entry("p0001"), entry("p0002", 1)])),
    ).toEqual([]);
  });

  it("accepts optional ears and accessory when in range", () => {
    const e = entry("p0001");
    e.traits.ears = 2;
    e.traits.accessory = 3;
    expect(validatePortraitManifest(manifest([e]))).toEqual([]);
  });

  it("rejects bad versions and shapes", () => {
    expect(validatePortraitManifest(null)).not.toEqual([]);
    expect(validatePortraitManifest({ version: 2, entries: [] })).toEqual([
      "version must be 1.",
    ]);
    expect(validatePortraitManifest({ version: 1 })).toContain(
      "entries must be an array.",
    );
  });

  it("rejects duplicate ids, bad ids and mismatched files", () => {
    const bad = { ...entry("p0003"), file: "other.webp" };
    const errors = validatePortraitManifest(
      manifest([entry("p0001"), entry("p0001", 1), entry("Bad Id", 2), bad]),
    );
    expect(errors.some((e) => e.includes('"p0001" is duplicated'))).toBe(true);
    expect(errors.some((e) => e.includes("entries[2].id must match"))).toBe(
      true,
    );
    expect(errors.some((e) => e.includes('file must be "p0003.webp"'))).toBe(
      true,
    );
  });

  it("rejects missing, out-of-range, fractional and unknown traits", () => {
    const missing = entry("p0001");
    delete (missing.traits as Record<string, unknown>).hairStyle;
    const range = entry("p0002", 99);
    const fractional = entry("p0003");
    (fractional.traits as Record<string, unknown>).eyes = 1.5;
    const unknown = entry("p0004", 3);
    (unknown.traits as Record<string, unknown>).tattoo = 1;
    const errors = validatePortraitManifest(
      manifest([missing, range, fractional, unknown]),
    );
    expect(errors).toEqual(
      expect.arrayContaining([
        "entries[0].traits.hairStyle is required.",
        "entries[1].traits.skinTone must be an integer in [0, 9].",
        "entries[2].traits.eyes must be an integer in [0, 3].",
        'entries[3].traits has unknown trait "tattoo".',
      ]),
    );
  });

  it("rejects two entries drawn for identical traits", () => {
    const errors = validatePortraitManifest(
      manifest([entry("p0001"), entry("p0002")]),
    );
    expect(errors).toEqual(['entries[1] repeats the traits of "p0001".']);
  });
});

describe("isValidPortraitAssignment libraryId", () => {
  const base = {
    version: 1,
    salt: 0,
    traits: entry("x").traits,
  };
  const withTraits = {
    ...base,
    traits: { ...base.traits, ears: 0, accessory: 0 },
  };

  it("allows an absent or non-empty libraryId only", () => {
    expect(isValidPortraitAssignment(withTraits)).toBe(true);
    expect(
      isValidPortraitAssignment({ ...withTraits, libraryId: "p0001" }),
    ).toBe(true);
    expect(isValidPortraitAssignment({ ...withTraits, libraryId: "" })).toBe(
      false,
    );
    expect(isValidPortraitAssignment({ ...withTraits, libraryId: 4 })).toBe(
      false,
    );
  });
});
