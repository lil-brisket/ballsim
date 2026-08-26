import { describe, expect, it } from "vitest";
import {
  layoutMapMarkers,
  MARKER_LEADER_THRESHOLD,
  MARKER_MAX_OFFSET,
} from "@/components/map/map-marker-layout";

describe("layoutMapMarkers", () => {
  it("keeps isolated markers on their geographic origin", () => {
    const result = layoutMapMarkers([
      { id: "a", x: 10, y: 10, status: "available" },
      { id: "b", x: 80, y: 80, status: "available" },
    ]);
    expect(result[0]).toMatchObject({ id: "a", x: 10, y: 10, offset: 0 });
    expect(result[1]).toMatchObject({ id: "b", x: 80, y: 80, offset: 0 });
  });

  it("offsets overlapping markers without exceeding the max distance", () => {
    const result = layoutMapMarkers([
      { id: "paris", x: 100, y: 100, status: "available" },
      { id: "brussels", x: 102, y: 100, status: "occupied" },
    ]);
    const paris = result.find((point) => point.id === "paris")!;
    const brussels = result.find((point) => point.id === "brussels")!;
    expect(paris.originX).toBe(100);
    expect(brussels.originX).toBe(102);
    expect(paris.offset).toBeLessThanOrEqual(MARKER_MAX_OFFSET);
    expect(brussels.offset).toBeLessThanOrEqual(MARKER_MAX_OFFSET);
    expect(Math.hypot(paris.x - brussels.x, paris.y - brussels.y)).toBeGreaterThan(
      2,
    );
  });

  it("keeps the selected marker closer to its true location", () => {
    const result = layoutMapMarkers([
      { id: "selected", x: 50, y: 50, status: "selected" },
      { id: "other", x: 51, y: 50, status: "available" },
    ]);
    const selected = result.find((point) => point.id === "selected")!;
    const other = result.find((point) => point.id === "other")!;
    expect(selected.offset).toBeLessThanOrEqual(other.offset);
    expect(selected.originX).toBe(50);
    expect(other.originX).toBe(51);
  });

  it("reports offsets large enough to draw a leader line", () => {
    expect(MARKER_LEADER_THRESHOLD).toBeLessThan(MARKER_MAX_OFFSET);
  });
});
