/**
 * Offline original-fictional portrait assignment.
 * Does not call image-generation APIs and does not consume simulation RNG.
 *
 * Usage:
 *   npx tsx scripts/assign-player-portraits.ts --saveId SAVE --playerId ID [--source PATH] [--dry-run]
 *
 * Destination: portraits/{saveId}/{playerId}.v1.{contentHash}.webp
 * Missing sources leave the UI fallback in place (exit 0).
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { decidePortraitOverlayAssignment } from "@/presentation/portrait-overlay-assign";
import { playerPortraitOverlayRelativePath } from "@/presentation/portrait-overlay-path";

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index < 0 || index + 1 >= process.argv.length) {
    return undefined;
  }
  return process.argv[index + 1];
}

function contentHashOf(filePath: string): string {
  const bytes = readFileSync(filePath);
  return createHash("sha256").update(bytes).digest("hex").slice(0, 12);
}

function main(): void {
  const saveId = argValue("--saveId");
  const playerId = argValue("--playerId");
  const source = argValue("--source");
  const dryRun = process.argv.includes("--dry-run");

  if (saveId == null || playerId == null) {
    throw new Error(
      "Usage: --saveId SAVE --playerId ID [--source PATH] [--dry-run]",
    );
  }

  const sourceExists = source != null && existsSync(source);
  const hash =
    sourceExists && source != null ? contentHashOf(source) : "pending";
  const relative = playerPortraitOverlayRelativePath(saveId, playerId, 1, hash);
  const destination = join(process.cwd(), relative);
  const destinationExists = existsSync(destination);
  const decision = decidePortraitOverlayAssignment({
    destinationExists,
    sourceExists,
  });

  if (decision === "skip") {
    process.stdout.write(`skip ${relative}\n`);
    return;
  }
  if (decision === "fallback") {
    process.stdout.write(`fallback ${playerId} (no source; UI SVG remains)\n`);
    return;
  }
  if (dryRun) {
    process.stdout.write(`copy ${source} -> ${relative}\n`);
    return;
  }
  mkdirSync(dirname(destination), { recursive: true });
  if (source == null) {
    throw new Error("source is required to copy.");
  }
  copyFileSync(source, destination);
  process.stdout.write(`copied ${relative}\n`);
}

main();
