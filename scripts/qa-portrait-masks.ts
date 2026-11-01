/**
 * Renders a jersey-mask QA sheet per library image and prints mask metrics.
 *
 * Usage:
 *   npm run portraits:qa -- [--staged | --approved] [--id ID ...] [--out-dir DIR]
 *     [--staged-dir DIR] [--manifest FILE] [--public-dir DIR]
 *   (default --staged; sheets go to portraits/_work/qa/{id}.png)
 *
 * Each sheet has one row per jersey colour and one column per size (128/256/512),
 * composited like PlayerPortrait: radial team-colour backdrop, the size's image
 * variant, then the jersey colour multiplied through the mask; plus a 3x
 * nearest-neighbour zoom of the neck/shoulder area. Exits 1 if any image's mask
 * fails the QA thresholds (see jerseyMaskProblems).
 */

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import sharp, { type OverlayOptions } from "sharp";
import {
  analyzeJerseyMask,
  jerseyMaskProblems,
  type JerseyMaskMetrics,
  type RawImage,
} from "@/presentation/portrait-library-image";
import {
  qaBackdropSvg,
  qaSheetLayout,
  QA_ZOOM_FACTOR,
  type QaSize,
} from "@/presentation/portrait-library-qa";
import {
  argValue,
  argValues,
  DEFAULT_MANIFEST_PATH,
  DEFAULT_STAGED_DIR,
  decodeAlpha,
  decodeRaw,
  errorMessage,
  hasFlag,
  libraryFiles,
  publicLibraryRoot,
  readManifest,
  readStaged,
} from "./portrait-library-tools";

async function renderCell(
  files: ReturnType<typeof libraryFiles>,
  size: QaSize,
  color: string,
): Promise<Buffer> {
  const layers: OverlayOptions[] = [{ input: files[size] }];
  const alpha = await sharp(files.mask)
    .ensureAlpha()
    .extractChannel("alpha")
    .resize(size, size, { kernel: "lanczos3" })
    .raw()
    .toBuffer();
  const tint = await sharp({
    create: { width: size, height: size, channels: 3, background: color },
  })
    .joinChannel(alpha, { raw: { width: size, height: size, channels: 1 } })
    .png()
    .toBuffer();
  layers.push({ input: tint, blend: "multiply" });
  return sharp(Buffer.from(qaBackdropSvg(size)))
    .composite(layers)
    .png()
    .toBuffer();
}

async function renderSheet(
  files: ReturnType<typeof libraryFiles>,
  out: string,
): Promise<void> {
  const layout = qaSheetLayout();
  const layers: OverlayOptions[] = [];
  for (const row of layout.rows) {
    for (const cell of row.cells) {
      const buffer = await renderCell(files, cell.size, row.color);
      layers.push({ input: buffer, left: cell.left, top: cell.top });
      if (cell.size === 512) {
        const zoom = await sharp(buffer)
          .extract(row.crop)
          .resize(
            row.crop.width * QA_ZOOM_FACTOR,
            row.crop.height * QA_ZOOM_FACTOR,
            { kernel: "nearest" },
          )
          .png()
          .toBuffer();
        layers.push({ input: zoom, left: row.zoom.left, top: row.zoom.top });
      }
    }
  }
  await sharp({
    create: {
      width: layout.width,
      height: layout.height,
      channels: 3,
      background: "#1f2937",
    },
  })
    .composite(layers)
    .png()
    .toFile(out);
}

/** Mask metrics from the shipped 256 mask against the 256 image (alpha = keyed foreground). */
async function measure(
  files: ReturnType<typeof libraryFiles>,
): Promise<JerseyMaskMetrics> {
  const image: RawImage = await decodeRaw(files[256]);
  const mask = await decodeAlpha(files.mask);
  if (mask.width !== image.width || mask.height !== image.height) {
    throw new Error(
      `mask is ${mask.width}x${mask.height} but the 256 image is ${image.width}x${image.height}`,
    );
  }
  return analyzeJerseyMask(image, mask.data);
}

async function main(): Promise<void> {
  const approvedMode = hasFlag("--approved");
  if (approvedMode && hasFlag("--staged")) {
    throw new Error("Pass --staged or --approved, not both.");
  }
  const only = new Set(argValues("--id"));
  const outDir = argValue("--out-dir") ?? join("portraits", "_work", "qa");
  const stagedDir = argValue("--staged-dir") ?? DEFAULT_STAGED_DIR;
  const manifestPath = argValue("--manifest") ?? DEFAULT_MANIFEST_PATH;
  const publicDir = argValue("--public-dir") ?? join(process.cwd(), "public");

  const root = approvedMode ? publicLibraryRoot(publicDir) : stagedDir;
  const ids = approvedMode
    ? readManifest(manifestPath).entries.map((entry) => entry.id)
    : readStaged(stagedDir)
        .filter((record) => record.status !== "approved")
        .map((record) => record.id);
  const selected = ids.filter((id) => only.size === 0 || only.has(id));
  for (const id of only) {
    if (!ids.includes(id)) throw new Error(`${id}: not found in ${root}`);
  }

  mkdirSync(outDir, { recursive: true });
  const pct = (value: number) => (value * 100).toFixed(1).padStart(5);
  process.stdout.write(
    "id        area  parts  top    cy   skin  dark fringe  result\n",
  );
  let failed = 0;
  for (const id of selected) {
    const files = libraryFiles(root, id);
    try {
      const metrics = await measure(files);
      const problems = jerseyMaskProblems(metrics);
      await renderSheet(files, join(outDir, `${id}.png`));
      process.stdout.write(
        `${id.padEnd(8)} ${pct(metrics.areaFraction)} ${String(metrics.componentCount).padStart(5)} ${pct(metrics.topRowFraction)} ${pct(metrics.centroidY)} ${pct(metrics.skinBleedFraction)} ${pct(metrics.darkBleedFraction)} ${pct(metrics.fringeFraction)}  ${problems.length === 0 ? "ok" : "FAIL"}\n`,
      );
      for (const problem of problems) process.stdout.write(`    ${problem}\n`);
      if (problems.length > 0) failed += 1;
    } catch (error) {
      failed += 1;
      process.stdout.write(`${id}: ERROR ${errorMessage(error)}\n`);
    }
  }
  process.stdout.write(
    `${selected.length} image(s), ${failed} failing; sheets in ${outDir}\n`,
  );
  if (failed > 0) process.exitCode = 1;
}

void main().catch((error: unknown) => {
  process.stderr.write(`${errorMessage(error)}\n`);
  process.exitCode = 1;
});
