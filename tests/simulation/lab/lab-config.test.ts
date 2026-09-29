import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  mergeLabConfig,
  parseLabArgv,
  parseLabFileConfig,
} from "@/simulation/lab/lab-config";

describe("parseLabFileConfig", () => {
  it("accepts known keys and rejects unknown ones", () => {
    const parsed = parseLabFileConfig({
      seed: 9,
      games: 20,
      scenario: "superteam",
      rotation: "off",
      keep: 5,
    });
    expect(parsed.seed).toBe(9);
    expect(parsed.games).toBe(20);
    expect(parsed.keep).toBe(5);
    expect(() => parseLabFileConfig({ games: 2, nope: true })).toThrow(
      /Unknown Lab config key/,
    );
  });
});

describe("mergeLabConfig", () => {
  it("lets explicit CLI flags override the file", () => {
    const merged = mergeLabConfig({
      file: { games: 20, seed: 1, rotation: "off" },
      cli: { games: 5 },
    });
    expect(merged.games).toBe(5);
    expect(merged.seed).toBe(1);
    expect(merged.rotation).toBe("off");
    expect(merged.scenario).toBe("normal");
  });
});

describe("parseLabArgv", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("loads --config and overlays --games", () => {
    const dir = mkdtempSync(join(tmpdir(), "lab-config-"));
    dirs.push(dir);
    const path = join(dir, "lab.json");
    writeFileSync(
      path,
      `${JSON.stringify({ seed: 11, games: 20, rotation: "off" })}\n`,
      "utf8",
    );
    const parsed = parseLabArgv(["--config", path, "--games", "3"]);
    expect(parsed.seed).toBe(11);
    expect(parsed.games).toBe(3);
    expect(parsed.rotation).toBe("off");
    expect(parsed.configPath).toBe(path);
  });

  it("parses --dry-run --list-scenarios --keep", () => {
    const parsed = parseLabArgv([
      "--dry-run",
      "--list-scenarios",
      "--keep",
      "4",
    ]);
    expect(parsed.dryRun).toBe(true);
    expect(parsed.listScenarios).toBe(true);
    expect(parsed.keep).toBe(4);
  });
});
