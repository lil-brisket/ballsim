import {
  PORTRAIT_TRAIT_CARDINALITY,
  PORTRAIT_TRAIT_KEYS,
  portraitTraitSignature,
  type PortraitTraitKey,
  type PortraitTraits,
} from "@/domain/entities/player-portrait";

/**
 * Shared, pre-generated portrait library. Entries are static assets under
 * public/portraits/library/; each lists the trait indices it was drawn for so
 * a player's PlayerPortraitAssignment can be matched to the nearest image.
 * Entry ids are immutable: saves persist them, so an id must never be reused
 * for a different image.
 */

export const PORTRAIT_LIBRARY_MANIFEST_VERSION = 1;

/** Traits a library image is not required to describe. */
export const PORTRAIT_LIBRARY_OPTIONAL_TRAITS = ["ears", "accessory"] as const;

export type PortraitLibraryOptionalTrait =
  (typeof PORTRAIT_LIBRARY_OPTIONAL_TRAITS)[number];

export type PortraitLibraryTraits = Omit<
  PortraitTraits,
  PortraitLibraryOptionalTrait
> &
  Partial<Pick<PortraitTraits, PortraitLibraryOptionalTrait>>;

export type PortraitLibraryEntry = {
  id: string;
  /** `${id}.webp`, relative to each size directory (512/, 256/, 128/, mask/). */
  file: string;
  traits: PortraitLibraryTraits;
};

export type PortraitLibraryManifest = {
  version: typeof PORTRAIT_LIBRARY_MANIFEST_VERSION;
  entries: PortraitLibraryEntry[];
};

export const PORTRAIT_LIBRARY_ID_PATTERN = /^[a-z][a-z0-9]*$/;

function isOptionalTrait(key: PortraitTraitKey): boolean {
  return (PORTRAIT_LIBRARY_OPTIONAL_TRAITS as readonly string[]).includes(key);
}

/** Pure structural validation; returns every problem found (empty = valid). */
export function validatePortraitManifest(value: unknown): string[] {
  const errors: string[] = [];
  if (value === null || typeof value !== "object") {
    return ["manifest must be an object."];
  }
  const manifest = value as Record<string, unknown>;
  if (manifest.version !== PORTRAIT_LIBRARY_MANIFEST_VERSION) {
    errors.push(`version must be ${PORTRAIT_LIBRARY_MANIFEST_VERSION}.`);
  }
  if (!Array.isArray(manifest.entries)) {
    errors.push("entries must be an array.");
    return errors;
  }

  const ids = new Set<string>();
  const signatures = new Map<string, string>();
  manifest.entries.forEach((raw: unknown, index: number) => {
    const where = `entries[${index}]`;
    if (raw === null || typeof raw !== "object") {
      errors.push(`${where} must be an object.`);
      return;
    }
    const entry = raw as Record<string, unknown>;
    const id = entry.id;
    if (typeof id !== "string" || !PORTRAIT_LIBRARY_ID_PATTERN.test(id)) {
      errors.push(`${where}.id must match ${PORTRAIT_LIBRARY_ID_PATTERN}.`);
    } else if (ids.has(id)) {
      errors.push(`${where}.id "${id}" is duplicated.`);
    } else {
      ids.add(id);
    }
    if (typeof id === "string" && entry.file !== `${id}.webp`) {
      errors.push(`${where}.file must be "${id}.webp".`);
    }

    const traits = entry.traits;
    if (traits === null || typeof traits !== "object") {
      errors.push(`${where}.traits must be an object.`);
      return;
    }
    const record = traits as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      if (!(PORTRAIT_TRAIT_KEYS as readonly string[]).includes(key)) {
        errors.push(`${where}.traits has unknown trait "${key}".`);
      }
    }
    let complete = true;
    for (const key of PORTRAIT_TRAIT_KEYS) {
      const index_ = record[key];
      if (index_ === undefined) {
        if (!isOptionalTrait(key)) {
          errors.push(`${where}.traits.${key} is required.`);
          complete = false;
        }
        continue;
      }
      if (
        !Number.isInteger(index_) ||
        (index_ as number) < 0 ||
        (index_ as number) >= PORTRAIT_TRAIT_CARDINALITY[key]
      ) {
        errors.push(
          `${where}.traits.${key} must be an integer in [0, ${PORTRAIT_TRAIT_CARDINALITY[key] - 1}].`,
        );
        complete = false;
      }
    }
    if (complete && typeof id === "string") {
      const signature = portraitTraitSignature(
        withDefaultOptionalTraits(record as PortraitLibraryTraits),
      );
      const clash = signatures.get(signature);
      if (clash !== undefined) {
        errors.push(`${where} repeats the traits of "${clash}".`);
      } else {
        signatures.set(signature, id);
      }
    }
  });
  return errors;
}

function withDefaultOptionalTraits(
  traits: PortraitLibraryTraits,
): PortraitTraits {
  return { ears: 0, accessory: 0, ...traits };
}
