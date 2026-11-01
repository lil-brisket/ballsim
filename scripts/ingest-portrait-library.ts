/**
 * Ingests hand-generated library portraits. Offline: reads images from disk,
 * calls no APIs, touches no saves.
 *
 * Usage:
 *   npm run portraits:ingest -- [--dir portraits/_work/source] [--id p0001] [--replace] [--dry-run] [--contact-sheet]
 *     [--targets FILE] [--manifest FILE] [--public-dir DIR]   (defaults are the repo paths)
 *
 * For each {id}.png|jpg|webp (square, at least 512px, on the #00FF00 key
 * background) whose id is in portraits/_work/targets.json (written by
 * `npm run portraits:prompts`): removes the key colour, writes 512/256/128 px
 * WebP plus a 256 px jersey mask under public/portraits/library/, and adds or
 * updates the manifest entry. An id already in the manifest is skipped unless
 * --replace is given (ids are persisted in saves, so a replacement changes
 * that face everywhere). --contact-sheet writes portraits/_work/contact-sheet.png
 * with each jersey mask tinted magenta so mask quality can be checked by eye.
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { basename, extname, join } from "node:path";
import sharp, { type OverlayOptions } from "sharp";
import {
  PORTRAIT_LIBRARY_IMAGE_SIZES,
  PORTRAIT_LIBRARY_MASK_SIZE,
  PORTRAIT_LIBRARY_PUBLIC_DIR,
  portraitLibraryImagePath,
  portraitLibraryMaskPath,
  validatePortraitManifest,
  type PortraitLibraryEntry,
  type PortraitLibraryManifest,
} from "@/domain/portrait-library";
import {
  computeJerseyMask,
  removeChromaKey,
  type RawImage,
} from "@/presentation/portrait-library-image";

const SOURCE_NAME = /^(p\d+)\.(png|jpe?g|webp)$/i;
const MASTER_SIZE = 512;

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

type Targets = {
  targets: Array<{ id: string; traits: PortraitLibraryEntry["traits"] }>;
};

async function toRaw(file: string): Promise<RawImage> {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.width !== info.height) {
    throw new Error(
      `${basename(file)} is ${info.width}x${info.height}; expected a square image.`,
    );
  }
  if (info.width < MASTER_SIZE) {
    throw new Error(
      `${basename(file)} is ${info.width}px; expected at least ${MASTER_SIZE}px.`,
    );
  }
  return { data: new Uint8Array(data), width: info.width, height: info.height };
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

async function writeVariants(id: string, keyed: RawImage, publicDir: string) {
  for (const size of PORTRAIT_LIBRARY_IMAGE_SIZES) {
    const target = join(publicDir, portraitLibraryImagePath(id, size));
    mkdirSync(join(target, ".."), { recursive: true });
    await sharp(Buffer.from(keyed.data), {
      raw: { width: keyed.width, height: keyed.height, channels: 4 },
    })
      .resize(size, size, { kernel: "lanczos3" })
      .webp({ quality: 90, alphaQuality: 100 })
      .toFile(target);
  }

  const small = await resizedRaw(keyed, PORTRAIT_LIBRARY_MASK_SIZE);
  const mask = computeJerseyMask(small);
  if (mask.every((value) => value === 0)) {
    throw new Error(`${id}: no white jersey found at the bottom of the image.`);
  }
  const rgba = Buffer.alloc(mask.length * 4, 255);
  mask.forEach((value, index) => {
    rgba[index * 4 + 3] = value;
  });
  const maskTarget = join(publicDir, portraitLibraryMaskPath(id));
  mkdirSync(join(maskTarget, ".."), { recursive: true });
  await sharp(rgba, {
    raw: { width: small.width, height: small.height, channels: 4 },
  })
    .webp({ lossless: true })
    .toFile(maskTarget);
}

async function contactSheet(ids: string[], publicDir: string, out: string) {
  const tile = 128;
  const columns = 8;
  const rows = Math.max(1, Math.ceil(ids.length / columns));
  const layers: OverlayOptions[] = [];
  for (const [index, id] of ids.entries()) {
    const left = (index % columns) * tile;
    const top = Math.floor(index / columns) * tile;
    layers.push({
      input: join(publicDir, portraitLibraryImagePath(id, 128)),
      left,
      top,
    });
    const alpha = await sharp(join(publicDir, portraitLibraryMaskPath(id)))
      .resize(tile, tile)
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
  const only = argValue("--id");
  const replace = hasFlag("--replace");
  const dryRun = hasFlag("--dry-run");
  const publicDir = argValue("--public-dir") ?? join(process.cwd(), "public");
  const MANIFEST_PATH =
    argValue("--manifest") ??
    join("src", "data", "portrait-library.manifest.json");
  const TARGETS_PATH =
    argValue("--targets") ?? join("portraits", "_work", "targets.json");

  if (!existsSync(TARGETS_PATH)) {
    throw new Error(
      `${TARGETS_PATH} not found. Run \`npm run portraits:prompts\` first.`,
    );
  }
  const plan = new Map(
    readJson<Targets>(TARGETS_PATH).targets.map((target) => [
      target.id,
      target,
    ]),
  );
  const manifest = readJson<PortraitLibraryManifest>(MANIFEST_PATH);
  const entries = new Map(manifest.entries.map((entry) => [entry.id, entry]));

  const errors: string[] = [];
  const ingested: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const match = SOURCE_NAME.exec(name);
    if (match === null) {
      if (extname(name) !== "")
        errors.push(`${name}: filename must look like p0001.png`);
      continue;
    }
    const id = match[1]!.toLowerCase();
    if (only !== undefined && id !== only) continue;
    const target = plan.get(id);
    if (target === undefined) {
      errors.push(`${name}: ${id} is not in ${TARGETS_PATH}`);
      continue;
    }
    if (entries.has(id) && !replace) {
      process.stdout.write(
        `skip ${id} (already in the manifest; pass --replace)\n`,
      );
      continue;
    }
    try {
      const raw = await toRaw(join(dir, name));
      removeChromaKey(raw);
      if (!dryRun) await writeVariants(id, raw, publicDir);
      entries.set(id, { id, file: `${id}.webp`, traits: target.traits });
      ingested.push(id);
      process.stdout.write(`${dryRun ? "[dry-run] " : ""}ingested ${id}\n`);
    } catch (error) {
      errors.push(
        `${name}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const next: PortraitLibraryManifest = {
    version: manifest.version,
    entries: [...entries.values()].sort((a, b) =>
      a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
    ),
  };
  const manifestErrors = validatePortraitManifest(next);
  if (manifestErrors.length > 0) {
    errors.push(...manifestErrors);
  } else if (!dryRun && ingested.length > 0) {
    writeFileSync(MANIFEST_PATH, `${JSON.stringify(next, null, 2)}\n`);
  }
  if (hasFlag("--contact-sheet") && !dryRun && ingested.length > 0) {
    const out = join(dir, "..", "contact-sheet.png");
    await contactSheet(ingested, publicDir, out);
    process.stdout.write(`contact sheet -> ${out}\n`);
  }
  process.stdout.write(
    `${ingested.length} ingested into ${PORTRAIT_LIBRARY_PUBLIC_DIR}, ${errors.length} problem(s)\n`,
  );
  for (const error of errors) process.stderr.write(`${error}\n`);
  if (errors.length > 0) process.exitCode = 1;
}

void main();
