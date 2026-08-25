import { describe, expect, it } from "vitest";
import { createFoul } from "@/domain/entities/foul";
import { createGame, type GamePlayerStats } from "@/domain/entities/game";
import { createEmptyGamePlayerStats } from "@/domain/entities/game";
import type { PlayerStatsDelta } from "@/systems/possession-stats";
import type { Rng } from "@/domain/rng";
import {
  asGameId,
  asPlayerId,
  asPossessionId,
  asSeasonId,
  asTeamId,
} from "@/domain/ids";
import { FOUL_RESOLUTION_CONFIG } from "@/systems/foul-resolution-config";
import {
  applyPossessionResolution,
  resolvePossession,
  type PossessionDecision,
  type ResolvePossessionInput,
} from "@/systems/possession-resolution";
import { createPlayer } from "../factories/player";
import { createTestRng } from "../helpers/determinism";

const OFFENSE = asTeamId("team_offense");
const DEFENSE = asTeamId("team_defense");

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

function offensePlayers() {
  return [
    createPlayer({
      id: "off_1",
      teamId: OFFENSE,
      position: "PG",
      attributes: {
        finishing: 80,
        midRange: 80,
        threePoint: 80,
        freeThrow: 90,
        passing: 90,
        ballHandling: 90,
        rebounding: 50,
      },
    }),
    createPlayer({
      id: "off_2",
      teamId: OFFENSE,
      position: "SF",
      attributes: {
        finishing: 75,
        midRange: 75,
        threePoint: 70,
        freeThrow: 85,
        passing: 70,
        ballHandling: 70,
        rebounding: 60,
      },
    }),
  ];
}

function defensePlayers() {
  return [
    createPlayer({
      id: "def_1",
      teamId: DEFENSE,
      position: "PG",
      attributes: {
        perimeterDefense: 50,
        interiorDefense: 50,
        rebounding: 50,
      },
    }),
    createPlayer({
      id: "def_2",
      teamId: DEFENSE,
      position: "C",
      attributes: {
        perimeterDefense: 40,
        interiorDefense: 40,
        rebounding: 90,
      },
    }),
  ];
}

function baseInput(
  decision: PossessionDecision,
  overrides: Partial<ResolvePossessionInput> = {},
): ResolvePossessionInput {
  return {
    possessionId: asPossessionId("possession_1"),
    offensiveTeamId: OFFENSE,
    defensiveTeamId: DEFENSE,
    offensivePlayers: offensePlayers(),
    defensivePlayers: defensePlayers(),
    defensiveTeamFoulsBefore: 0,
    decision,
    ...overrides,
  };
}

function emptyStats(playerId: string): GamePlayerStats {
  return createEmptyGamePlayerStats(asPlayerId(playerId));
}

function emptyDelta(
  playerId: string,
  overrides: Partial<PlayerStatsDelta> = {},
): PlayerStatsDelta {
  return {
    playerId: asPlayerId(playerId),
    points: 0,
    rebounds: 0,
    offensiveRebounds: 0,
    defensiveRebounds: 0,
    assists: 0,
    turnovers: 0,
    fouls: 0,
    fieldGoalsMade: 0,
    fieldGoalsAttempted: 0,
    threePointersMade: 0,
    threePointersAttempted: 0,
    freeThrowsMade: 0,
    freeThrowsAttempted: 0,
    touches: 0,
    ...overrides,
  };
}

/** Rebound after a miss: force defensive rebound to def_2 (last defensive candidate). */
function missThenDefensiveReboundRolls(
  offensiveCount: number,
  defensiveCount: number,
): number[] {
  // variance rolls (ignored magnitudes as long as finite), chance false for OREB, pick last defense
  return [
    ...Array.from({ length: offensiveCount }, () => 0.5),
    ...Array.from({ length: defensiveCount }, () => 0.5),
    0.99, // chance(orebProb) → false → defensive
    0.99, // weighted pick toward end of defensive pool
  ];
}

/** Force offensive rebound. */
function missThenOffensiveReboundRolls(
  offensiveCount: number,
  defensiveCount: number,
): number[] {
  return [
    ...Array.from({ length: offensiveCount }, () => 0.5),
    ...Array.from({ length: defensiveCount }, () => 0.5),
    0, // chance → true → offensive
    0, // pick first offensive
  ];
}

describe("resolvePossession made shots", () => {
  it("credits two points on a made two-point shot and flips possession", () => {
    const result = resolvePossession(
      baseInput({
        action: "shot",
        shooterId: asPlayerId("off_1"),
        defenderId: asPlayerId("def_1"),
        shotType: "two_point",
      }),
      createStubRng([0]),
    );

    expect(result.possession.action).toBe("shot");
    expect(result.possession.outcome).toBe("shot_made");
    expect(result.pointsScored).toBe(2);
    expect(result.scoringTeamId).toBe(OFFENSE);
    expect(result.playerStats).toEqual([
      emptyDelta("off_1", {
        points: 2,
        fieldGoalsMade: 1,
        fieldGoalsAttempted: 1,
        touches: 1,
      }),
    ]);
    expect(result.events.map((e) => e.type)).toEqual(["shot_made"]);
    expect(result.nextPossession).toEqual({
      offensiveTeamId: DEFENSE,
      defensiveTeamId: OFFENSE,
    });
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]?.type).toBe("shot");
  });

  it("credits three points on a made three-point shot", () => {
    const result = resolvePossession(
      baseInput({
        action: "shot",
        shooterId: asPlayerId("off_1"),
        defenderId: asPlayerId("def_1"),
        shotType: "three_point",
      }),
      createStubRng([0]),
    );

    expect(result.pointsScored).toBe(3);
    expect(result.playerStats[0]?.points).toBe(3);
  });
});

describe("resolvePossession missed shot and rebound", () => {
  it("resolves defensive rebound after a miss and flips possession", () => {
    const result = resolvePossession(
      baseInput({
        action: "shot",
        shooterId: asPlayerId("off_1"),
        defenderId: asPlayerId("def_1"),
        shotType: "two_point",
      }),
      createStubRng([0.99, ...missThenDefensiveReboundRolls(2, 2)]),
    );

    expect(result.possession.outcome).toBe("shot_missed");
    expect(result.pointsScored).toBe(0);
    expect(result.scoringTeamId).toBeNull();
    expect(result.events.map((e) => e.type)).toEqual([
      "shot_missed",
      "rebound",
    ]);
    expect(result.events[0]!.sequence).toBe(0);
    expect(result.events[1]!.sequence).toBe(1);
    expect(result.steps.map((s) => s.type)).toEqual(["shot", "rebound"]);
    const reboundStep = result.steps[1];
    expect(reboundStep?.type).toBe("rebound");
    if (reboundStep?.type === "rebound") {
      expect(reboundStep.result.type).toBe("defensive");
    }
    expect(result.nextPossession).toEqual({
      offensiveTeamId: DEFENSE,
      defensiveTeamId: OFFENSE,
    });
    expect(
      result.playerStats.some((d) => d.rebounds === 1),
    ).toBe(true);
  });

  it("keeps offensive possession after an offensive rebound", () => {
    const result = resolvePossession(
      baseInput({
        action: "shot",
        shooterId: asPlayerId("off_1"),
        defenderId: asPlayerId("def_1"),
        shotType: "two_point",
      }),
      createStubRng([0.99, ...missThenOffensiveReboundRolls(2, 2)]),
    );

    expect(result.events.map((e) => e.type)).toEqual([
      "shot_missed",
      "rebound",
    ]);
    const reboundStep = result.steps[1];
    expect(reboundStep?.type).toBe("rebound");
    if (reboundStep?.type === "rebound") {
      expect(reboundStep.result.type).toBe("offensive");
    }
    expect(result.nextPossession).toEqual({
      offensiveTeamId: OFFENSE,
      defensiveTeamId: DEFENSE,
    });
    expect(result.scoringTeamId).toBeNull();
  });
});

describe("resolvePossession pass and assist", () => {
  it("credits assist when pass completes with opportunity and shot is made", () => {
    // pass success, assist opportunity, shot made
    const result = resolvePossession(
      baseInput({
        action: "pass",
        passerId: asPlayerId("off_1"),
        receiverId: asPlayerId("off_2"),
        defenderId: asPlayerId("def_1"),
      }),
      createStubRng([0, 0, 0]),
    );

    expect(result.possession.action).toBe("pass");
    expect(result.possession.outcome).toBe("pass_completed");
    expect(result.pointsScored).toBe(2);
    expect(result.events.map((e) => e.type)).toEqual([
      "shot_made",
      "assist",
    ]);
    expect(result.playerStats).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          playerId: "off_2",
          points: 2,
        }),
        expect.objectContaining({
          playerId: "off_1",
          assists: 1,
        }),
      ]),
    );
    expect(result.nextPossession.offensiveTeamId).toBe(DEFENSE);
  });

  it("continues possession when pass completes without assist opportunity", () => {
    // pass success, assist opportunity fails
    const result = resolvePossession(
      baseInput({
        action: "pass",
        passerId: asPlayerId("off_1"),
        receiverId: asPlayerId("off_2"),
        defenderId: asPlayerId("def_1"),
      }),
      createStubRng([0, 0.99]),
    );

    expect(result.possession.outcome).toBe("pass_completed");
    expect(result.steps.map((s) => s.type)).toEqual(["pass"]);
    expect(result.events).toEqual([]);
    expect(result.pointsScored).toBe(0);
    expect(result.scoringTeamId).toBeNull();
    expect(result.nextPossession).toEqual({
      offensiveTeamId: OFFENSE,
      defensiveTeamId: DEFENSE,
    });
  });

  it("records turnover when pass fails", () => {
    const result = resolvePossession(
      baseInput({
        action: "pass",
        passerId: asPlayerId("off_1"),
        receiverId: asPlayerId("off_2"),
        defenderId: asPlayerId("def_1"),
      }),
      createStubRng([0.99]),
    );

    expect(result.possession.action).toBe("turnover");
    expect(result.possession.outcome).toBe("turnover");
    expect(result.events.map((e) => e.type)).toEqual(["turnover"]);
    expect(result.playerStats).toEqual([
      emptyDelta("off_1", { turnovers: 1, touches: 1 }),
    ]);
    expect(result.nextPossession.offensiveTeamId).toBe(DEFENSE);
  });
});

describe("resolvePossession turnover", () => {
  it("credits turnover and flips possession", () => {
    const result = resolvePossession(
      baseInput({
        action: "turnover",
        playerId: asPlayerId("off_1"),
      }),
      createStubRng([]),
    );

    expect(result.possession.outcome).toBe("turnover");
    expect(result.pointsScored).toBe(0);
    expect(result.scoringTeamId).toBeNull();
    expect(result.events.map((e) => e.type)).toEqual(["turnover"]);
    expect(result.nextPossession.offensiveTeamId).toBe(DEFENSE);
  });
});

describe("resolvePossession touch credits", () => {
  it("credits the passer once on a pass turnover", () => {
    const result = resolvePossession(
      baseInput({
        action: "pass",
        passerId: asPlayerId("off_1"),
        receiverId: asPlayerId("off_2"),
        defenderId: asPlayerId("def_1"),
      }),
      createStubRng([0.99]),
    );
    expect(result.playerStats).toEqual([
      emptyDelta("off_1", { turnovers: 1, touches: 1 }),
    ]);
  });

  it("credits passer and receiver once each on a completed pass without shot", () => {
    const result = resolvePossession(
      baseInput({
        action: "pass",
        passerId: asPlayerId("off_1"),
        receiverId: asPlayerId("off_2"),
        defenderId: asPlayerId("def_1"),
      }),
      createStubRng([0, 0.99]),
    );
    expect(result.playerStats).toEqual(
      expect.arrayContaining([
        emptyDelta("off_1", { touches: 1 }),
        emptyDelta("off_2", { touches: 1 }),
      ]),
    );
    expect(result.playerStats).toHaveLength(2);
  });

  it("does not double-count the receiver on assist-opportunity catch-and-shoot", () => {
    const result = resolvePossession(
      baseInput({
        action: "pass",
        passerId: asPlayerId("off_1"),
        receiverId: asPlayerId("off_2"),
        defenderId: asPlayerId("def_1"),
      }),
      createStubRng([0, 0, 0]),
    );
    const receiver = result.playerStats.find((row) => row.playerId === "off_2");
    const passer = result.playerStats.find((row) => row.playerId === "off_1");
    expect(receiver?.touches).toBe(1);
    expect(passer?.touches).toBe(1);
  });

  it("credits the fouled shooter once on a shooting foul with FGA", () => {
    const result = resolvePossession(
      baseInput({
        action: "foul",
        foul: createFoul({
          foulingPlayerId: asPlayerId("def_1"),
          fouledPlayerId: asPlayerId("off_1"),
          foulType: "shooting",
        }),
        shotType: "two_point",
      }),
      createStubRng([0.99, 0, 0]),
    );
    const fouled = result.playerStats.find((row) => row.playerId === "off_1");
    expect(fouled?.touches).toBe(1);
    expect(fouled?.fieldGoalsAttempted).toBe(1);
  });
});

describe("resolvePossession fouls", () => {
  it("awards free throws on a missed shooting foul without shot_made/shot_missed events", () => {
    // shot miss for shotMade, then both FTs made
    const result = resolvePossession(
      baseInput({
        action: "foul",
        foul: createFoul({
          foulingPlayerId: asPlayerId("def_1"),
          fouledPlayerId: asPlayerId("off_1"),
          foulType: "shooting",
        }),
        shotType: "two_point",
      }),
      createStubRng([0.99, 0, 0]),
    );

    expect(result.possession.outcome).toBe("shooting_foul");
    expect(result.events.map((e) => e.type)).toEqual([
      "foul",
      "free_throw",
      "free_throw",
    ]);
    expect(result.events.some((e) => e.type === "shot_made")).toBe(false);
    expect(result.events.some((e) => e.type === "shot_missed")).toBe(false);
    expect(result.pointsScored).toBe(2);
    expect(result.defensiveTeamFoulsAfter).toBe(1);
    expect(result.nextPossession.offensiveTeamId).toBe(DEFENSE);
    expect(result.steps.map((s) => s.type)).toEqual([
      "shot",
      "foul",
      "free_throw",
      "free_throw",
    ]);
  });

  it("counts and-1 basket from shotType once plus free throw point", () => {
    // shot made → basketCounts, 1 FT made
    const result = resolvePossession(
      baseInput({
        action: "foul",
        foul: createFoul({
          foulingPlayerId: asPlayerId("def_1"),
          fouledPlayerId: asPlayerId("off_1"),
          foulType: "shooting",
        }),
        shotType: "three_point",
      }),
      createStubRng([0, 0]),
    );

    expect(result.pointsScored).toBe(4);
    expect(result.playerStats).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          playerId: "off_1",
          points: 4,
        }),
        expect.objectContaining({
          playerId: "def_1",
          fouls: 1,
        }),
      ]),
    );
    expect(result.events.map((e) => e.type)).toEqual([
      "foul",
      "free_throw",
    ]);
  });

  it("retains offense on non-shooting foul outside bonus", () => {
    const result = resolvePossession(
      baseInput({
        action: "foul",
        foul: createFoul({
          foulingPlayerId: asPlayerId("def_1"),
          fouledPlayerId: asPlayerId("off_1"),
          foulType: "non-shooting",
        }),
      }),
      createStubRng([]),
    );

    expect(result.possession.outcome).toBe("non_shooting_foul");
    expect(result.pointsScored).toBe(0);
    expect(result.scoringTeamId).toBeNull();
    expect(result.events.map((e) => e.type)).toEqual(["foul"]);
    expect(result.defensiveTeamFoulsAfter).toBe(1);
    expect(result.nextPossession).toEqual({
      offensiveTeamId: OFFENSE,
      defensiveTeamId: DEFENSE,
    });
  });

  it("awards bonus free throws on non-shooting foul in bonus", () => {
    const result = resolvePossession(
      baseInput(
        {
          action: "foul",
          foul: createFoul({
            foulingPlayerId: asPlayerId("def_1"),
            fouledPlayerId: asPlayerId("off_1"),
            foulType: "non-shooting",
          }),
        },
        {
          defensiveTeamFoulsBefore: FOUL_RESOLUTION_CONFIG.bonusThreshold - 1,
        },
      ),
      createStubRng([0, 0]),
    );

    expect(result.defensiveTeamFoulsAfter).toBe(
      FOUL_RESOLUTION_CONFIG.bonusThreshold,
    );
    expect(result.events.map((e) => e.type)).toEqual([
      "foul",
      "free_throw",
      "free_throw",
    ]);
    expect(result.pointsScored).toBe(2);
    expect(result.nextPossession.offensiveTeamId).toBe(DEFENSE);
  });

  it("flips possession on offensive foul without changing defensive team fouls", () => {
    const before = 3;
    const result = resolvePossession(
      baseInput(
        {
          action: "foul",
          foul: createFoul({
            foulingPlayerId: asPlayerId("off_1"),
            fouledPlayerId: asPlayerId("def_1"),
            foulType: "non-shooting",
          }),
        },
        { defensiveTeamFoulsBefore: before },
      ),
      createStubRng([]),
    );

    expect(result.possession.outcome).toBe("offensive_foul");
    expect(result.defensiveTeamFoulsAfter).toBe(before);
    expect(result.events.map((e) => e.type)).toEqual(["foul"]);
    expect(result.playerStats).toEqual([
      emptyDelta("off_1", { fouls: 1, touches: 1 }),
    ]);
    expect(result.scoringTeamId).toBeNull();
    expect(result.nextPossession.offensiveTeamId).toBe(DEFENSE);
  });
});

describe("resolvePossession free throws", () => {
  it("flips possession when all free throws are made", () => {
    const result = resolvePossession(
      baseInput({
        action: "free_throw",
        shooterId: asPlayerId("off_1"),
        awarded: 2,
      }),
      createStubRng([0, 0]),
    );

    expect(result.possession.outcome).toBe("free_throw_made");
    expect(result.pointsScored).toBe(2);
    expect(result.events.map((e) => e.type)).toEqual([
      "free_throw",
      "free_throw",
    ]);
    expect(result.nextPossession.offensiveTeamId).toBe(DEFENSE);
  });

  it("resolves rebound after last free throw miss in chronological order", () => {
    const result = resolvePossession(
      baseInput({
        action: "free_throw",
        shooterId: asPlayerId("off_1"),
        awarded: 2,
      }),
      createStubRng([0, 0.99, ...missThenDefensiveReboundRolls(2, 2)]),
    );

    expect(result.possession.outcome).toBe("free_throw_missed");
    expect(result.events.map((e) => e.type)).toEqual([
      "free_throw",
      "free_throw",
      "rebound",
    ]);
    expect(result.pointsScored).toBe(1);
    expect(result.steps.map((s) => s.type)).toEqual([
      "free_throw",
      "free_throw",
      "rebound",
    ]);
  });
});

describe("resolvePossession event sequencing", () => {
  it("starts event sequences at eventSequenceStart when provided", () => {
    const result = resolvePossession(
      baseInput(
        {
          action: "shot",
          shooterId: asPlayerId("off_1"),
          defenderId: asPlayerId("def_1"),
          shotType: "two_point",
        },
        { eventSequenceStart: 10 },
      ),
      createStubRng([0.99, ...missThenDefensiveReboundRolls(2, 2)]),
    );

    expect(result.events.map((e) => e.sequence)).toEqual([10, 11]);
  });

  it("starts event sequences at 0 when eventSequenceStart is omitted", () => {
    const result = resolvePossession(
      baseInput({
        action: "turnover",
        playerId: asPlayerId("off_1"),
      }),
      createStubRng([]),
    );

    expect(result.events[0]?.sequence).toBe(0);
  });
});

describe("resolvePossession determinism", () => {
  it("produces identical full results for the same seeded rng", () => {
    const input = baseInput({
      action: "shot",
      shooterId: asPlayerId("off_1"),
      defenderId: asPlayerId("def_1"),
      shotType: "two_point",
    });

    const first = resolvePossession(input, createTestRng(99));
    const second = resolvePossession(input, createTestRng(99));

    expect(second).toEqual(first);
    expect(first).toMatchObject({
      possession: expect.any(Object),
      steps: expect.any(Array),
      events: expect.any(Array),
      playerStats: expect.any(Array),
      pointsScored: expect.any(Number),
      defensiveTeamFoulsAfter: expect.any(Number),
      nextPossession: expect.any(Object),
    });
    expect(
      first.scoringTeamId === null || typeof first.scoringTeamId === "string",
    ).toBe(true);
  });
});

describe("resolvePossession invalid input", () => {
  it("rejects identical team ids", () => {
    expect(() =>
      resolvePossession(
        baseInput(
          {
            action: "turnover",
            playerId: asPlayerId("off_1"),
          },
          { defensiveTeamId: OFFENSE },
        ),
        createStubRng([]),
      ),
    ).toThrow(/must be different/);
  });

  it("rejects empty offensive lineup", () => {
    expect(() =>
      resolvePossession(
        baseInput(
          {
            action: "turnover",
            playerId: asPlayerId("off_1"),
          },
          { offensivePlayers: [] },
        ),
        createStubRng([]),
      ),
    ).toThrow(/offensivePlayers/);
  });

  it("rejects player on the wrong team", () => {
    expect(() =>
      resolvePossession(
        baseInput({
          action: "shot",
          shooterId: asPlayerId("def_1"),
          defenderId: asPlayerId("def_2"),
          shotType: "two_point",
        }),
        createStubRng([0]),
      ),
    ).toThrow(/offensive player/);
  });

  it("rejects shooting foul without shotType", () => {
    expect(() =>
      resolvePossession(
        baseInput({
          action: "foul",
          foul: createFoul({
            foulingPlayerId: asPlayerId("def_1"),
            fouledPlayerId: asPlayerId("off_1"),
            foulType: "shooting",
          }),
        }),
        createStubRng([]),
      ),
    ).toThrow(/shotType/);
  });

  it("rejects foul ownership mismatch", () => {
    expect(() =>
      resolvePossession(
        baseInput({
          action: "foul",
          foul: createFoul({
            foulingPlayerId: asPlayerId("off_1"),
            fouledPlayerId: asPlayerId("off_2"),
            foulType: "non-shooting",
          }),
        }),
        createStubRng([]),
      ),
    ).toThrow(/opposing teams|foul ownership/);
  });

  it("rejects offensive foul whose fouler is on defense labeled via wrong pools", () => {
    expect(() =>
      resolvePossession(
        baseInput({
          action: "foul",
          foul: createFoul({
            foulingPlayerId: asPlayerId("def_1"),
            fouledPlayerId: asPlayerId("def_2"),
            foulType: "non-shooting",
          }),
        }),
        createStubRng([]),
      ),
    ).toThrow(/opposing teams|foul ownership/);
  });

  it("rejects negative defensiveTeamFoulsBefore", () => {
    expect(() =>
      resolvePossession(
        baseInput(
          {
            action: "turnover",
            playerId: asPlayerId("off_1"),
          },
          { defensiveTeamFoulsBefore: -1 },
        ),
        createStubRng([]),
      ),
    ).toThrow(/defensiveTeamFoulsBefore/);
  });

  it("rejects non-positive free_throw awarded", () => {
    expect(() =>
      resolvePossession(
        baseInput({
          action: "free_throw",
          shooterId: asPlayerId("off_1"),
          awarded: 0,
        }),
        createStubRng([]),
      ),
    ).toThrow(/awarded/);
  });

  it("rejects null rng", () => {
    expect(() =>
      resolvePossession(
        baseInput({
          action: "turnover",
          playerId: asPlayerId("off_1"),
        }),
        null as unknown as Rng,
      ),
    ).toThrow(/Rng/);
  });
});

describe("applyPossessionResolution", () => {
  it("returns a new Game and leaves the original unchanged", () => {
    const game = createGame({
      competitionType: "regular_season",
      homeTeamSnapshot: null,
      awayTeamSnapshot: null,
      id: asGameId("game_1"),
      seasonId: asSeasonId("season_1"),
      homeTeamId: OFFENSE,
      awayTeamId: DEFENSE,
      date: "2026-10-15",
      status: "in_progress",
      score: { home: 10, away: 8 },
      periodScores: [],
      events: [],
      playerStats: [emptyStats("off_1"), emptyStats("def_1")],
    });
    const original = structuredClone(game);

    const resolution = resolvePossession(
      baseInput({
        action: "shot",
        shooterId: asPlayerId("off_1"),
        defenderId: asPlayerId("def_1"),
        shotType: "two_point",
      }),
      createStubRng([0]),
    );

    const updated = applyPossessionResolution(game, resolution);

    expect(updated).not.toBe(game);
    expect(game).toEqual(original);
    expect(updated.score).toEqual({ home: 12, away: 8 });
    expect(updated.events).toHaveLength(1);
    expect(
      updated.playerStats.find((s) => s.playerId === "off_1")?.points,
    ).toBe(2);
  });
});
