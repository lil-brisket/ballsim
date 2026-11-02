/**
 * Approves staged library portraits: copies them into public/portraits/library/
 * and adds their manifest entries. This is the only step that ships art, and it
 * never overwrites: an existing destination file or manifest id is refused.
 *
 * Usage:
 *   npm run portraits:approve -- --id p0001 [--id p0002 ...] | --all-passing
 *     [--dry-run] [--staged-dir DIR] [--manifest FILE] [--public-dir DIR]
 *
 * Only staged records with status "pending" and no problems can be approved
 * (there is no force flag; fix or re-stage the art instead). Everything is
 * checked in memory first (destinations free, staged files present and matching
 * their recorded SHA-256, resulting manifest valid); nothing is written unless
 * every check passes. After copying, each 512 px file is re-hashed against the
 * staged hash, the manifest is written, and the staged record is marked
 * "approved". Exit code 1 on any refusal.
 */

import {
  constants,
  copyFileSync,
  existsSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import {
  PORTRAIT_LIBRARY_IMAGE_SIZES,
  validatePortraitManifest,
  type PortraitLibraryManifest,
} from "@/domain/portrait-library";
import { jerseyMaskProblems } from "@/presentation/portrait-library-image";
import {
  argValue,
  argValues,
  DEFAULT_MANIFEST_PATH,
  DEFAULT_STAGED_DIR,
  errorMessage,
  hasFlag,
  libraryFiles,
  publicLibraryRoot,
  readManifest,
  readStaged,
  sha256File,
  stagedJsonPath,
} from "./portrait-library-tools";

function main(): void {
  const ids = argValues("--id");
  const allPassing = hasFlag("--all-passing");
  const dryRun = hasFlag("--dry-run");
  const stagedDir = argValue("--staged-dir") ?? DEFAULT_STAGED_DIR;
  const manifestPath = argValue("--manifest") ?? DEFAULT_MANIFEST_PATH;
  const publicDir = argValue("--public-dir") ?? join(process.cwd(), "public");

  if ((ids.length === 0) === !allPassing) {
    throw new Error("Pass --id <id> (repeatable) or --all-passing, not both.");
  }

  const staged = readStaged(stagedDir);
  const byId = new Map(staged.map((record) => [record.id, record]));
  const manifest = readManifest(manifestPath);
  const taken = new Set(manifest.entries.map((entry) => entry.id));
  const root = publicLibraryRoot(publicDir);

  const candidates = allPassing
    ? staged
        .filter(
          (record) =>
            record.status === "pending" &&
            record.problems.length === 0 &&
            jerseyMaskProblems(record.qa).length === 0,
        )
        .map((record) => record.id)
    : ids;
  if (candidates.length === 0) {
    process.stdout.write("nothing to approve\n");
    return;
  }

  const problems: string[] = [];
  const approvedAt = new Date().toISOString();
  const entries = [...manifest.entries];
  const chosen = new Set<string>();
  for (const id of candidates) {
    if (chosen.has(id)) {
      problems.push(`${id}: listed twice`);
      continue;
    }
    chosen.add(id);
    const record = byId.get(id);
    if (record === undefined) {
      problems.push(`${id}: not in ${stagedJsonPath(stagedDir)}`);
      continue;
    }
    if (record.status !== "pending") {
      problems.push(`${id}: status is "${record.status}", not "pending"`);
      continue;
    }
    const recordProblems = [
      ...record.problems,
      ...jerseyMaskProblems(record.qa),
    ];
    if (recordProblems.length > 0) {
      problems.push(`${id}: has QA problems (${recordProblems.join("; ")})`);
      continue;
    }
    if (taken.has(id)) {
      problems.push(`${id}: already in the manifest; never overwritten`);
      continue;
    }
    const source = libraryFiles(stagedDir, id);
    const destination = libraryFiles(root, id);
    const keys = [...PORTRAIT_LIBRARY_IMAGE_SIZES, "mask"] as const;
    let ok = true;
    for (const key of keys) {
      if (existsSync(destination[key])) {
        problems.push(`${id}: ${destination[key]} already exists; refusing`);
        ok = false;
      }
      if (!existsSync(source[key])) {
        problems.push(`${id}: staged file ${source[key]} is missing`);
        ok = false;
      }
    }
    if (ok && sha256File(source[512]) !== record.sha256) {
      problems.push(
        `${id}: staged 512 file no longer matches its recorded sha256`,
      );
      ok = false;
    }
    if (!ok) continue;
    entries.push({
      id,
      file: `${id}.webp`,
      traits: record.traits,
      sha256: record.sha256,
      approvedAt,
    });
  }

  const next: PortraitLibraryManifest = {
    version: manifest.version,
    entries: entries.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
  };
  problems.push(...validatePortraitManifest(next));
  if (problems.length > 0) {
    for (const problem of problems) process.stderr.write(`${problem}\n`);
    process.stderr.write("nothing was approved\n");
    process.exitCode = 1;
    return;
  }

  if (dryRun) {
    process.stdout.write(`[dry-run] would approve ${[...chosen].join(", ")}\n`);
    return;
  }

  for (const id of chosen) {
    const source = libraryFiles(stagedDir, id);
    const destination = libraryFiles(root, id);
    for (const key of [...PORTRAIT_LIBRARY_IMAGE_SIZES, "mask"] as const) {
      mkdirSync(dirname(destination[key]), { recursive: true });
      copyFileSync(source[key], destination[key], constants.COPYFILE_EXCL);
    }
    const expected = byId.get(id)!.sha256;
    if (sha256File(destination[512]) !== expected) {
      throw new Error(
        `${id}: copied 512 file does not match the staged sha256`,
      );
    }
  }
  writeFileSync(manifestPath, `${JSON.stringify(next, null, 2)}\n`);
  for (const id of chosen) byId.get(id)!.status = "approved";
  writeFileSync(
    stagedJsonPath(stagedDir),
    `${JSON.stringify(staged, null, 2)}\n`,
  );
  process.stdout.write(`approved ${[...chosen].join(", ")}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${errorMessage(error)}\n`);
  process.exitCode = 1;
}
