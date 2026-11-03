import { describe, expect, it } from "vitest";
import type { PlayerPosition } from "@/domain/entities/player";
import {
  assignLineupSlots,
  hasLegalLineup,
  playedPositions,
} from "@/systems/lineup-assignment";
import { createPlayer, uniformPlayerAttributes } from "../factories/player";

function roster(
  specs: readonly (readonly [string, PlayerPosition, PlayerPosition?])[],
) {
  return specs.map(([id, position, secondaryPosition]) =>
    createPlayer({
      id,
      position,
      secondaryPosition,
      attributes: uniformPlayerAttributes(70),
    }),
  );
}

describe("assignLineupSlots", () => {
  it("fills each slot with the player at that position", () => {
    const players = roster([
      ["c", "C"],
      ["pg", "PG"],
      ["sf", "SF"],
      ["sg", "SG"],
      ["pf", "PF"],
    ]);
    const { slots, unfilled } = assignLineupSlots(players);
    expect(unfilled).toEqual([]);
    expect(slots).toEqual([
      { playerId: "pg", slot: "PG" },
      { playerId: "sg", slot: "SG" },
      { playerId: "sf", slot: "SF" },
      { playerId: "pf", slot: "PF" },
      { playerId: "c", slot: "C" },
    ]);
  });

  it("never uses a player off his natural positions", () => {
    const players = roster([
      ["a", "PG"],
      ["b", "PG"],
      ["c", "PG"],
      ["d", "SG"],
      ["e", "SG"],
    ]);
    const { slots, unfilled } = assignLineupSlots(players);
    expect(unfilled).toEqual(["SF", "PF", "C"]);
    expect(slots.map((slot) => slot.slot)).toEqual(["PG", "SG"]);
    expect(hasLegalLineup(players)).toBe(false);
  });

  it("uses a secondary position to cover a gap", () => {
    const big = roster([
      ["pg", "PG"],
      ["sg", "SG"],
      ["sf", "SF"],
      ["pf", "PF", "C"],
      ["pf2", "PF"],
    ]);
    const { slots, unfilled } = assignLineupSlots(big);
    expect(unfilled).toEqual([]);
    expect(slots.find((slot) => slot.slot === "C")?.playerId).toBe("pf");
    expect(slots.find((slot) => slot.slot === "PF")?.playerId).toBe("pf2");
  });

  it("rearranges earlier picks to fill more slots", () => {
    // pg2 can only play PG; pgsg takes PG first but must move to SG.
    const players = roster([
      ["pgsg", "PG", "SG"],
      ["pg2", "PG"],
      ["sf", "SF"],
      ["pf", "PF"],
      ["c", "C"],
    ]);
    const { slots, unfilled } = assignLineupSlots(players);
    expect(unfilled).toEqual([]);
    expect(slots.find((slot) => slot.slot === "SG")?.playerId).toBe("pgsg");
    expect(slots.find((slot) => slot.slot === "PG")?.playerId).toBe("pg2");
  });

  it("is deterministic regardless of input order", () => {
    const players = roster([
      ["a", "PG", "SG"],
      ["b", "SG", "PG"],
      ["c", "SF"],
      ["d", "PF", "C"],
      ["e", "C", "PF"],
    ]);
    const forward = assignLineupSlots(players);
    const reversed = assignLineupSlots([...players].reverse());
    expect(reversed).toEqual(forward);
  });
});

describe("playedPositions", () => {
  it("is everyone's primary when the primaries are all different", () => {
    const players = roster([
      ["a", "PG", "SG"],
      ["b", "SG"],
      ["c", "SF"],
      ["d", "PF", "C"],
      ["e", "C"],
    ]);
    const played = playedPositions(players);
    expect([...played.entries()]).toEqual([
      ["a", "PG"],
      ["b", "SG"],
      ["c", "SF"],
      ["d", "PF"],
      ["e", "C"],
    ]);
  });

  it("puts a second PF with a secondary at C", () => {
    const players = roster([
      ["pg", "PG"],
      ["sg", "SG"],
      ["sf", "SF"],
      ["pf", "PF"],
      ["big", "PF", "C"],
    ]);
    const played = playedPositions(players);
    expect(played.get("big")).toBe("C");
    expect(played.get("pf")).toBe("PF");
  });

  it("gives a left-over player the nearest open slot when no legal five exists", () => {
    const players = roster([
      ["a", "PG"],
      ["b", "PG"],
      ["c", "SG"],
      ["d", "SF"],
      ["e", "PF"],
    ]);
    const played = playedPositions(players);
    // PG, SG, SF, PF are covered; the second PG takes the open C slot.
    expect(played.get("b")).toBe("C");
    expect(new Set(played.values()).size).toBe(5);
  });

  it("is deterministic for the same players in the same order", () => {
    const players = roster([
      ["a", "PG", "SG"],
      ["b", "PG", "SG"],
      ["c", "SF"],
      ["d", "PF", "C"],
      ["e", "PF", "C"],
    ]);
    expect(playedPositions(players)).toEqual(playedPositions(players));
  });
});
