import { describe, expect, it } from "vitest";
import { createSeededRng, normalizeSeed } from "@/domain/rng";

describe("normalizeSeed", () => {
  it("maps finite numbers with >>> 0", () => {
    expect(normalizeSeed(42)).toBe(42);
    expect(normalizeSeed(12345)).toBe(12345);
    expect(normalizeSeed(-1)).toBe(0xffffffff);
  });

  it("maps integer strings including leading zeros to the same uint32", () => {
    expect(normalizeSeed("12345")).toBe(12345);
    expect(normalizeSeed("0012345")).toBe(12345);
    expect(normalizeSeed("-1")).toBe(0xffffffff);
  });

  it("hashes non-integer strings with FNV-1a", () => {
    expect(normalizeSeed("12345.0")).not.toBe(12345);
    expect(normalizeSeed(" 12345 ")).not.toBe(12345);
    expect(normalizeSeed("abc")).toBe(normalizeSeed("abc"));
    expect(normalizeSeed("abc")).not.toBe(normalizeSeed("abd"));
  });

  it("rejects non-finite numbers", () => {
    expect(() => normalizeSeed(Number.NaN)).toThrow();
    expect(() => normalizeSeed(Number.POSITIVE_INFINITY)).toThrow();
  });
});

describe("createSeededRng", () => {
  it("produces a deterministic sequence for the same seed", () => {
    const first = createSeededRng(42);
    const second = createSeededRng(42);

    const firstValues = [first.next(), first.next(), first.nextInt(1, 10)];
    const secondValues = [second.next(), second.next(), second.nextInt(1, 10)];

    expect(firstValues).toEqual(secondValues);
  });

  it("diverges for different seeds", () => {
    const a = createSeededRng(1);
    const b = createSeededRng(2);
    expect(a.next()).not.toEqual(b.next());
  });

  it("treats numeric and canonical integer-string seeds as equivalent", () => {
    const a = createSeededRng(12345);
    const b = createSeededRng("12345");
    const c = createSeededRng("0012345");
    expect([a.next(), a.nextInt(0, 9)]).toEqual([b.next(), b.nextInt(0, 9)]);
    expect([createSeededRng(12345).next()]).toEqual([c.next()]);
  });

  it("rejects inverted integer bounds", () => {
    const rng = createSeededRng(7);
    expect(() => rng.nextInt(5, 1)).toThrow();
  });

  it("pick returns a deterministic element from the list", () => {
    const items = ["a", "b", "c"] as const;
    expect(createSeededRng(11).pick(items)).toBe(
      createSeededRng(11).pick(items),
    );
    expect(() => createSeededRng(11).pick([])).toThrow();
  });

  it("chance is deterministic and rejects invalid probabilities", () => {
    const a = createSeededRng(3);
    const b = createSeededRng(3);
    expect(a.chance(0)).toBe(false);
    expect(b.chance(0)).toBe(false);
    expect(createSeededRng(3).chance(1)).toBe(true);
    expect(() => createSeededRng(3).chance(-0.1)).toThrow();
    expect(() => createSeededRng(3).chance(1.1)).toThrow();
  });

  it("exposes initial state equal to normalizeSeed(seed)", () => {
    expect(createSeededRng(12345).getState()).toBe(normalizeSeed(12345));
    expect(createSeededRng("0012345").getState()).toBe(normalizeSeed(12345));
  });
});
