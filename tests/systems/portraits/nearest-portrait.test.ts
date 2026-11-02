import { describe, expect, it } from "vitest";
import type { PortraitTraits } from "@/domain/entities/player-portrait";
import type { PortraitLibraryEntry } from "@/domain/portrait-library";
import { libraryEntry } from "../../factories/portrait-library";
import {
  nearestPortraitEntry,
  PORTRAIT_MATCH_WEIGHTS,
  portraitDistance,
  rankPortraitLibrary,
} from "@/systems/portraits/nearest-portrait";

const TARGET: PortraitTraits = {
  skinTone: 5,
  faceShape: 1,
  hairStyle: 4,
  hairColor: 2,
  facialHair: 4,
  brows: 1,
  eyes: 2,
  nose: 3,
  mouth: 0,
  ears: 1,
  accessory: 2,
};

function entry(
  id: string,
  overrides: Partial<PortraitLibraryEntry["traits"]> = {},
): PortraitLibraryEntry {
  const { ears: _ears, accessory: _accessory, ...rest } = TARGET;
  void _ears;
  void _accessory;
  return libraryEntry(id, { ...rest, ...overrides });
}

describe("portraitDistance", () => {
  it("is zero for an exact match and ignores ears and accessory", () => {
    expect(portraitDistance(TARGET, entry("a"))).toBe(0);
    expect(
      portraitDistance(TARGET, entry("b", { ears: 0, accessory: 3 })),
    ).toBe(0);
  });

  it("weights the major traits above the minor ones", () => {
    const majors = [
      "skinTone",
      "hairStyle",
      "hairColor",
      "facialHair",
      "faceShape",
    ] as const;
    const minors = ["brows", "eyes", "nose", "mouth"] as const;
    const worstMinor = Math.max(
      ...minors.map((key) => PORTRAIT_MATCH_WEIGHTS[key]),
    );
    for (const key of majors) {
      expect(PORTRAIT_MATCH_WEIGHTS[key]).toBeGreaterThan(worstMinor);
    }
    const hairStyleOff = portraitDistance(TARGET, entry("a", { hairStyle: 7 }));
    const allMinorsOff = portraitDistance(
      TARGET,
      entry("b", { brows: 3, eyes: 0, nose: 0, mouth: 2 }),
    );
    expect(hairStyleOff).toBeGreaterThan(allMinorsOff);
  });

  it("costs less for a nearer shade and a similar facial-hair group", () => {
    const near = portraitDistance(TARGET, entry("a", { skinTone: 6 }));
    const far = portraitDistance(TARGET, entry("b", { skinTone: 9 }));
    expect(near).toBeLessThan(far);
    const sameGroup = portraitDistance(TARGET, entry("c", { facialHair: 5 }));
    const clean = portraitDistance(TARGET, entry("d", { facialHair: 0 }));
    expect(sameGroup).toBeLessThan(clean);
  });

  it("ignores hair colour when either head is shaved", () => {
    const shaved = { ...TARGET, hairStyle: 0, hairColor: 0 };
    expect(
      portraitDistance(shaved, entry("a", { hairStyle: 0, hairColor: 6 })),
    ).toBe(
      portraitDistance(shaved, entry("b", { hairStyle: 0, hairColor: 0 })),
    );
    expect(
      portraitDistance(TARGET, entry("c", { hairColor: 6 })),
    ).toBeGreaterThan(0);
  });
});

describe("facial-hair distinctions", () => {
  const styles = [0, 1, 2, 3, 4, 5, 6];
  const library = styles.map((facialHair) =>
    entry(`f${facialHair}`, { facialHair }),
  );

  it("maps every style to its own image when it exists", () => {
    for (const facialHair of styles) {
      expect(
        nearestPortraitEntry({ ...TARGET, facialHair }, library)?.entry.id,
      ).toBe(`f${facialHair}`);
    }
  });

  it("falls back to a similar style, never to clean-shaven or stubble", () => {
    const beardless = library.filter((e) => e.traits.facialHair !== 5);
    expect(
      nearestPortraitEntry({ ...TARGET, facialHair: 5 }, beardless)?.entry
        .traits.facialHair,
    ).toBeOneOf([4, 6]);
    const noMustache = library.filter((e) => e.traits.facialHair !== 2);
    expect(
      nearestPortraitEntry({ ...TARGET, facialHair: 2 }, noMustache)?.entry
        .traits.facialHair,
    ).toBe(3);
  });
});

describe("nearestPortraitEntry / rankPortraitLibrary", () => {
  const library = [
    entry("p3", { skinTone: 7 }),
    entry("p1", { hairStyle: 8 }),
    entry("p2"),
  ];

  it("returns null for an empty library or when everything is excluded", () => {
    expect(nearestPortraitEntry(TARGET, [])).toBeNull();
    expect(
      nearestPortraitEntry(TARGET, library, { exclude: () => true }),
    ).toBeNull();
  });

  it("picks the closest entry and honours exclusions", () => {
    expect(nearestPortraitEntry(TARGET, library)?.entry.id).toBe("p2");
    expect(
      nearestPortraitEntry(TARGET, library, { exclude: (id) => id === "p2" })
        ?.entry.id,
    ).toBe("p3");
  });

  it("is deterministic and independent of library order", () => {
    const forward = rankPortraitLibrary(TARGET, library).map((r) => r.entry.id);
    const reversed = rankPortraitLibrary(TARGET, [...library].reverse()).map(
      (r) => r.entry.id,
    );
    expect(reversed).toEqual(forward);
  });

  it("breaks ties with a stable hash that varies by key", () => {
    const tied = Array.from({ length: 40 }, (_, index) => entry(`t${index}`));
    const first = nearestPortraitEntry(TARGET, tied, { tieBreakKey: "k1" });
    const second = nearestPortraitEntry(TARGET, [...tied].reverse(), {
      tieBreakKey: "k1",
    });
    expect(first?.entry.id).toBe(second?.entry.id);
    expect(first?.entry.id).toBe(
      rankPortraitLibrary(TARGET, tied, { tieBreakKey: "k1" })[0]!.entry.id,
    );
    const winners = new Set(
      ["k1", "k2", "k3", "k4", "k5", "k6"].map(
        (key) =>
          nearestPortraitEntry(TARGET, tied, { tieBreakKey: key })!.entry.id,
      ),
    );
    expect(winners.size).toBeGreaterThan(1);
  });

  it("nearest agrees with the head of the full ranking", () => {
    const lib = Array.from({ length: 30 }, (_, index) =>
      entry(`e${index}`, {
        skinTone: index % 10,
        hairStyle: index % 14,
        eyes: index % 4,
      }),
    );
    expect(nearestPortraitEntry(TARGET, lib)?.entry.id).toBe(
      rankPortraitLibrary(TARGET, lib)[0]!.entry.id,
    );
  });
});
