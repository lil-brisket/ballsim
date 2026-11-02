import { describe, expect, it } from "vitest";
import {
  directionForKey,
  nearestInDirection,
  type FocusRect,
} from "@/components/ui/focus/geometry";

function rect(left: number, top: number, width = 100, height = 100): FocusRect {
  return { left, top, right: left + width, bottom: top + height };
}

// A 3-wide board with a wide tile on the second row:
//  [0] [1] [2]
//  [ 3 wide ] [4]
const BOARD: FocusRect[] = [
  rect(0, 0),
  rect(110, 0),
  rect(220, 0),
  rect(0, 110, 210),
  rect(220, 110),
];

describe("nearestInDirection", () => {
  it("moves along a row and stops at the edge", () => {
    expect(nearestInDirection(BOARD, 0, "right")).toBe(1);
    expect(nearestInDirection(BOARD, 1, "right")).toBe(2);
    expect(nearestInDirection(BOARD, 2, "right")).toBeUndefined();
    expect(nearestInDirection(BOARD, 0, "left")).toBeUndefined();
  });

  it("moves down into a wide tile from either column it spans", () => {
    expect(nearestInDirection(BOARD, 0, "down")).toBe(3);
    expect(nearestInDirection(BOARD, 1, "down")).toBe(3);
    expect(nearestInDirection(BOARD, 2, "down")).toBe(4);
  });

  it("prefers the tile straight ahead over a nearer diagonal one", () => {
    expect(nearestInDirection(BOARD, 4, "up")).toBe(2);
    expect(nearestInDirection(BOARD, 3, "right")).toBe(4);
  });

  it("maps only arrow keys to directions", () => {
    expect(directionForKey("ArrowUp")).toBe("up");
    expect(directionForKey("ArrowRight")).toBe("right");
    expect(directionForKey("Enter")).toBeUndefined();
  });
});
