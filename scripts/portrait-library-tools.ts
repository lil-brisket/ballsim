/**
 * Shared helpers for the portrait-library scripts (ingest, approve, qa,
 * validate): argument parsing, on-disk layout of a library root, staged
 * records, and sharp-backed hashing/decoding. Offline only.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import {
  PORTRAIT_LIBRARY_PUBLIC_DIR,
  type PortraitLibraryEntry,
  type PortraitLibraryManifest,
} from "@/domain/portrait-library";
import {
  DHASH_FACE_CROP,
  DHASH_HEIGHT,
  DHASH_WIDTH,
  dHashFromGray,
  type JerseyMaskMetrics,
  type RawImage,
} from "@/presentation/portrait-library-image";

export const DEFAULT_MANIFEST_PATH = join(
  "src",
  "data",
  "portrait-library.manifest.json",
);
export const DEFAULT_STAGED_DIR = join("portraits", "_work", "staged");

export function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

/** Every value of a repeatable flag (`--id a --id b`). */
export function argValues(flag: string): string[] {
  const values: string[] = [];
  process.argv.forEach((arg, index) => {
    const value = process.argv[index + 1];
    if (arg === flag && value !== undefined) values.push(value);
  });
  return values;
}

export function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function sha256Of(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

export function sha256File(path: string): string {
  return sha256Of(readFileSync(path));
}

export type LibraryFiles = {
  512: string;
  256: string;
  128: string;
  mask: string;
};

/** `{root}/{512,256,128,mask}/{id}.webp` — the layout of staged/ and of public/portraits/library/. */
export function libraryFiles(root: string, id: string): LibraryFiles {
  return {
    512: join(root, "512", `${id}.webp`),
    256: join(root, "256", `${id}.webp`),
    128: join(root, "128", `${id}.webp`),
    mask: join(root, "mask", `${id}.webp`),
  };
}

export function publicLibraryRoot(publicDir: string): string {
  return join(publicDir, PORTRAIT_LIBRARY_PUBLIC_DIR);
}

export type StagedStatus = "pending" | "rejected" | "approved";

export type StagedRecord = {
  id: string;
  traits: PortraitLibraryEntry["traits"];
  /** SHA-256 (hex) of the staged 512 px WebP. */
  sha256: string;
  /** SHA-256 (hex) of the source file the art was made from. */
  sourceSha256: string;
  /** 64-bit difference hash (hex) of the staged 512 px image. */
  dhash: string;
  qa: JerseyMaskMetrics;
  status: StagedStatus;
  problems: string[];
  stagedAt: string;
};

export function stagedJsonPath(stagedDir: string): string {
  return join(stagedDir, "staged.json");
}

export function readStaged(stagedDir: string): StagedRecord[] {
  const path = stagedJsonPath(stagedDir);
  return existsSync(path) ? readJson<StagedRecord[]>(path) : [];
}

export function readManifest(path: string): PortraitLibraryManifest {
  return readJson<PortraitLibraryManifest>(path);
}

/** Decodes any image file fully to RGBA. */
export async function decodeRaw(file: string): Promise<RawImage> {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data), width: info.width, height: info.height };
}

/** Alpha channel of an image file as one byte per pixel, plus its size. */
export async function decodeAlpha(
  file: string,
): Promise<{ data: Uint8Array; width: number; height: number }> {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .extractChannel("alpha")
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data), width: info.width, height: info.height };
}

/**
 * dHash of the face region of an image file (DHASH_FACE_CROP), composited on
 * mid-gray so transparent areas are neutral. The shared backdrop and jersey
 * are cropped out so they cannot make different faces look alike.
 */
export async function dHashOfFile(file: string): Promise<string> {
  const { width = 0, height = 0 } = await sharp(file).metadata();
  const gray = await sharp(file)
    .flatten({ background: "#808080" })
    .extract({
      left: Math.round(width * DHASH_FACE_CROP.left),
      top: Math.round(height * DHASH_FACE_CROP.top),
      width: Math.round(width * DHASH_FACE_CROP.width),
      height: Math.round(height * DHASH_FACE_CROP.height),
    })
    .resize(DHASH_WIDTH, DHASH_HEIGHT, { fit: "fill", kernel: "lanczos3" })
    .greyscale()
    .raw()
    .toBuffer();
  return dHashFromGray(new Uint8Array(gray));
}
