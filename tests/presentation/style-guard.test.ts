import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guardrails for the visual polish design rules (see the top of
 * src/components/ui/styles.ts). Fails on patterns the polish phases removed
 * so they do not creep back in.
 */

const SRC = path.join(process.cwd(), "src");
const UI_DIR = path.join(SRC, "components", "ui") + path.sep;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(tsx?|css)$/.test(name) ? [full] : [];
  });
}

const FILES = sourceFiles(SRC).map((file) => ({
  file: path.relative(process.cwd(), file).replaceAll("\\", "/"),
  inUi: file.startsWith(UI_DIR),
  text: readFileSync(file, "utf8"),
}));

/** `file:line` for every line matching `pattern`. */
function offenders(
  pattern: RegExp,
  include: (entry: (typeof FILES)[number]) => boolean = () => true,
): string[] {
  return FILES.filter(include).flatMap(({ file, text }) =>
    text
      .split(/\r?\n/)
      .flatMap((line, i) => (pattern.test(line) ? [`${file}:${i + 1}`] : [])),
  );
}

describe("style guard", () => {
  it("imports shared primitives from components/ui, not the removed owner copies", () => {
    expect(
      offenders(
        /components\/owner\/(EmptyState|Section|PageHeader|StatusBadge|DataTable|StatCard|TeamBadge)["']/,
      ),
    ).toEqual([]);
  });

  it("uses team or warning tokens instead of raw amber classes", () => {
    expect(offenders(/outline-amber-500/)).toEqual([]);
    expect(
      offenders(
        /(^|[\s"'`:])[a-z-]*amber-\d{2,3}\b/,
        ({ file }) => file.endsWith(".tsx") || file.endsWith(".ts"),
      ).filter((hit) => !hit.startsWith("src/components/ui/styles.ts")),
    ).toEqual([]);
  });

  it("uses NumberStepper and Select instead of native number inputs and selects", () => {
    const outsideUi = (entry: (typeof FILES)[number]) => !entry.inUi;
    expect(offenders(/type=["']number["']/, outsideUi)).toEqual([]);
    expect(offenders(/<select(\s|>|$)/, outsideUi)).toEqual([]);
  });

  it("uses surface and ink tokens instead of raw zinc classes", () => {
    expect(
      offenders(
        /(^|[\s"'`:])[a-z-]+-zinc-\d{2,3}\b/,
        ({ file }) => file.endsWith(".tsx") || file.endsWith(".ts"),
      ),
    ).toEqual([]);
  });

  it("uses ArenaPanel (quiet) instead of the removed Panel component", () => {
    expect(offenders(/components\/ui\/Panel["']/)).toEqual([]);
    expect(
      offenders(/import \{[^}]*\bPanel\b[^}]*\} from "@\/components\/ui["']/),
    ).toEqual([]);
  });
});
