import { describe, expect, it } from "vitest";
import {
  chunkIndexes,
  remainingGameIndexes,
  assertLabJobs,
} from "@/simulation/lab/chunk-indexes";

describe("chunkIndexes", () => {
  it("splits remaining work into chunks", () => {
    expect(chunkIndexes([0, 1, 2, 3, 4], 2)).toEqual([[0, 1], [2, 3], [4]]);
  });
});

describe("remainingGameIndexes", () => {
  it("skips completed indexes for a 10k-game run", () => {
    const completed = new Set<number>();
    for (let gameIndex = 0; gameIndex < 250; gameIndex += 1) {
      completed.add(gameIndex);
    }
    const remaining = remainingGameIndexes(10_000, completed);
    expect(remaining).toHaveLength(9750);
    expect(remaining[0]).toBe(250);
    expect(remaining[remaining.length - 1]).toBe(9999);
  });
});

describe("assertLabJobs", () => {
  it("refuses jobs>1 when rotation is on", () => {
    expect(() => assertLabJobs(4, "on")).toThrow(/rotation=off/);
  });
});
