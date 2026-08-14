import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";

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

  it("rejects inverted integer bounds", () => {
    const rng = createSeededRng(7);
    expect(() => rng.nextInt(5, 1)).toThrow();
  });
});
