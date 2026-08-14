import { describe, expect, it } from "vitest";
import {
  PLAYER_POSITIONS,
  type Player,
  type PlayerPosition,
} from "@/domain/entities/player";
import { asPlayerId, type PlayerId } from "@/domain/ids";
import {
  createRosterRulesConfig,
  validateBench,
  validateInactivePlayers,
  validateRoster,
  validateRosterRulesConfig,
  validateRosterSize,
  validateStartingLineup,
  type RosterAssignment,
  type RosterRulesConfig,
  type RosterRulesConfigInput,
} from "@/systems/roster-rules";
import { createPlayer } from "../factories/player";

const DEFAULT_INPUT: RosterRulesConfigInput = {
  minRosterSize: 8,
  maxRosterSize: 12,
  startingLineupSize: 5,
  benchSize: 4,
  inactiveSize: 1,
  allowedPositions: [...PLAYER_POSITIONS],
};

function validInput(
  overrides: Partial<RosterRulesConfigInput> = {},
): RosterRulesConfigInput {
  return {
    ...DEFAULT_INPUT,
    ...overrides,
    allowedPositions:
      overrides.allowedPositions ?? DEFAULT_INPUT.allowedPositions,
  };
}

function validRules(
  overrides: Partial<RosterRulesConfigInput> = {},
): RosterRulesConfig {
  return createRosterRulesConfig(validInput(overrides));
}

function createRosterPlayers(count: number): Player[] {
  return Array.from({ length: count }, (_, index) =>
    createPlayer({
      id: `player_${index + 1}`,
      position: PLAYER_POSITIONS[index % PLAYER_POSITIONS.length],
    }),
  );
}

function idsOf(players: readonly Player[]): PlayerId[] {
  return players.map((player) => player.id);
}

function validAssignment(
  rules: RosterRulesConfig = validRules(),
  playerCount: number = rules.startingLineupSize + rules.benchSize + rules.inactiveSize,
): RosterAssignment {
  const players = createRosterPlayers(playerCount);
  return {
    players,
    startingLineup: idsOf(players.slice(0, rules.startingLineupSize)),
    bench: idsOf(
      players.slice(
        rules.startingLineupSize,
        rules.startingLineupSize + rules.benchSize,
      ),
    ),
    inactive: idsOf(
      players.slice(
        rules.startingLineupSize + rules.benchSize,
        rules.startingLineupSize + rules.benchSize + rules.inactiveSize,
      ),
    ),
  };
}

describe("createRosterRulesConfig", () => {
  it("creates a valid configuration", () => {
    const rules = createRosterRulesConfig(validInput());
    expect(rules.minRosterSize).toBe(8);
    expect(rules.maxRosterSize).toBe(12);
    expect(rules.startingLineupSize).toBe(5);
    expect(rules.benchSize).toBe(4);
    expect(rules.inactiveSize).toBe(1);
    expect(rules.allowedPositions).toEqual([...PLAYER_POSITIONS]);
  });

  it("copies allowedPositions instead of sharing the input array", () => {
    const allowedPositions: PlayerPosition[] = ["PG", "SG", "SF"];
    const rules = createRosterRulesConfig(
      validInput({
        minRosterSize: 8,
        maxRosterSize: 12,
        startingLineupSize: 5,
        benchSize: 3,
        inactiveSize: 0,
        allowedPositions,
      }),
    );
    allowedPositions.push("PF");
    expect(rules.allowedPositions).toEqual(["PG", "SG", "SF"]);
  });

  it("accepts a frozen allowedPositions array", () => {
    const allowedPositions = Object.freeze(["PG", "SG", "SF", "PF", "C"]);
    const rules = createRosterRulesConfig(
      validInput({ allowedPositions }),
    );
    expect(rules.allowedPositions).toEqual([...PLAYER_POSITIONS]);
  });

  it("accepts composition exactly at minimum", () => {
    const rules = createRosterRulesConfig(
      validInput({
        minRosterSize: 8,
        startingLineupSize: 5,
        benchSize: 3,
        inactiveSize: 0,
      }),
    );
    expect(rules.minRosterSize).toBe(8);
    expect(
      rules.startingLineupSize + rules.benchSize + rules.inactiveSize,
    ).toBe(8);
  });

  it("accepts composition exactly at maximum", () => {
    const rules = createRosterRulesConfig(
      validInput({
        maxRosterSize: 12,
        startingLineupSize: 5,
        benchSize: 6,
        inactiveSize: 1,
      }),
    );
    expect(rules.maxRosterSize).toBe(12);
    expect(
      rules.startingLineupSize + rules.benchSize + rules.inactiveSize,
    ).toBe(12);
  });
});

describe("validateRosterRulesConfig", () => {
  it("accepts a valid configuration", () => {
    expect(() => validateRosterRulesConfig(validRules())).not.toThrow();
  });

  it("rejects minRosterSize below 1", () => {
    expect(() =>
      createRosterRulesConfig(validInput({ minRosterSize: 0 })),
    ).toThrow(/Roster rules minRosterSize must be an integer >= 1/);
  });

  it.each([1.5, NaN, Infinity, -1])(
    "rejects invalid minRosterSize=%s",
    (minRosterSize) => {
      expect(() =>
        createRosterRulesConfig(validInput({ minRosterSize })),
      ).toThrow(/Roster rules minRosterSize must be an integer >= 1/);
    },
  );

  it("rejects maxRosterSize below minRosterSize", () => {
    expect(() =>
      createRosterRulesConfig(
        validInput({ minRosterSize: 10, maxRosterSize: 9 }),
      ),
    ).toThrow(/Roster rules maxRosterSize must be an integer >= minRosterSize/);
  });

  it.each([9.5, NaN, Infinity])(
    "rejects invalid maxRosterSize=%s",
    (maxRosterSize) => {
      expect(() =>
        createRosterRulesConfig(validInput({ maxRosterSize })),
      ).toThrow(/Roster rules maxRosterSize must be an integer >= minRosterSize/);
    },
  );

  it("rejects startingLineupSize below 1", () => {
    expect(() =>
      createRosterRulesConfig(validInput({ startingLineupSize: 0 })),
    ).toThrow(/Roster rules startingLineupSize must be an integer >= 1/);
  });

  it("rejects negative benchSize", () => {
    expect(() =>
      createRosterRulesConfig(validInput({ benchSize: -1 })),
    ).toThrow(/Roster rules benchSize must be an integer >= 0/);
  });

  it("rejects negative inactiveSize", () => {
    expect(() =>
      createRosterRulesConfig(validInput({ inactiveSize: -1 })),
    ).toThrow(/Roster rules inactiveSize must be an integer >= 0/);
  });

  it.each([1.5, NaN, Infinity])(
    "rejects invalid benchSize=%s",
    (benchSize) => {
      expect(() =>
        createRosterRulesConfig(validInput({ benchSize })),
      ).toThrow(/Roster rules benchSize must be an integer >= 0/);
    },
  );

  it("rejects empty allowedPositions", () => {
    expect(() =>
      createRosterRulesConfig(validInput({ allowedPositions: [] })),
    ).toThrow(/Roster rules allowedPositions must not be empty/);
  });

  it("rejects duplicate allowedPositions", () => {
    expect(() =>
      createRosterRulesConfig(
        validInput({ allowedPositions: ["PG", "SG", "PG"] }),
      ),
    ).toThrow(/Roster rules allowedPositions contains duplicate positions/);
  });

  it("rejects invalid position configuration", () => {
    expect(() =>
      createRosterRulesConfig(
        validInput({
          allowedPositions: ["PG", "XX"] as unknown as PlayerPosition[],
        }),
      ),
    ).toThrow(/Roster rules allowedPositions contains invalid position XX/);
  });

  it("rejects composition below minimum", () => {
    expect(() =>
      createRosterRulesConfig(
        validInput({
          minRosterSize: 8,
          startingLineupSize: 5,
          benchSize: 2,
          inactiveSize: 0,
        }),
      ),
    ).toThrow(/Roster rules composition must be at least minRosterSize/);
  });

  it("rejects composition above maximum", () => {
    expect(() =>
      createRosterRulesConfig(
        validInput({
          maxRosterSize: 12,
          startingLineupSize: 5,
          benchSize: 6,
          inactiveSize: 2,
        }),
      ),
    ).toThrow(/Roster rules composition must be at most maxRosterSize/);
  });
});

describe("validateRosterSize", () => {
  const rules = validRules();

  it("rejects a roster below the minimum", () => {
    expect(() => validateRosterSize(7, rules)).toThrow(
      /Roster size must be at least 8/,
    );
  });

  it("accepts a roster at the minimum", () => {
    expect(() => validateRosterSize(8, rules)).not.toThrow();
  });

  it("accepts a roster within limits", () => {
    expect(() => validateRosterSize(10, rules)).not.toThrow();
  });

  it("accepts a roster at the maximum", () => {
    expect(() => validateRosterSize(12, rules)).not.toThrow();
  });

  it("rejects a roster above the maximum", () => {
    expect(() => validateRosterSize(13, rules)).toThrow(
      /Roster size must be at most 12/,
    );
  });

  it.each([-1, 3.5, NaN, Infinity])(
    "rejects invalid playerCount=%s",
    (playerCount) => {
      expect(() => validateRosterSize(playerCount, rules)).toThrow(
        /Roster playerCount must be an integer >= 0/,
      );
    },
  );

  it("rejects invalid rules before checking playerCount", () => {
    const invalidRules = {
      ...rules,
      minRosterSize: 0,
    };
    expect(() => validateRosterSize(10, invalidRules)).toThrow(
      /Roster rules minRosterSize must be an integer >= 1/,
    );
  });
});

describe("validateRoster", () => {
  it("accepts a fully assigned roster with all allowed positions", () => {
    const rules = validRules();
    expect(() => validateRoster(validAssignment(rules), rules)).not.toThrow();
  });

  it("accepts multiple position types when they are allowed", () => {
    const rules = validRules({ allowedPositions: ["PG", "SG"] });
    const players = [
      createPlayer({ id: "player_1", position: "PG" }),
      createPlayer({ id: "player_2", position: "SG" }),
      createPlayer({ id: "player_3", position: "PG" }),
      createPlayer({ id: "player_4", position: "SG" }),
      createPlayer({ id: "player_5", position: "PG" }),
      createPlayer({ id: "player_6", position: "SG" }),
      createPlayer({ id: "player_7", position: "PG" }),
      createPlayer({ id: "player_8", position: "SG" }),
      createPlayer({ id: "player_9", position: "PG" }),
      createPlayer({ id: "player_10", position: "SG" }),
    ];
    const assignment: RosterAssignment = {
      players,
      startingLineup: idsOf(players.slice(0, 5)),
      bench: idsOf(players.slice(5, 9)),
      inactive: idsOf(players.slice(9, 10)),
    };
    expect(() => validateRoster(assignment, rules)).not.toThrow();
  });

  it("rejects a disallowed position", () => {
    const rules = validRules({ allowedPositions: ["PG", "SG", "SF", "PF"] });
    const assignment = validAssignment(rules);
    const center = createPlayer({ id: "player_1", position: "C" });
    const players = [center, ...assignment.players.slice(1)];
    expect(() =>
      validateRoster({ ...assignment, players }, rules),
    ).toThrow(/Roster player player_1 has disallowed position C/);
  });

  it("rejects duplicate PlayerIds even when the objects differ", () => {
    const rules = validRules();
    const playerA = createPlayer({ id: "player_1", position: "PG" });
    const playerB = createPlayer({ id: "player_1", position: "SG" });
    expect(playerA).not.toBe(playerB);
    expect(playerA.id).toBe(playerB.id);

    const others = createRosterPlayers(9).map((player, index) =>
      createPlayer({
        id: `player_${index + 2}`,
        position: player.position,
      }),
    );
    const players = [playerA, playerB, ...others.slice(1)];
    const assignment: RosterAssignment = {
      players,
      startingLineup: [
        playerA.id,
        others[1]!.id,
        others[2]!.id,
        others[3]!.id,
        others[4]!.id,
      ],
      bench: idsOf(others.slice(5, 9)),
      inactive: [others[0]!.id],
    };

    expect(() => validateRoster(assignment, rules)).toThrow(
      /Roster contains duplicate player player_1/,
    );
  });

  it("rejects a size-valid roster that is not fully assignable", () => {
    const rules = validRules({
      minRosterSize: 8,
      maxRosterSize: 12,
      startingLineupSize: 5,
      benchSize: 4,
      inactiveSize: 1,
    });
    expect(() => validateRosterSize(8, rules)).not.toThrow();

    const assignment = validAssignment(rules, 8);
    expect(() => validateRoster(assignment, rules)).toThrow(
      /Roster must contain exactly 10 players to be fully assigned/,
    );
  });

  it("does not mutate, sort, or repair duplicate lineup input", () => {
    const rules = validRules();
    const assignment = validAssignment(rules);
    const startingLineup = [
      assignment.startingLineup[0]!,
      assignment.startingLineup[0]!,
      ...assignment.startingLineup.slice(2),
    ];
    const frozen = {
      players: Object.freeze([...assignment.players]),
      startingLineup: Object.freeze(startingLineup),
      bench: Object.freeze([...assignment.bench]),
      inactive: Object.freeze([...assignment.inactive]),
    };
    const snapshot = structuredClone(frozen);

    expect(() => validateRoster(frozen, rules)).toThrow(
      /Roster starting lineup contains duplicate player player_1/,
    );
    expect(frozen).toEqual(snapshot);
  });
});

describe("validateStartingLineup", () => {
  it("accepts a correct lineup size", () => {
    const rules = validRules();
    expect(() =>
      validateStartingLineup(validAssignment(rules), rules),
    ).not.toThrow();
  });

  it("rejects an incorrect lineup size", () => {
    const rules = validRules();
    const assignment = validAssignment(rules);
    expect(() =>
      validateStartingLineup(
        { ...assignment, startingLineup: assignment.startingLineup.slice(0, 4) },
        rules,
      ),
    ).toThrow(/Roster starting lineup must contain exactly 5 players/);
  });

  it("rejects a duplicate player within the lineup", () => {
    const rules = validRules();
    const assignment = validAssignment(rules);
    const startingLineup = [
      assignment.startingLineup[0]!,
      assignment.startingLineup[0]!,
      ...assignment.startingLineup.slice(2),
    ];
    expect(() =>
      validateStartingLineup({ ...assignment, startingLineup }, rules),
    ).toThrow(/Roster starting lineup contains duplicate player player_1/);
  });

  it("rejects a player who is not on the roster", () => {
    const rules = validRules();
    const assignment = validAssignment(rules);
    const startingLineup = [
      asPlayerId("player_missing"),
      ...assignment.startingLineup.slice(1),
    ];
    expect(() =>
      validateStartingLineup({ ...assignment, startingLineup }, rules),
    ).toThrow(/Roster starting lineup player player_missing is not on the roster/);
  });

  it("rejects an inactive player in the starting lineup", () => {
    const rules = validRules();
    const assignment = validAssignment(rules);
    const startingLineup = [
      assignment.inactive[0]!,
      ...assignment.startingLineup.slice(1),
    ];
    expect(() =>
      validateStartingLineup({ ...assignment, startingLineup }, rules),
    ).toThrow(/Roster player player_10 cannot appear in multiple groups/);
  });

  it("rejects a starter who also appears on the bench", () => {
    const rules = validRules();
    const assignment = validAssignment(rules);
    const startingLineup = [
      assignment.bench[0]!,
      ...assignment.startingLineup.slice(1),
    ];
    expect(() =>
      validateStartingLineup({ ...assignment, startingLineup }, rules),
    ).toThrow(/Roster player player_6 cannot appear in multiple groups/);
  });

  it("rejects a disallowed position in the starting lineup", () => {
    const rules = validRules({ allowedPositions: ["PG", "SG", "SF", "PF"] });
    const assignment = validAssignment(rules);
    const center = createPlayer({ id: "player_1", position: "C" });
    expect(() =>
      validateStartingLineup(
        { ...assignment, players: [center, ...assignment.players.slice(1)] },
        rules,
      ),
    ).toThrow(/Roster player player_1 has disallowed position C/);
  });
});

describe("validateBench", () => {
  it("accepts a valid bench", () => {
    const rules = validRules();
    expect(() => validateBench(validAssignment(rules), rules)).not.toThrow();
  });

  it("rejects an incorrect bench size", () => {
    const rules = validRules();
    const assignment = validAssignment(rules);
    expect(() =>
      validateBench({ ...assignment, bench: assignment.bench.slice(0, 3) }, rules),
    ).toThrow(/Roster bench must contain exactly 4 players/);
  });

  it("rejects a duplicate player within the bench", () => {
    const rules = validRules();
    const assignment = validAssignment(rules);
    const bench = [
      assignment.bench[0]!,
      assignment.bench[0]!,
      ...assignment.bench.slice(2),
    ];
    expect(() => validateBench({ ...assignment, bench }, rules)).toThrow(
      /Roster bench contains duplicate player player_6/,
    );
  });

  it("rejects a starter who is also on the bench", () => {
    const rules = validRules();
    const assignment = validAssignment(rules);
    const bench = [assignment.startingLineup[0]!, ...assignment.bench.slice(1)];
    expect(() => validateBench({ ...assignment, bench }, rules)).toThrow(
      /Roster player player_1 cannot appear in multiple groups/,
    );
  });

  it("rejects an inactive player on the bench", () => {
    const rules = validRules();
    const assignment = validAssignment(rules);
    const bench = [assignment.inactive[0]!, ...assignment.bench.slice(1)];
    expect(() => validateBench({ ...assignment, bench }, rules)).toThrow(
      /Roster player player_10 cannot appear in multiple groups/,
    );
  });

  it("rejects a bench player who is not on the roster", () => {
    const rules = validRules();
    const assignment = validAssignment(rules);
    const bench = [asPlayerId("player_missing"), ...assignment.bench.slice(1)];
    expect(() => validateBench({ ...assignment, bench }, rules)).toThrow(
      /Roster bench player player_missing is not on the roster/,
    );
  });

  it("rejects a disallowed position on the bench", () => {
    const rules = validRules({ allowedPositions: ["PG", "SG", "SF", "PF"] });
    const assignment = validAssignment(rules);
    const center = createPlayer({ id: "player_6", position: "C" });
    const players = assignment.players.map((player) =>
      player.id === "player_6" ? center : player,
    );
    expect(() =>
      validateBench({ ...assignment, players }, rules),
    ).toThrow(/Roster player player_6 has disallowed position C/);
  });
});

describe("validateInactivePlayers", () => {
  it("accepts valid inactive players", () => {
    const rules = validRules();
    expect(() =>
      validateInactivePlayers(validAssignment(rules), rules),
    ).not.toThrow();
  });

  it("counts inactive players toward roster size", () => {
    const rules = validRules();
    const assignment = validAssignment(rules);
    expect(assignment.players).toHaveLength(10);
    expect(assignment.inactive).toHaveLength(1);
    expect(() => validateRosterSize(assignment.players.length, rules)).not.toThrow();
    expect(() => validateRoster(assignment, rules)).not.toThrow();
  });

  it("rejects an inactive player who is also a starter", () => {
    const rules = validRules();
    const assignment = validAssignment(rules);
    const inactive = [assignment.startingLineup[0]!];
    expect(() =>
      validateInactivePlayers({ ...assignment, inactive }, rules),
    ).toThrow(/Roster player player_1 cannot appear in multiple groups/);
  });

  it("rejects an inactive player who is also on the bench", () => {
    const rules = validRules();
    const assignment = validAssignment(rules);
    const inactive = [assignment.bench[0]!];
    expect(() =>
      validateInactivePlayers({ ...assignment, inactive }, rules),
    ).toThrow(/Roster player player_6 cannot appear in multiple groups/);
  });

  it("rejects a duplicate inactive player", () => {
    const rules = validRules({
      startingLineupSize: 5,
      benchSize: 3,
      inactiveSize: 2,
    });
    const assignment = validAssignment(rules);
    const inactive = [assignment.inactive[0]!, assignment.inactive[0]!];
    expect(() =>
      validateInactivePlayers({ ...assignment, inactive }, rules),
    ).toThrow(/Roster inactive contains duplicate player player_9/);
  });

  it("rejects an inactive player who is not on the roster", () => {
    const rules = validRules();
    const assignment = validAssignment(rules);
    expect(() =>
      validateInactivePlayers(
        { ...assignment, inactive: [asPlayerId("player_missing")] },
        rules,
      ),
    ).toThrow(/Roster inactive player player_missing is not on the roster/);
  });

  it("rejects a disallowed position among inactive players", () => {
    const rules = validRules({ allowedPositions: ["PG", "SG", "SF", "PF"] });
    const assignment = validAssignment(rules);
    const center = createPlayer({ id: "player_10", position: "C" });
    const players = assignment.players.map((player) =>
      player.id === "player_10" ? center : player,
    );
    expect(() =>
      validateInactivePlayers({ ...assignment, players }, rules),
    ).toThrow(/Roster player player_10 has disallowed position C/);
  });
});

describe("purity", () => {
  it("does not mutate frozen inputs on a passing call", () => {
    const rules = Object.freeze({
      ...validRules(),
      allowedPositions: Object.freeze([...PLAYER_POSITIONS]) as PlayerPosition[],
    });
    const assignment = validAssignment(rules);
    const frozenPlayers = Object.freeze(
      assignment.players.map((player) => Object.freeze({ ...player })),
    );
    const frozen: RosterAssignment = {
      players: frozenPlayers,
      startingLineup: Object.freeze([...assignment.startingLineup]),
      bench: Object.freeze([...assignment.bench]),
      inactive: Object.freeze([...assignment.inactive]),
    };
    const assignmentSnapshot = structuredClone(frozen);
    const rulesSnapshot = structuredClone(rules);

    validateRoster(frozen, rules);
    validateStartingLineup(frozen, rules);
    validateBench(frozen, rules);
    validateInactivePlayers(frozen, rules);

    expect(frozen).toEqual(assignmentSnapshot);
    expect(rules).toEqual(rulesSnapshot);
  });

  it("does not mutate frozen inputs on a failing call", () => {
    const rules = Object.freeze({
      ...validRules(),
      allowedPositions: Object.freeze([...PLAYER_POSITIONS]) as PlayerPosition[],
    });
    const assignment = validAssignment(rules);
    const startingLineup = [
      assignment.startingLineup[0]!,
      assignment.startingLineup[0]!,
      ...assignment.startingLineup.slice(2),
    ];
    const frozenPlayers = Object.freeze(
      assignment.players.map((player) => Object.freeze({ ...player })),
    );
    const frozen: RosterAssignment = {
      players: frozenPlayers,
      startingLineup: Object.freeze(startingLineup),
      bench: Object.freeze([...assignment.bench]),
      inactive: Object.freeze([...assignment.inactive]),
    };
    const assignmentSnapshot = structuredClone(frozen);
    const rulesSnapshot = structuredClone(rules);

    expect(() => validateStartingLineup(frozen, rules)).toThrow(
      /Roster starting lineup contains duplicate player player_1/,
    );
    expect(() => validateRoster(frozen, rules)).toThrow(
      /Roster starting lineup contains duplicate player player_1/,
    );
    expect(frozen).toEqual(assignmentSnapshot);
    expect(rules).toEqual(rulesSnapshot);
  });
});
