import { describe, expect, it } from "vitest";
import {
  freeJerseyNumber,
  isJerseyNumber,
  preferredJerseyNumber,
} from "@/domain/jersey-number";

describe("jersey numbers", () => {
  it("gives every player a stable, valid preferred number", () => {
    for (let i = 0; i < 500; i += 1) {
      const id = `player_${i}`;
      const n = preferredJerseyNumber(id);
      expect(isJerseyNumber(n)).toBe(true);
      expect(preferredJerseyNumber(id)).toBe(n);
    }
  });

  it("spreads preferred numbers over many values", () => {
    const seen = new Set(
      Array.from({ length: 500 }, (_, i) => preferredJerseyNumber(`p${i}`)),
    );
    expect(seen.size).toBeGreaterThan(25);
  });

  it("validates the 0–99 integer range", () => {
    expect(isJerseyNumber(0)).toBe(true);
    expect(isJerseyNumber(99)).toBe(true);
    expect(isJerseyNumber(100)).toBe(false);
    expect(isJerseyNumber(-1)).toBe(false);
    expect(isJerseyNumber(7.5)).toBe(false);
    expect(isJerseyNumber("7")).toBe(false);
    expect(isJerseyNumber(undefined)).toBe(false);
  });

  it("keeps a free current number and moves off a taken one", () => {
    expect(freeJerseyNumber("p1", 23, new Set([1, 2]))).toBe(23);
    const moved = freeJerseyNumber("p1", 23, new Set([23]));
    expect(moved).not.toBe(23);
    expect(isJerseyNumber(moved)).toBe(true);
    // Same inputs, same answer.
    expect(freeJerseyNumber("p1", 23, new Set([23]))).toBe(moved);
  });

  it("falls back to the preferred number when there is no valid current one", () => {
    expect(freeJerseyNumber("p9", undefined, new Set())).toBe(
      preferredJerseyNumber("p9"),
    );
  });

  it("finds the last free number and keeps the current one when all are taken", () => {
    const allBut42 = new Set(
      Array.from({ length: 100 }, (_, n) => n).filter((n) => n !== 42),
    );
    expect(freeJerseyNumber("p1", 7, allBut42)).toBe(42);
    const all = new Set(Array.from({ length: 100 }, (_, n) => n));
    expect(freeJerseyNumber("p1", 7, all)).toBe(7);
  });
});
