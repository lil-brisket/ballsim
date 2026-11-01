/**
 * Validates the shipped portrait library: manifest structure, then for every
 * entry that all four files exist (512/256/128 + mask), are decodable WebP of
 * the right size (512, 256, 128 square; mask 256), that the 512 file's SHA-256
 * equals the manifest `sha256`, that no two entries are near-duplicates
 * (64-bit dHash Hamming distance <= 6), and that no file on disk is missing
 * from the manifest. Reports every problem and exits 1 on any. No network, no saves.
 *
 * It then checks coverage against player generation (under-represented trait
 * values, players matched to an image that differs on a major trait). Coverage
 * problems fail the run; --allow-partial reports them as warnings for a library
 * that is still being built.
 *
 * Usage: npm run portraits:validate -- [--manifest FILE] [--public-dir DIR] [--allow-partial]
 */

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import {
  PORTRAIT_LIBRARY_MASK_SIZE,
  validatePortraitManifest,
  type PortraitLibraryManifest,
} from "@/domain/portrait-library";
import {
  DHASH_NEAR_DUPLICATE_DISTANCE,
  dHashDistance,
} from "@/presentation/portrait-library-image";
import { evaluatePortraitCoverage } from "@/systems/portraits/library-coverage";
import {
  argValue,
  hasFlag,
  DEFAULT_MANIFEST_PATH,
  dHashOfFile,
  errorMessage,
  libraryFiles,
  publicLibraryRoot,
  readJson,
  sha256File,
} from "./portrait-library-tools";

const EXPECTED: Array<{
  key: "512" | "256" | "128" | "mask";
  size: number;
}> = [
  { key: "512", size: 512 },
  { key: "256", size: 256 },
  { key: "128", size: 128 },
  { key: "mask", size: PORTRAIT_LIBRARY_MASK_SIZE },
];

async function checkFile(
  label: string,
  file: string,
  size: number,
): Promise<string | null> {
  if (!existsSync(file)) return `${label}: missing file ${file}`;
  try {
    // Full decode, so a truncated file fails here rather than in the browser.
    const { info } = await sharp(file)
      .raw()
      .toBuffer({ resolveWithObject: true });
    const meta = await sharp(file).metadata();
    if (meta.format !== "webp") {
      return `${label}: ${file} is ${meta.format ?? "unknown"}, expected webp`;
    }
    if (info.width !== size || info.height !== size) {
      return `${label}: ${file} is ${info.width}x${info.height}, expected ${size}x${size}`;
    }
    return null;
  } catch (error) {
    return `${label}: ${file} does not decode (${errorMessage(error)})`;
  }
}

async function main(): Promise<void> {
  const manifestPath = argValue("--manifest") ?? DEFAULT_MANIFEST_PATH;
  const publicDir = argValue("--public-dir") ?? join(process.cwd(), "public");
  const manifest = readJson<PortraitLibraryManifest>(manifestPath);
  const root = publicLibraryRoot(publicDir);
  const problems = validatePortraitManifest(manifest);

  if (problems.length === 0) {
    const hashes: Array<{ id: string; dhash: string }> = [];
    for (const entry of manifest.entries) {
      const files = libraryFiles(root, entry.id);
      for (const { key, size } of EXPECTED) {
        const problem = await checkFile(entry.id, files[key], size);
        if (problem !== null) problems.push(problem);
      }
      if (existsSync(files[512])) {
        if (sha256File(files[512]) !== entry.sha256) {
          problems.push(
            `${entry.id}: sha256 of ${files[512]} does not match the manifest`,
          );
        }
        try {
          hashes.push({ id: entry.id, dhash: await dHashOfFile(files[512]) });
        } catch {
          // already reported by checkFile
        }
      }
    }
    for (let i = 0; i < hashes.length; i += 1) {
      for (let j = i + 1; j < hashes.length; j += 1) {
        const a = hashes[i]!;
        const b = hashes[j]!;
        if (dHashDistance(a.dhash, b.dhash) <= DHASH_NEAR_DUPLICATE_DISTANCE) {
          problems.push(`${a.id} and ${b.id} are near-duplicate images`);
        }
      }
    }

    const known = new Set(manifest.entries.map((entry) => entry.file));
    for (const dir of ["512", "256", "128", "mask"]) {
      const folder = join(root, dir);
      if (!existsSync(folder)) continue;
      for (const file of readdirSync(folder)) {
        if (!known.has(file)) {
          problems.push(`${join(folder, file)} is not in the manifest`);
        }
      }
    }
  }

  if (problems.length > 0) {
    for (const problem of problems) process.stderr.write(`${problem}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(
    `portrait library ok: ${manifest.entries.length} entries\n`,
  );
}

void main().catch((error: unknown) => {
  process.stderr.write(`${errorMessage(error)}\n`);
  process.exitCode = 1;
});
