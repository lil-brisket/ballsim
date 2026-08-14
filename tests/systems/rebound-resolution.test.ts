import { describe, expect, it, vi } from "vitest";
import type { Player, PlayerPosition } from "@/domain/entities/player";
import { asTeamId, type TeamId } from "@/domain/ids";
import { createSeededRng, type Rng } from "@/domain/rng";
import {
  POSITION_REBOUND_MODIFIERS,
  REBOUND_RESOLUTION_CONFIG,
} from "@/systems/rebound-resolution-config";
import {
  playerReboundBaseStrength,
  resolveRebound,
  type ResolveReboundInput,
} from "@/systems/rebound-resolution";
import { createPlayer } from "../factories/player";
import { createTestRng } from "../helpers/determinism";

const OFFENSE_TEAM = asTeamId("team_offense");
const DEFENSE_TEAM = asTeamId("team_defense");

function makePlayer(
  id: string,
  teamId: TeamId,
  overrides: {
    position?: PlayerPosition;
    rebounding?: number;
  } = {},
): Player {
  return createPlayer({
    id,
    teamId,
    position: overrides.position ?? "SF",
    attributes: {
      rebounding: overrides.rebounding ?? 70,
    },
  });
}

function baseInput(
  overrides: Partial<ResolveReboundInput> = {},
): ResolveReboundInput {
  return {
    offensivePlayers: [
      makePlayer("off_pg", OFFENSE_TEAM, { position: "PG", rebounding: 70 }),
      makePlayer("off_sg", OFFENSE_TEAM, { position: "SG", rebounding: 70 }),
      makePlayer("off_sf", OFFENSE_TEAM, { position: "SF", rebounding: 70 }),
      makePlayer("off_pf", OFFENSE_TEAM, { position: "PF", rebounding: 70 }),
      makePlayer("off_c", OFFENSE_TEAM, { position: "C", rebounding: 70 }),
    ],
    defensivePlayers: [
      makePlayer("def_pg", DEFENSE_TEAM, { position: "PG", rebounding: 70 }),
      makePlayer("def_sg", DEFENSE_TEAM, { position: "SG", rebounding: 70 }),
      makePlayer("def_sf", DEFENSE_TEAM, { position: "SF", rebounding: 70 }),
      makePlayer("def_pf", DEFENSE_TEAM, { position: "PF", rebounding: 70 }),
      makePlayer("def_c", DEFENSE_TEAM, { position: "C", rebounding: 70 }),
    ],
    offensiveTeamId: OFFENSE_TEAM,
    defensiveTeamId: DEFENSE_TEAM,
    ...overrides,
  };
}

function createStubRng(nextValues: number[]): Rng {
  let index = 0;
  const next = (): number => {
    const value = nextValues[index];
    if (value === undefined) {
      throw new Error("Stub Rng exhausted.");
    }
    index += 1;
    return value;
  };

  return {
    next,
    nextInt(): number {
      throw new Error("Stub Rng.nextInt is unused.");
    },
    pick<T>(): T {
      throw new Error("Stub Rng.pick is unused.");
    },
    chance(probability: number): boolean {
      if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
        throw new Error("Rng.chance requires a probability in [0, 1].");
      }
      return next() < probability;
    },
    getState(): number {
      return 0;
    },
  };
}

function createCountingRng(seed: number): {
  rng: Rng;
  nextCallCount: () => number;
  chanceCallCount: () => number;
} {
  const inner = createSeededRng(seed);
  let nextCalls = 0;
  let chanceCalls = 0;

  const rng: Rng = {
    next(): number {
      nextCalls += 1;
      return inner.next();
    },
    nextInt(minInclusive: number, maxInclusive: number): number {
      return inner.nextInt(minInclusive, maxInclusive);
    },
    pick<T>(items: readonly T[]): T {
      return inner.pick(items);
    },
    chance(probability: number): boolean {
      chanceCalls += 1;
      if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
        throw new Error("Rng.chance requires a probability in [0, 1].");
      }
      return rng.next() < probability;
    },
    getState(): number {
      return inner.getState();
    },
  };

  return {
    rng,
    nextCallCount: () => nextCalls,
    chanceCallCount: () => chanceCalls,
  };
}

describe("REBOUND_RESOLUTION_CONFIG", () => {
  it("uses a defensive positioning multiplier greater than 1", () => {
    expect(
      REBOUND_RESOLUTION_CONFIG.defensivePositioningMultiplier,
    ).toBeGreaterThan(1);
  });

  it("keeps variance amplitude modest relative to the rating scale", () => {
    expect(REBOUND_RESOLUTION_CONFIG.varianceAmplitude).toBeLessThan(20);
    expect(REBOUND_RESOLUTION_CONFIG.varianceAmplitude).toBeGreaterThan(0);
  });

  it("defines position modifiers with C highest and PG lowest", () => {
    expect(POSITION_REBOUND_MODIFIERS.C).toBeGreaterThan(
      POSITION_REBOUND_MODIFIERS.PF,
    );
    expect(POSITION_REBOUND_MODIFIERS.PF).toBeGreaterThan(
      POSITION_REBOUND_MODIFIERS.SF,
    );
    expect(POSITION_REBOUND_MODIFIERS.SF).toBeGreaterThan(
      POSITION_REBOUND_MODIFIERS.SG,
    );
    expect(POSITION_REBOUND_MODIFIERS.SG).toBeGreaterThan(
      POSITION_REBOUND_MODIFIERS.PG,
    );
  });
});

describe("playerReboundBaseStrength", () => {
  it("adds the position modifier to the rebound rating", () => {
    const center = makePlayer("c1", OFFENSE_TEAM, {
      position: "C",
      rebounding: 70,
    });
    const pointGuard = makePlayer("pg1", OFFENSE_TEAM, {
      position: "PG",
      rebounding: 70,
    });
    expect(playerReboundBaseStrength(center)).toBe(
      70 + POSITION_REBOUND_MODIFIERS.C,
    );
    expect(playerReboundBaseStrength(pointGuard)).toBe(
      70 + POSITION_REBOUND_MODIFIERS.PG,
    );
  });

  it("allows a high-rated guard to outrank a low-rated center", () => {
    const guard = makePlayer("pg90", OFFENSE_TEAM, {
      position: "PG",
      rebounding: 90,
    });
    const center = makePlayer("c50", OFFENSE_TEAM, {
      position: "C",
      rebounding: 50,
    });
    expect(playerReboundBaseStrength(guard)).toBeGreaterThan(
      playerReboundBaseStrength(center),
    );
  });

  it("does not consume RNG", () => {
    const player = makePlayer("p1", OFFENSE_TEAM, { rebounding: 65 });
    expect(playerReboundBaseStrength(player)).toBe(
      playerReboundBaseStrength(player),
    );
  });
});

describe("resolveRebound", () => {
  it("is deterministic for the same input and seed", () => {
    const input = baseInput();
    const resultA = resolveRebound(input, createSeededRng(12345));
    const resultB = resolveRebound(input, createSeededRng(12345));
    expect(resultA).toEqual(resultB);
  });

  it("can produce different outcomes with different seeds", () => {
    const input = baseInput();
    const results = new Set<string>();
    for (let seed = 0; seed < 200; seed += 1) {
      const result = resolveRebound(input, createSeededRng(seed));
      results.add(`${result.type}:${result.playerId}`);
    }
    expect(results.size).toBeGreaterThan(1);
  });

  it("does not mutate the input players", () => {
    const input = baseInput();
    const snapshot = structuredClone(input);
    resolveRebound(input, createTestRng());
    expect(input).toEqual(snapshot);
  });

  it("never calls Math.random or Date.now", () => {
    const randomSpy = vi.spyOn(Math, "random");
    const nowSpy = vi.spyOn(Date, "now");
    try {
      resolveRebound(baseInput(), createTestRng());
      expect(randomSpy).not.toHaveBeenCalled();
      expect(nowSpy).not.toHaveBeenCalled();
    } finally {
      randomSpy.mockRestore();
      nowSpy.mockRestore();
    }
  });

  it("consumes N_off + N_def + 1 chance + 1 next for weighted pick", () => {
    const input = baseInput();
    const { rng, nextCallCount, chanceCallCount } = createCountingRng(99);
    resolveRebound(input, rng);

    const expectedNext =
      input.offensivePlayers.length +
      input.defensivePlayers.length +
      1 + // chance wraps next
      1; // weighted pick
    expect(chanceCallCount()).toBe(1);
    expect(nextCallCount()).toBe(expectedNext);
  });

  it("returns offensiveReboundProbability in (0, 1) for neutral talent", () => {
    const result = resolveRebound(baseInput(), createTestRng());
    expect(result.offensiveReboundProbability).toBeGreaterThan(0);
    expect(result.offensiveReboundProbability).toBeLessThan(1);
  });

  it("exposes effective candidate strengths for every player", () => {
    const input = baseInput();
    const result = resolveRebound(input, createTestRng());
    expect(result.candidateScores).toHaveLength(
      input.offensivePlayers.length + input.defensivePlayers.length,
    );
    for (const score of result.candidateScores) {
      expect(score.strength).toBeGreaterThanOrEqual(
        REBOUND_RESOLUTION_CONFIG.minStrength,
      );
    }
  });

  it("only awards the rebound to an eligible player on the winning side", () => {
    const input = baseInput();
    const result = resolveRebound(input, createTestRng());
    const winningPool =
      result.type === "offensive"
        ? input.offensivePlayers
        : input.defensivePlayers;
    expect(winningPool.some((player) => player.id === result.playerId)).toBe(
      true,
    );
    expect(result.teamId).toBe(
      result.type === "offensive"
        ? input.offensiveTeamId
        : input.defensiveTeamId,
    );
  });

  it("supports 1v1 candidate pools", () => {
    const input = baseInput({
      offensivePlayers: [
        makePlayer("off_only", OFFENSE_TEAM, { rebounding: 70 }),
      ],
      defensivePlayers: [
        makePlayer("def_only", DEFENSE_TEAM, { rebounding: 70 }),
      ],
    });
    const result = resolveRebound(input, createTestRng());
    expect(["off_only", "def_only"]).toContain(result.playerId);
  });

  it("can resolve an offensive rebound with a stubbed contest roll", () => {
    const input = baseInput({
      offensivePlayers: [
        makePlayer("off_a", OFFENSE_TEAM, { position: "C", rebounding: 99 }),
      ],
      defensivePlayers: [
        makePlayer("def_a", DEFENSE_TEAM, { position: "PG", rebounding: 1 }),
      ],
    });
    // variance rolls (2) + chance roll below probability + pick roll
    const rng = createStubRng([0.5, 0.5, 0.0, 0.0]);
    const result = resolveRebound(input, rng);
    expect(result.type).toBe("offensive");
    expect(result.playerId).toBe("off_a");
  });

  it("can resolve a defensive rebound with a stubbed contest roll", () => {
    const input = baseInput({
      offensivePlayers: [
        makePlayer("off_a", OFFENSE_TEAM, { rebounding: 70 }),
      ],
      defensivePlayers: [
        makePlayer("def_a", DEFENSE_TEAM, { rebounding: 70 }),
      ],
    });
    const rng = createStubRng([0.5, 0.5, 0.99, 0.0]);
    const result = resolveRebound(input, rng);
    expect(result.type).toBe("defensive");
    expect(result.playerId).toBe("def_a");
  });
});

describe("resolveRebound statistical behavior", () => {
  it("produces more defensive than offensive rebounds under neutral conditions", () => {
    const input = baseInput();
    const sampleSize = 10_000;
    let defensive = 0;
    for (let seed = 0; seed < sampleSize; seed += 1) {
      const result = resolveRebound(input, createSeededRng(seed));
      if (result.type === "defensive") {
        defensive += 1;
      }
    }
    const defensiveRate = defensive / sampleSize;
    expect(defensiveRate).toBeGreaterThan(0.5);
    expect(defensiveRate).toBeGreaterThanOrEqual(0.55);
    expect(defensiveRate).toBeLessThanOrEqual(0.8);
  });

  it("increases offensive rebound rate for elite offense vs weak defense", () => {
    const scenarioA = baseInput({
      offensivePlayers: [
        makePlayer("oa1", OFFENSE_TEAM, { position: "C", rebounding: 95 }),
        makePlayer("oa2", OFFENSE_TEAM, { position: "PF", rebounding: 95 }),
        makePlayer("oa3", OFFENSE_TEAM, { position: "SF", rebounding: 90 }),
        makePlayer("oa4", OFFENSE_TEAM, { position: "SG", rebounding: 85 }),
        makePlayer("oa5", OFFENSE_TEAM, { position: "PG", rebounding: 80 }),
      ],
      defensivePlayers: [
        makePlayer("da1", DEFENSE_TEAM, { position: "C", rebounding: 35 }),
        makePlayer("da2", DEFENSE_TEAM, { position: "PF", rebounding: 35 }),
        makePlayer("da3", DEFENSE_TEAM, { position: "SF", rebounding: 30 }),
        makePlayer("da4", DEFENSE_TEAM, { position: "SG", rebounding: 25 }),
        makePlayer("da5", DEFENSE_TEAM, { position: "PG", rebounding: 20 }),
      ],
    });
    const scenarioB = baseInput({
      offensivePlayers: [
        makePlayer("ob1", OFFENSE_TEAM, { position: "C", rebounding: 35 }),
        makePlayer("ob2", OFFENSE_TEAM, { position: "PF", rebounding: 35 }),
        makePlayer("ob3", OFFENSE_TEAM, { position: "SF", rebounding: 30 }),
        makePlayer("ob4", OFFENSE_TEAM, { position: "SG", rebounding: 25 }),
        makePlayer("ob5", OFFENSE_TEAM, { position: "PG", rebounding: 20 }),
      ],
      defensivePlayers: [
        makePlayer("db1", DEFENSE_TEAM, { position: "C", rebounding: 95 }),
        makePlayer("db2", DEFENSE_TEAM, { position: "PF", rebounding: 95 }),
        makePlayer("db3", DEFENSE_TEAM, { position: "SF", rebounding: 90 }),
        makePlayer("db4", DEFENSE_TEAM, { position: "SG", rebounding: 85 }),
        makePlayer("db5", DEFENSE_TEAM, { position: "PG", rebounding: 80 }),
      ],
    });

    const sampleSize = 5_000;
    let offensiveA = 0;
    let offensiveB = 0;
    for (let seed = 0; seed < sampleSize; seed += 1) {
      if (
        resolveRebound(scenarioA, createSeededRng(seed)).type === "offensive"
      ) {
        offensiveA += 1;
      }
      if (
        resolveRebound(scenarioB, createSeededRng(seed + 10_000)).type ===
        "offensive"
      ) {
        offensiveB += 1;
      }
    }

    const rateA = offensiveA / sampleSize;
    const rateB = offensiveB / sampleSize;
    expect(rateA - rateB).toBeGreaterThan(0.15);
  });

  it("favors higher rebound ratings in individual selection", () => {
    const high = makePlayer("high", DEFENSE_TEAM, {
      position: "SF",
      rebounding: 90,
    });
    const low = makePlayer("low", DEFENSE_TEAM, {
      position: "SF",
      rebounding: 40,
    });
    const input = baseInput({
      offensivePlayers: [
        makePlayer("off_weak", OFFENSE_TEAM, { rebounding: 1 }),
      ],
      defensivePlayers: [high, low],
    });

    const sampleSize = 4_000;
    let highCount = 0;
    let lowCount = 0;
    for (let seed = 0; seed < sampleSize; seed += 1) {
      const result = resolveRebound(input, createSeededRng(seed));
      if (result.type !== "defensive") {
        continue;
      }
      if (result.playerId === high.id) {
        highCount += 1;
      } else if (result.playerId === low.id) {
        lowCount += 1;
      }
    }

    expect(highCount + lowCount).toBeGreaterThan(sampleSize * 0.7);
    expect(highCount).toBeGreaterThan(lowCount);
    expect(lowCount).toBeGreaterThan(0);
  });

  it("strongly favors a 99 rebounder over a 1 rebounder", () => {
    const elite = makePlayer("elite", DEFENSE_TEAM, {
      position: "SF",
      rebounding: 99,
    });
    const poor = makePlayer("poor", DEFENSE_TEAM, {
      position: "SF",
      rebounding: 1,
    });
    const input = baseInput({
      offensivePlayers: [
        makePlayer("off_weak", OFFENSE_TEAM, { rebounding: 1 }),
      ],
      defensivePlayers: [elite, poor],
    });

    const sampleSize = 3_000;
    let eliteCount = 0;
    let poorCount = 0;
    for (let seed = 0; seed < sampleSize; seed += 1) {
      const result = resolveRebound(input, createSeededRng(seed));
      if (result.type !== "defensive") {
        continue;
      }
      if (result.playerId === elite.id) {
        eliteCount += 1;
      } else if (result.playerId === poor.id) {
        poorCount += 1;
      }
    }

    expect(eliteCount).toBeGreaterThan(poorCount * 3);
  });

  it("gives frontcourt positions an aggregate advantage at equal ratings", () => {
    const positions: PlayerPosition[] = ["PG", "SG", "SF", "PF", "C"];
    const counts: Record<PlayerPosition, number> = {
      PG: 0,
      SG: 0,
      SF: 0,
      PF: 0,
      C: 0,
    };

    const sampleSize = 8_000;
    for (let seed = 0; seed < sampleSize; seed += 1) {
      const defensivePlayers = positions.map((position, index) =>
        makePlayer(`def_${position}`, DEFENSE_TEAM, {
          position,
          rebounding: 70,
        }),
      );
      // Force defense to win most contests via weak offense
      const input = baseInput({
        offensivePlayers: [
          makePlayer("off_weak", OFFENSE_TEAM, {
            position: "PG",
            rebounding: 1,
          }),
        ],
        defensivePlayers,
      });
      const result = resolveRebound(input, createSeededRng(seed));
      if (result.type !== "defensive") {
        continue;
      }
      const winner = defensivePlayers.find(
        (player) => player.id === result.playerId,
      );
      if (winner) {
        counts[winner.position] += 1;
      }
    }

    expect(counts.C).toBeGreaterThan(counts.PF);
    expect(counts.PF).toBeGreaterThan(counts.SF);
    expect(counts.SF).toBeGreaterThan(counts.SG);
    expect(counts.SG).toBeGreaterThan(counts.PG);
  });

  it("allows a high-rated guard to outperform a low-rated center over a sample", () => {
    const guard = makePlayer("guard90", DEFENSE_TEAM, {
      position: "PG",
      rebounding: 90,
    });
    const center = makePlayer("center50", DEFENSE_TEAM, {
      position: "C",
      rebounding: 50,
    });
    const input = baseInput({
      offensivePlayers: [
        makePlayer("off_weak", OFFENSE_TEAM, { rebounding: 1 }),
      ],
      defensivePlayers: [guard, center],
    });

    const sampleSize = 4_000;
    let guardCount = 0;
    let centerCount = 0;
    for (let seed = 0; seed < sampleSize; seed += 1) {
      const result = resolveRebound(input, createSeededRng(seed));
      if (result.type !== "defensive") {
        continue;
      }
      if (result.playerId === guard.id) {
        guardCount += 1;
      } else if (result.playerId === center.id) {
        centerCount += 1;
      }
    }

    expect(guardCount).toBeGreaterThan(centerCount);
  });

  it("distributes rebounds across identical candidates", () => {
    const players = [
      makePlayer("a", DEFENSE_TEAM, { position: "SF", rebounding: 70 }),
      makePlayer("b", DEFENSE_TEAM, { position: "SF", rebounding: 70 }),
      makePlayer("c", DEFENSE_TEAM, { position: "SF", rebounding: 70 }),
    ];
    const input = baseInput({
      offensivePlayers: [
        makePlayer("off_weak", OFFENSE_TEAM, { rebounding: 1 }),
      ],
      defensivePlayers: players,
    });

    const sampleSize = 3_000;
    const counts = new Map<string, number>([
      ["a", 0],
      ["b", 0],
      ["c", 0],
    ]);
    for (let seed = 0; seed < sampleSize; seed += 1) {
      const result = resolveRebound(input, createSeededRng(seed));
      if (result.type !== "defensive") {
        continue;
      }
      counts.set(result.playerId, (counts.get(result.playerId) ?? 0) + 1);
    }

    for (const count of counts.values()) {
      expect(count).toBeGreaterThan(sampleSize * 0.1);
    }
  });

  it("changes individual share when one player's rating changes", () => {
    const sampleSize = 3_000;

    function shareForRating(rating: number): number {
      const target = makePlayer("target", DEFENSE_TEAM, {
        position: "SF",
        rebounding: rating,
      });
      const other = makePlayer("other", DEFENSE_TEAM, {
        position: "SF",
        rebounding: 60,
      });
      const input = baseInput({
        offensivePlayers: [
          makePlayer("off_weak", OFFENSE_TEAM, { rebounding: 1 }),
        ],
        defensivePlayers: [target, other],
      });
      let wins = 0;
      let defensive = 0;
      for (let seed = 0; seed < sampleSize; seed += 1) {
        const result = resolveRebound(input, createSeededRng(seed));
        if (result.type !== "defensive") {
          continue;
        }
        defensive += 1;
        if (result.playerId === target.id) {
          wins += 1;
        }
      }
      return wins / defensive;
    }

    expect(shareForRating(90)).toBeGreaterThan(shareForRating(40));
  });
});

describe("resolveRebound validation", () => {
  it("rejects a missing RNG", () => {
    expect(() =>
      resolveRebound(baseInput(), null as unknown as Rng),
    ).toThrow(/RNG/);
  });

  it("rejects an empty offensive pool", () => {
    expect(() =>
      resolveRebound(baseInput({ offensivePlayers: [] }), createTestRng()),
    ).toThrow(/offensive pool/);
  });

  it("rejects an empty defensive pool", () => {
    expect(() =>
      resolveRebound(baseInput({ defensivePlayers: [] }), createTestRng()),
    ).toThrow(/defensive pool/);
  });

  it("rejects equal team IDs", () => {
    expect(() =>
      resolveRebound(
        baseInput({
          defensiveTeamId: OFFENSE_TEAM,
          defensivePlayers: [
            makePlayer("d1", OFFENSE_TEAM, { rebounding: 70 }),
          ],
        }),
        createTestRng(),
      ),
    ).toThrow(/different/);
  });

  it("rejects an empty offensive team ID", () => {
    expect(() =>
      resolveRebound(
        baseInput({ offensiveTeamId: asTeamId("") }),
        createTestRng(),
      ),
    ).toThrow(/offensiveTeamId/);
  });

  it("rejects mismatched offensive team membership", () => {
    expect(() =>
      resolveRebound(
        baseInput({
          offensivePlayers: [
            makePlayer("wrong_team", DEFENSE_TEAM, { rebounding: 70 }),
          ],
        }),
        createTestRng(),
      ),
    ).toThrow(/offensivePlayers\[0\] teamId/);
  });

  it("rejects mismatched defensive team membership", () => {
    expect(() =>
      resolveRebound(
        baseInput({
          defensivePlayers: [
            makePlayer("wrong_team", OFFENSE_TEAM, { rebounding: 70 }),
          ],
        }),
        createTestRng(),
      ),
    ).toThrow(/defensivePlayers\[0\] teamId/);
  });

  it("rejects duplicate player IDs within a pool", () => {
    const duplicate = makePlayer("dup", OFFENSE_TEAM, { rebounding: 70 });
    expect(() =>
      resolveRebound(
        baseInput({
          offensivePlayers: [duplicate, { ...duplicate }],
        }),
        createTestRng(),
      ),
    ).toThrow(/duplicate/);
  });

  it("rejects overlapping candidate pools", () => {
    const shared = makePlayer("shared", OFFENSE_TEAM, { rebounding: 70 });
    expect(() =>
      resolveRebound(
        baseInput({
          offensivePlayers: [shared],
          defensivePlayers: [
            makePlayer("shared", DEFENSE_TEAM, { rebounding: 70 }),
          ],
        }),
        createTestRng(),
      ),
    ).toThrow(/share player IDs/);
  });

  it("rejects a null player entry", () => {
    expect(() =>
      resolveRebound(
        baseInput({
          offensivePlayers: [null as unknown as Player],
        }),
        createTestRng(),
      ),
    ).toThrow(/valid player/);
  });

  it("rejects an invalid rebounding rating", () => {
    const player = makePlayer("bad", OFFENSE_TEAM, { rebounding: 70 });
    player.attributes.rebounding = 0;
    expect(() =>
      resolveRebound(
        baseInput({ offensivePlayers: [player] }),
        createTestRng(),
      ),
    ).toThrow(/rebounding/);
  });

  it("rejects an invalid position", () => {
    const player = makePlayer("bad_pos", OFFENSE_TEAM, { rebounding: 70 });
    (player as { position: string }).position = "XX";
    expect(() =>
      resolveRebound(
        baseInput({ offensivePlayers: [player] }),
        createTestRng(),
      ),
    ).toThrow(/position/);
  });
});
