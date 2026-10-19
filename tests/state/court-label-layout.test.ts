import { describe, expect, it } from "vitest";
import { COURT_FIXTURE_VIEW } from "@/app/dev/broadcast-ui/court-fixture";
import { asPlayerId } from "@/domain/ids";
import {
  courtMonograms,
  layoutCourtLabels,
  type Box,
} from "@/state/court-label-layout";
import { COURT_RIM } from "@/state/watch-court-frame";
import { buildFullCourtFrame, toFullCourt } from "@/state/watch-full-court";

const VIEW = COURT_FIXTURE_VIEW;

const person = (id: string, fullName: string, lastName?: string) => ({
  playerId: asPlayerId(id),
  fullName,
  lastName,
});

describe("courtMonograms", () => {
  it("gives every fixture player a unique two-letter monogram", () => {
    const monograms = courtMonograms(VIEW.players);
    expect(monograms.size).toBe(VIEW.players.length);
    const values = [...monograms.values()];
    for (const value of values) {
      expect(value).toMatch(/^[A-Z]{2}$/);
    }
    expect(new Set(values).size).toBe(values.length);
    expect(courtMonograms(VIEW.players)).toBe(monograms);
  });

  it("separates shared surnames and shared first letters", () => {
    const roster = [
      person("a", "Jamal North", "North"),
      person("b", "Eli North", "North"),
      person("c", "Cole Cross", "Cross"),
      person("d", "Chris Cross", "Cross"),
      person("e", "", ""),
      person("f", "1234"),
      person("g", "Zoë Müller"),
    ];
    const monograms = courtMonograms(roster);
    expect(monograms.get(asPlayerId("a"))).toBe("JN");
    expect(monograms.get(asPlayerId("b"))).toBe("EN");
    expect(monograms.get(asPlayerId("c"))).toBe("CC");
    expect(monograms.get(asPlayerId("d"))).toBe("CR");
    const values = [...monograms.values()];
    expect(new Set(values).size).toBe(roster.length);
    for (const value of values) {
      expect(value).toHaveLength(2);
    }
    expect(monograms.get(asPlayerId("g"))).toBe("ZM");
    expect([...courtMonograms([...roster]).entries()]).toEqual([
      ...monograms.entries(),
    ]);
  });
});

function overlaps(a: Box, b: Box): boolean {
  return (
    Math.min(a.right, b.right) > Math.max(a.left, b.left) &&
    Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top)
  );
}

describe("layoutCourtLabels", () => {
  const rims = [
    toFullCourt(COURT_RIM, "left"),
    toFullCourt(COURT_RIM, "right"),
  ];

  for (const width of [640, 800, 1150]) {
    it(`never overlaps optional names at ${width}px and always places the budget`, () => {
      const court = { width, height: (width * 50) / 94 };
      const square = (x: number, y: number, size: number) => ({
        left: x * court.width - size / 2,
        top: y * court.height - size / 2,
        right: x * court.width + size / 2,
        bottom: y * court.height + size / 2,
      });
      let optionalShown = 0;
      for (let n = 0; n <= VIEW.plays.length; n++) {
        const frame = buildFullCourtFrame(VIEW, n);
        const required = [
          frame.players.find((p) => p.role === "shooter"),
          frame.players.find((p) => p.role === "handler"),
        ]
          .filter((p) => p !== undefined)
          .map((p) => p.playerId);
        const labels = frame.players
          .map((p) => ({
            playerId: p.playerId,
            at: p.spot,
            text: p.label,
            optional: !required.includes(p.playerId),
          }))
          .sort((a, b) => Number(a.optional) - Number(b.optional));
        const placed = layoutCourtLabels({
          labels,
          tokens: frame.players.map((p) => p.spot),
          rims,
          court,
        });
        for (const id of required) {
          expect(placed.has(id)).toBe(true);
        }
        const boxes = [...placed.entries()];
        for (const [i, [, a]] of boxes.entries()) {
          for (const [, b] of boxes.slice(i + 1)) {
            expect(overlaps(a.box, b.box)).toBe(false);
          }
        }
        for (const label of labels.filter((l) => l.optional)) {
          const spot = placed.get(label.playerId);
          if (!spot) {
            continue;
          }
          optionalShown++;
          // A shown optional name is fully clean: on the floor, off every
          // other token and off the rims.
          expect(spot.box.left).toBeGreaterThanOrEqual(-8);
          expect(spot.box.right).toBeLessThanOrEqual(court.width + 8);
          for (const p of frame.players) {
            if (p.playerId !== label.playerId) {
              expect(overlaps(spot.box, square(p.spot.x, p.spot.y, 32))).toBe(
                false,
              );
            }
          }
          for (const rim of rims) {
            expect(overlaps(spot.box, square(rim.x, rim.y, 24))).toBe(false);
          }
        }
      }
      expect(optionalShown).toBeGreaterThan(0);
    });
  }

  for (const width of [343, 1150]) {
    it(`keeps labels apart and on the court at ${width}px`, () => {
      const court = { width, height: (width * 50) / 94 };
      let tokenOverlaps = 0;
      let offCourt = 0;
      for (let n = 0; n <= VIEW.plays.length; n++) {
        const frame = buildFullCourtFrame(VIEW, n);
        const ids = [
          frame.players.find((p) => p.role === "shooter"),
          frame.players.find((p) => p.role === "handler"),
          frame.players.find((p) => p.side === 1),
        ]
          .filter((p) => p !== undefined)
          .map((p) => p.playerId);
        const unique = [...new Set(ids)];
        const tokens = frame.players.map((p) => p.spot);
        const input = {
          labels: unique.map((id) => {
            const p = frame.players.find((q) => q.playerId === id)!;
            return { playerId: id, at: p.spot, text: p.label };
          }),
          tokens,
          rims,
          court,
        };
        const placed = layoutCourtLabels(input);
        expect(layoutCourtLabels(input)).toEqual(placed);
        const boxes = [...placed.entries()];
        expect(boxes).toHaveLength(unique.length);
        for (const [i, [id, a]] of boxes.entries()) {
          if (
            a.box.left < -8 ||
            a.box.top < -8 ||
            a.box.right > court.width + 8 ||
            a.box.bottom > court.height + 8
          ) {
            offCourt++;
          }
          for (const [, b] of boxes.slice(i + 1)) {
            expect(overlaps(a.box, b.box)).toBe(false);
          }
          for (const t of frame.players) {
            if (t.playerId === id) {
              continue;
            }
            const cx = t.spot.x * court.width;
            const cy = t.spot.y * court.height;
            const obstacle = {
              left: cx - 16,
              top: cy - 16,
              right: cx + 16,
              bottom: cy + 16,
            };
            if (overlaps(a.box, obstacle)) {
              tokenOverlaps++;
            }
          }
        }
      }
      // A crowded phone-width frame can have no clean side, and the
      // least-overlap fallback may then reach past the court margin; labels
      // never overlap each other either way.
      expect(offCourt).toBeLessThanOrEqual(width === 1150 ? 0 : 3);
      expect(tokenOverlaps).toBeLessThanOrEqual(width === 1150 ? 0 : 11);
    });
  }
});
