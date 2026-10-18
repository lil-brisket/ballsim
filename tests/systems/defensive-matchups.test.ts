import { describe, expect, it } from "vitest";
import type { Player, PlayerPosition } from "@/domain/entities/player";
import { asTeamId } from "@/domain/ids";
import {
  DEFENSIVE_MATCHUP_CONFIG,
  pickMatchedDefender,
} from "@/systems/defensive-matchups";
import { createPlayer } from "../factories/player";
import { createTestRng } from "../helpers/determinism";

const { switchChance, rimHelpChance } = DEFENSIVE_MATCHUP_CONFIG;

function lineup(
  team: string,
  positions: PlayerPosition[],
  blocks: number[] = positions.map(() => 50),
): Player[] {
  return positions.map((position, index) =>
    createPlayer({
      id: `${team}_${index}`,
      teamId: asTeamId(team),
      position,
      attributes: { block: blocks[index]! },
    }),
  );
}

/** Rng whose next() returns `value`; other methods are unused here. */
function fixedRoll(value: number) {
  const rng = createTestRng(1);
  return { ...rng, next: () => value };
}

describe("pickMatchedDefender", () => {
  // Lineup order differs from position order on both sides.
  const offense = lineup("off", ["C", "PG", "SF", "SG", "PF"]);
  const defense = lineup(
    "def",
    ["SG", "PF", "PG", "C", "SF"],
    [40, 60, 30, 90, 50],
  );
  const noSwitch = switchChance + rimHelpChance + 0.01;

  it("pairs players in the same position slot", () => {
    const expected: Record<string, string> = {
      off_0: "def_3", // C -> C
      off_1: "def_2", // PG -> PG
      off_2: "def_4", // SF -> SF
      off_3: "def_0", // SG -> SG
      off_4: "def_1", // PF -> PF
    };
    for (const player of offense) {
      expect(
        pickMatchedDefender(player, offense, defense, fixedRoll(noSwitch)).id,
      ).toBe(expected[player.id]);
    }
  });

  it("maps a switch roll uniformly onto the defense", () => {
    const picks = [0, 0.2, 0.4, 0.6, 0.8].map(
      (fraction) =>
        pickMatchedDefender(
          offense[1]!,
          offense,
          defense,
          fixedRoll(fraction * switchChance),
        ).id,
    );
    expect(picks).toEqual(["def_0", "def_1", "def_2", "def_3", "def_4"]);
  });

  it("sends the best shot blocker on rim help only when asked", () => {
    const helpRoll = fixedRoll(switchChance + rimHelpChance / 2);
    expect(
      pickMatchedDefender(offense[1]!, offense, defense, helpRoll, true).id,
    ).toBe("def_3");
    expect(
      pickMatchedDefender(offense[1]!, offense, defense, helpRoll, false).id,
    ).toBe("def_2");
  });

  it("guards an extra player with the last defender when lineups differ in size", () => {
    const shortDefense = defense.slice(0, 3);
    // off_0 (C) sorts last on offense; shortDefense sorts PG, SG, PF.
    expect(
      pickMatchedDefender(
        offense[0]!,
        offense,
        shortDefense,
        fixedRoll(noSwitch),
      ).id,
    ).toBe("def_1");
  });

  it("draws exactly one random value", () => {
    let draws = 0;
    const rng = createTestRng(5);
    const counting = {
      ...rng,
      next: () => {
        draws += 1;
        return rng.next();
      },
    };
    for (let i = 0; i < 50; i += 1) {
      pickMatchedDefender(
        offense[i % 5]!,
        offense,
        defense,
        counting,
        i % 2 === 0,
      );
    }
    expect(draws).toBe(50);
  });
});
