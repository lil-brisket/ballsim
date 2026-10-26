import { describe, expect, it } from "vitest";
import {
  nextRowControlIndex,
  nextSortIndex,
} from "@/components/ui/focus/table-keys";

describe("nextRowControlIndex", () => {
  it("keeps the control index across rows", () => {
    expect(nextRowControlIndex([3, 3, 3], 0, 2, 1)).toEqual({
      row: 1,
      control: 2,
    });
    expect(nextRowControlIndex([3, 3, 3], 2, 1, -1)).toEqual({
      row: 1,
      control: 1,
    });
  });

  it("falls back to the first control when the target row has fewer", () => {
    expect(nextRowControlIndex([3, 1], 0, 2, 1)).toEqual({
      row: 1,
      control: 0,
    });
  });

  it("skips rows without controls", () => {
    expect(nextRowControlIndex([2, 0, 0, 2], 0, 1, 1)).toEqual({
      row: 3,
      control: 1,
    });
    expect(nextRowControlIndex([2, 0, 2], 2, 0, -1)).toEqual({
      row: 0,
      control: 0,
    });
  });

  it("stops at the ends", () => {
    expect(nextRowControlIndex([1, 1], 1, 0, 1)).toBeNull();
    expect(nextRowControlIndex([1, 1], 0, 0, -1)).toBeNull();
    expect(nextRowControlIndex([1, 0], 0, 0, 1)).toBeNull();
  });
});

describe("nextSortIndex", () => {
  it("steps from the sorted header and clamps without wrapping", () => {
    expect(nextSortIndex(4, 1, 1)).toBe(2);
    expect(nextSortIndex(4, 1, -1)).toBe(0);
    expect(nextSortIndex(4, 3, 1)).toBeNull();
    expect(nextSortIndex(4, 0, -1)).toBeNull();
  });

  it("starts from the first header when none is sorted", () => {
    expect(nextSortIndex(3, -1, 1)).toBe(0);
    expect(nextSortIndex(3, -1, -1)).toBe(0);
  });

  it("does nothing without sortable headers", () => {
    expect(nextSortIndex(0, -1, 1)).toBeNull();
  });
});
