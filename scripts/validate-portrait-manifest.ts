/**
 * Validates the shipped portrait library: manifest structure, then that every
 * image size and the jersey mask exist under public/, and that nothing on disk
 * is missing from the manifest. Exits 1 on any problem. No network, no saves.
 *
 * Usage: npm run portraits:validate
 */

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  findMissingPortraitLibraryFiles,
  PORTRAIT_LIBRARY_PUBLIC_DIR,
  validatePortraitManifest,
} from "@/domain/portrait-library";
import { PORTRAIT_LIBRARY_MANIFEST } from "@/systems/portraits/portrait-library";

function main(): void {
  const manifest = PORTRAIT_LIBRARY_MANIFEST;
  const publicDir = join(process.cwd(), "public");
  const problems = validatePortraitManifest(manifest);

  if (problems.length === 0) {
    for (const path of findMissingPortraitLibraryFiles(manifest, (rel) =>
      existsSync(join(publicDir, rel)),
    )) {
      problems.push(`missing file public/${path}`);
    }
    const known = new Set(manifest.entries.map((entry) => entry.file));
    const masterDir = join(publicDir, PORTRAIT_LIBRARY_PUBLIC_DIR, "512");
    if (existsSync(masterDir)) {
      for (const file of readdirSync(masterDir)) {
        if (!known.has(file)) {
          problems.push(
            `public/${PORTRAIT_LIBRARY_PUBLIC_DIR}/512/${file} is not in the manifest`,
          );
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

main();
