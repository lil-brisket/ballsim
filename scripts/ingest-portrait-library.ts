/**
 * STAGES hand-generated library portraits for review. Offline: reads images
 * from disk, calls no APIs, touches no saves. It never writes to public/ or to
 * the manifest; generated art is only approved by `npm run portraits:approve`.
 *
 * Usage:
 *   npm run portraits:ingest -- [--dir portraits/_work/source] [--id p0001 ...] [--restage] [--dry-run] [--contact-sheet]
 *     [--targets FILE] [--manifest FILE] [--public-dir DIR] [--staged-dir DIR]
 *   (defaults: portraits/_work/{source,targets.json,staged}, the repo manifest and public/)
 *
 * For each {id}.png|jpg|webp whose id is in portraits/_work/targets.json (from
 * `npm run portraits:prompts`) it checks: the file decodes completely, is
 * square, 512-4096 px, has a >=95% #00FF00 border, the planned traits are in
 * range and their signature is not used by an approved or staged image. Then it
 * removes the key colour and writes 512/256/128 WebP + a 256 px jersey mask to
 * <staged-dir>/{512,256,128,mask}/{id}.webp, rejects exact (SHA-256) and near
 * (64-bit dHash, Hamming <= 6) duplicates of approved and staged images, runs
 * the jersey-mask QA, and merges a record into <staged-dir>/staged.json
 * ("pending", or "rejected" with problems). Re-staging an id needs --restage;
 * an id already in the manifest is never re-ingested (use a new id for new art).
 * --dry-run validates only and writes nothing. --contact-sheet writes
 * <staged-dir>/../contact-sheet.png with each mask tinted magenta.
 * Exit code 1 if any file had problems; the good ones are still staged.
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, extname, join } from "node:path";
import sharp, { type OverlayOptions } from "sharp";
import {
  PORTRAIT_LIBRARY_IMAGE_SIZES,
  PORTRAIT_LIBRARY_MASK_SIZE,
  PORTRAIT_LIBRARY_OPTIONAL_TRAITS,
  type PortraitLibraryEntry,
} from "@/domain/portrait-library";
import {
  PORTRAIT_TRAIT_CARDINALITY,
  PORTRAIT_TRAIT_KEYS,
  portraitTraitSignature,
} from "@/domain/entities/player-portrait";
import {
  analyzeJerseyMask,
  computeJerseyMask,
  DHASH_NEAR_DUPLICATE_DISTANCE,
  dHashDistance,
  jerseyMaskProblems,
  KEY_BORDER_MIN_FRACTION,
  keyBorderFraction,
  removeChromaKey,
  type RawImage,
} from "@/presentation/portrait-library-image";
import {
  argValue,
  argValues,
  DEFAULT_MANIFEST_PATH,
  DEFAULT_STAGED_DIR,
  decodeRaw,
  dHashOfFile,
  errorMessage,
  hasFlag,
  libraryFiles,
  publicLibraryRoot,
  readJson,
  readManifest,
  readStaged,
  sha256File,
  sha256Of,
  stagedJsonPath,
  type StagedRecord,
} from "./portrait-library-tools";

const SOURCE_NAME = /^(p\d+)\.(png|jpe?g|webp)$/i;
const MASTER_SIZE = 512;
const MAX_SOURCE_SIZE = 4096;

type Targets = {
  targets: Array<{ id: string; traits: PortraitLibraryEntry["traits"] }>;
};

function isOptionalTrait(key: string): boolean {
  return (PORTRAIT_LIBRARY_OPTIONAL_TRAITS as readonly string[]).includes(key);
}

function traitSignature(traits: PortraitLibraryEntry["traits"]): string {
  return portraitTraitSignature({ ears: 0, accessory: 0, ...traits });
}

/** Out-of-range or missing planned traits, one message each. */
function traitProblems(traits: PortraitLibraryEntry["traits"]): string[] {
  const problems: string[] = [];
  const record = traits as Record<string, number | undefined>;
  for (const key of PORTRAIT_TRAIT_KEYS) {
    const value = record[key];
    if (value === undefined) {
      if (!isOptionalTrait(key)) problems.push(`trait ${key} is missing`);
      continue;
    }
    if (
      !Number.isInteger(value) ||
      value < 0 ||
      value >= PORTRAIT_TRAIT_CARDINALITY[key]
    ) {
      problems.push(
        `trait ${key}=${value} is outside [0, ${PORTRAIT_TRAIT_CARDINALITY[key] - 1}]`,
      );
    }
  }
  return problems;
}

async function decodeSource(file: string): Promise<RawImage> {
  const raw = await decodeRaw(file); // full decode: truncated/corrupt files throw here
  if (raw.width !== raw.height) {
    throw new Error(
      `image is ${raw.width}x${raw.height}; expected a square image.`,
    );
  }
  if (raw.width < MASTER_SIZE || raw.width > MAX_SOURCE_SIZE) {
    throw new Error(
      `image is ${raw.width}px; expected ${MASTER_SIZE}-${MAX_SOURCE_SIZE}px.`,
    );
  }
  const border = keyBorderFraction(raw);
  if (border < KEY_BORDER_MIN_FRACTION) {
    throw new Error(
      `background is not the #00FF00 key (${(border * 100).toFixed(1)}% of the border is green, need ${KEY_BORDER_MIN_FRACTION * 100}%).`,
    );
  }
  return raw;
}

async function resizedRaw(image: RawImage, size: number): Promise<RawImage> {
  const { data, info } = await sharp(Buffer.from(image.data), {
    raw: { width: image.width, height: image.height, channels: 4 },
  })
    .resize(size, size, { kernel: "lanczos3" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data), width: info.width, height: info.height };
}

/** Writes the three WebP sizes and the mask into `root`; returns the mask QA input. */
async function writeVariants(id: string, keyed: RawImage, root: string) {
  const files = libraryFiles(root, id);
  for (const size of PORTRAIT_LIBRARY_IMAGE_SIZES) {
    mkdirSync(dirname(files[size]), { recursive: true });
    await sharp(Buffer.from(keyed.data), {
      raw: { width: keyed.width, height: keyed.height, channels: 4 },
    })
      .resize(size, size, { kernel: "lanczos3" })
      .webp({ quality: 90, alphaQuality: 100 })
      .toFile(files[size]);
  }

  const small = await resizedRaw(keyed, PORTRAIT_LIBRARY_MASK_SIZE);
  const mask = computeJerseyMask(small);
  const rgba = Buffer.alloc(mask.length * 4, 255);
  mask.forEach((value, index) => {
    rgba[index * 4 + 3] = value;
  });
  mkdirSync(dirname(files.mask), { recursive: true });
  await sharp(rgba, {
    raw: { width: small.width, height: small.height, channels: 4 },
  })
    .webp({ lossless: true })
    .toFile(files.mask);
  return analyzeJerseyMask(small, mask);
}

async function contactSheet(ids: string[], root: string, out: string) {
  const tile = 128;
  const columns = 8;
  const rows = Math.max(1, Math.ceil(ids.length / columns));
  const layers: OverlayOptions[] = [];
  for (const [index, id] of ids.entries()) {
    const files = libraryFiles(root, id);
    const left = (index % columns) * tile;
    const top = Math.floor(index / columns) * tile;
    layers.push({ input: files[128], left, top });
    const alpha = await sharp(files.mask)
      .resize(tile, tile)
      .ensureAlpha()
      .extractChannel("alpha")
      .toBuffer();
    const magenta = await sharp({
      create: { width: tile, height: tile, channels: 3, background: "#ff00ff" },
    })
      .joinChannel(alpha)
      .png()
      .toBuffer();
    layers.push({ input: magenta, left, top, blend: "over" });
  }
  await sharp({
    create: {
      width: columns * tile,
      height: rows * tile,
      channels: 3,
      background: "#6b7280",
    },
  })
    .composite(layers)
    .png()
    .toFile(out);
}

async function main(): Promise<void> {
  const dir = argValue("--dir") ?? join("portraits", "_work", "source");
  const only = new Set(argValues("--id"));
  const restage = hasFlag("--restage");
  const dryRun = hasFlag("--dry-run");
  const publicDir = argValue("--public-dir") ?? join(process.cwd(), "public");
  const manifestPath = argValue("--manifest") ?? DEFAULT_MANIFEST_PATH;
  const targetsPath =
    argValue("--targets") ?? join("portraits", "_work", "targets.json");
  const stagedDir = argValue("--staged-dir") ?? DEFAULT_STAGED_DIR;

  if (!existsSync(targetsPath)) {
    throw new Error(
      `${targetsPath} not found. Run \`npm run portraits:prompts\` first.`,
    );
  }
  const plan = new Map(
    readJson<Targets>(targetsPath).targets.map((target) => [target.id, target]),
  );
  const manifest = readManifest(manifestPath);
  const approved = new Map(manifest.entries.map((entry) => [entry.id, entry]));
  const approvedSignatures = new Map(
    manifest.entries.map((entry) => [traitSignature(entry.traits), entry.id]),
  );
  const approvedHashes = new Map(
    manifest.entries.map((entry) => [entry.sha256, entry.id]),
  );
  const approvedRoot = publicLibraryRoot(publicDir);
  const approvedDhashes = new Map<string, string>();
  for (const entry of manifest.entries) {
    const file = libraryFiles(approvedRoot, entry.id)[512];
    if (existsSync(file)) {
      approvedDhashes.set(entry.id, await dHashOfFile(file));
    }
  }

  const staged = new Map(readStaged(stagedDir).map((r) => [r.id, r]));
  const errors: string[] = [];
  const processed: string[] = [];
  let rejected = 0;

  for (const name of readdirSync(dir).sort()) {
    const match = SOURCE_NAME.exec(name);
    if (match === null) {
      if (extname(name) !== "")
        errors.push(`${name}: filename must look like p0001.png`);
      continue;
    }
    const id = match[1]!.toLowerCase();
    if (only.size > 0 && !only.has(id)) continue;
    const target = plan.get(id);
    if (target === undefined) {
      errors.push(`${name}: ${id} is not in ${targetsPath}`);
      continue;
    }
    if (approved.has(id)) {
      process.stdout.write(
        `skip ${id} (already approved; replacing art needs a new id)\n`,
      );
      continue;
    }
    if (staged.has(id) && !restage) {
      process.stdout.write(`skip ${id} (already staged; pass --restage)\n`);
      continue;
    }

    try {
      const sourcePath = join(dir, name);
      const raw = await decodeSource(sourcePath);

      const problems = traitProblems(target.traits);
      if (problems.length > 0) throw new Error(problems[0]);
      const signature = traitSignature(target.traits);
      const approvedClash = approvedSignatures.get(signature);
      if (approvedClash !== undefined) {
        throw new Error(
          `traits already used by approved image ${approvedClash}`,
        );
      }
      for (const other of staged.values()) {
        if (
          other.id !== id &&
          other.status !== "rejected" &&
          traitSignature(other.traits) === signature
        ) {
          throw new Error(`traits already used by staged image ${other.id}`);
        }
      }
      const sourceSha256 = sha256File(sourcePath);
      const sourceClash = approvedHashes.get(sourceSha256);
      if (sourceClash !== undefined) {
        throw new Error(`identical to approved image ${sourceClash}`);
      }
      if (dryRun) {
        process.stdout.write(`[dry-run] ${id} passes validation\n`);
        continue;
      }

      removeChromaKey(raw);
      const files = libraryFiles(stagedDir, id);
      const qa = await writeVariants(id, raw, stagedDir);
      const sha256 = sha256Of(readFileSync(files[512]));
      const dhash = await dHashOfFile(files[512]);

      const reasons = jerseyMaskProblems(qa);
      for (const other of staged.values()) {
        if (other.id === id || other.status === "rejected") continue;
        if (other.sha256 === sha256 || other.sourceSha256 === sourceSha256) {
          reasons.push(`byte-identical to staged image ${other.id}`);
        } else if (
          dHashDistance(dhash, other.dhash) <= DHASH_NEAR_DUPLICATE_DISTANCE
        ) {
          reasons.push(`near-duplicate of staged image ${other.id}`);
        }
      }
      const shaClash = approvedHashes.get(sha256);
      if (shaClash !== undefined) {
        reasons.push(`byte-identical to approved image ${shaClash}`);
      }
      for (const [approvedId, hash] of approvedDhashes) {
        if (dHashDistance(dhash, hash) <= DHASH_NEAR_DUPLICATE_DISTANCE) {
          reasons.push(`near-duplicate of approved image ${approvedId}`);
        }
      }

      const record: StagedRecord = {
        id,
        traits: target.traits,
        sha256,
        sourceSha256,
        dhash,
        qa,
        status: reasons.length === 0 ? "pending" : "rejected",
        problems: reasons,
        stagedAt: new Date().toISOString(),
      };
      staged.set(id, record);
      processed.push(id);
      if (reasons.length === 0) {
        process.stdout.write(`staged ${id} (pending review)\n`);
      } else {
        rejected += 1;
        process.stdout.write(`staged ${id} as REJECTED\n`);
        for (const reason of reasons) errors.push(`${name}: ${reason}`);
      }
    } catch (error) {
      errors.push(`${name}: ${errorMessage(error)}`);
    }
  }

  if (!dryRun && processed.length > 0) {
    mkdirSync(stagedDir, { recursive: true });
    const records = [...staged.values()].sort((a, b) =>
      a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
    );
    writeFileSync(
      stagedJsonPath(stagedDir),
      `${JSON.stringify(records, null, 2)}\n`,
    );
    if (hasFlag("--contact-sheet")) {
      const out = join(stagedDir, "..", "contact-sheet.png");
      await contactSheet(processed, stagedDir, out);
      process.stdout.write(`contact sheet -> ${out}\n`);
    }
  }
  process.stdout.write(
    `${processed.length - rejected} staged pending, ${rejected} rejected, ${errors.length} problem(s)\n`,
  );
  for (const error of errors) process.stderr.write(`${error}\n`);
  if (errors.length > 0) process.exitCode = 1;
}

void main().catch((error: unknown) => {
  process.stderr.write(`${errorMessage(error)}\n`);
  process.exitCode = 1;
});
