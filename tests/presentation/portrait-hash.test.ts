import { describe, expect, it } from "vitest";
import {
  hashPlayerIdForPortrait,
  portraitCompositionIndex,
  portraitPlateIndex,
  PORTRAIT_COMPOSITION_COUNT,
  PORTRAIT_PLATE_COUNT,
  splitDisplayName,
} from "@/presentation/portrait-hash";

describe("hashPlayerIdForPortrait", () => {
  it("returns the same uint32 for the same playerId", () => {
    const first = hashPlayerIdForPortrait("player_team_0");
    const second = hashPlayerIdForPortrait("player_team_0");
    expect(first).toBe(second);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThanOrEqual(0xffffffff);
  });

  it("changes when the playerId changes", () => {
    expect(hashPlayerIdForPortrait("player_team_0")).not.toBe(
      hashPlayerIdForPortrait("player_team_1"),
    );
  });

  it("does not import simulation RNG", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const { dirname, join } = await import("node:path");
    const root = join(fileURLToPath(new URL(".", import.meta.url)), "../..");
    const source = readFileSync(
      join(root, "src/presentation/portrait-hash.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/@\/domain\/rng/);
    expect(source).not.toMatch(/from ["']@\/domain/);
  });
});

describe("portrait plate and composition", () => {
  it("maps hash bits into the locked plate and composition counts", () => {
    const hash = hashPlayerIdForPortrait("prospect_draft_2028_0");
    expect(portraitPlateIndex(hash)).toBeGreaterThanOrEqual(0);
    expect(portraitPlateIndex(hash)).toBeLessThan(PORTRAIT_PLATE_COUNT);
    expect(portraitCompositionIndex(hash)).toBeGreaterThanOrEqual(0);
    expect(portraitCompositionIndex(hash)).toBeLessThan(
      PORTRAIT_COMPOSITION_COUNT,
    );
  });
});

describe("splitDisplayName", () => {
  it("splits a first and last name", () => {
    expect(splitDisplayName("Alex Rivera")).toEqual({
      firstName: "Alex",
      lastName: "Rivera",
    });
  });

  it("keeps a single token as firstName", () => {
    expect(splitDisplayName("Alex")).toEqual({
      firstName: "Alex",
      lastName: "",
    });
  });
});
