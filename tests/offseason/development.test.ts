/**
 * Offseason player development: age bands, caps, determinism, input
 * direction, injuries, retirement, development focus and the once-a-year
 * age rollover.
 *
 * Rule-level checks run on cheap hand-built cohorts; the rollover and
 * retirement checks use the real fixture (season_transition vs
 * roster_decisions).
 */

import { describe, expect, it } from "vitest";
import {
  DEFAULT_FOCUS_BY_POSITION,
  DEVELOPMENT_FOCUS_ATTRIBUTES,
  DEVELOPMENT_FOCUSES,
  type DevelopmentFocus,
} from "@/domain/entities/development-plan";
import { FACILITY_LEVEL_MAX } from "@/domain/entities/franchise-ops";
import {
  PLAYER_ATTRIBUTE_KEYS,
  RATING_MAX,
  RATING_MIN,
  type Player,
} from "@/domain/entities/player";
import type { TeamId } from "@/domain/ids";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import { createSeededRng } from "@/domain/rng";
import type { GameState } from "@/state/game-state";
import { developmentOpportunityFactor } from "@/systems/injury/injury-effects";
import { PLAYER_RETIREMENT_MIN_AGE } from "@/systems/league-rules/invariants";
import {
  developPlayer,
  CAMP_ATTRIBUTE_BONUS,
} from "@/systems/player-development";
import {
  MAX_ANNUAL_ATTRIBUTE_CHANGE,
  MAX_ANNUAL_OVERALL_GAIN,
  MAX_ANNUAL_OVERALL_LOSS,
} from "@/systems/player-development-config";
import {
  playerRetirementProbability,
  processPlayerRetirements,
} from "@/systems/player-retirement";
import { processSeasonPlayerDevelopment } from "@/systems/season-player-development";
import { campAssignments, campSlotsForTeam } from "@/systems/development-plans";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { TEST_RNG_SEED } from "../helpers/determinism";
import { createTestGameState } from "../factories/game-state";
import {
  createPlayer,
  createTestInjury,
  uniformPlayerAttributes,
} from "../factories/player";
import { buildOffseasonFixture } from "./driver";
import { assertOffseasonInvariants } from "./invariants";

const SEED = TEST_RNG_SEED;

function overallOf(player: Player): number {
  return calculatePlayerOverall(player.position, player.attributes);
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** A small world (12 teams, rosters, staff, facilities), built once. */
let cachedWorld: GameState | undefined;
function world(): GameState {
  if (cachedWorld === undefined) {
    const initial = createTestGameState({ saveId: "dev_world" });
    cachedWorld = bootstrapWorld(
      initial,
      createSeededRng(initial.meta.rngState),
    ).state;
  }
  return cachedWorld;
}

type CohortOptions = {
  tag: string;
  /** Age before the offseason rollover (development happens at age + 1). */
  age: number;
  count: number;
  teamId?: TeamId | null;
  attributes?: number;
  potential?: number;
  workEthic?: number;
  focus?: Partial<Player>;
};

function cohort(options: CohortOptions): Player[] {
  return Array.from({ length: options.count }, (_, index) =>
    createPlayer({
      id: `dev_${options.tag}_${options.age}_${index}`,
      teamId: options.teamId ?? null,
      contractId: null,
      age: options.age,
      attributes: uniformPlayerAttributes(options.attributes ?? 62),
      potential: { overall: options.potential ?? 88 },
      personality: { workEthic: options.workEthic ?? 50 },
      ...options.focus,
    }),
  );
}

function withPlayers(state: GameState, players: Player[]): GameState {
  const next = { ...state.world.players };
  for (const player of players) next[player.id] = player;
  return { ...state, world: { ...state.world, players: next } };
}

/** Runs the real offseason tick and returns the developed cohort. */
function develop(
  state: GameState,
  players: Player[],
  seed: number,
): Array<{ before: Player; after: Player }> {
  const result = processSeasonPlayerDevelopment(
    withPlayers(state, players),
    createSeededRng(seed),
  ).state;
  return players.map((before) => ({
    before,
    after: result.world.players[before.id]!,
  }));
}

function meanOverallChange(pairs: Array<{ before: Player; after: Player }>) {
  return mean(
    pairs.map(({ before, after }) => overallOf(after) - overallOf(before)),
  );
}

describe("age bands (mean overall change in one offseason)", () => {
  // Players are listed by age BEFORE the rollover; development runs at +1.
  // Observed means (<=22: +2.2, 23-26: +1.3, 27-30: -0.2, 31-33: -0.9,
  // 34+: -2.0; uniform 62 attrs, potential 88, work ethic 50, free
  // agents, 240 players per age) are noted per bucket; bands leave margin
  // for a different draw order but still pin the curve's shape.
  const buckets: Array<{
    name: string;
    ages: number[];
    min: number;
    max: number;
  }> = [
    { name: "<=22", ages: [19, 20, 21], min: 1.5, max: 3.0 },
    { name: "23-26", ages: [22, 23, 24, 25], min: 0.7, max: 2.0 },
    { name: "27-30", ages: [26, 27, 28, 29], min: -0.7, max: 0.3 },
    { name: "31-33", ages: [30, 31, 32], min: -1.5, max: -0.4 },
    { name: "34+", ages: [33, 34, 36, 38], min: -2.8, max: -1.2 },
  ];

  it.each(buckets)("$name stays within its expected mean change", (bucket) => {
    const changes = bucket.ages.flatMap((age, index) =>
      develop(world(), cohort({ tag: "band", age, count: 240 }), SEED + index),
    );
    const observed = meanOverallChange(changes);
    expect(observed).toBeGreaterThanOrEqual(bucket.min);
    expect(observed).toBeLessThanOrEqual(bucket.max);
  });

  it("orders the buckets: young gain, old decline", () => {
    const meanFor = (age: number) =>
      meanOverallChange(
        develop(world(), cohort({ tag: "order", age, count: 240 }), SEED),
      );
    expect(meanFor(20)).toBeGreaterThan(meanFor(24));
    expect(meanFor(24)).toBeGreaterThan(meanFor(28));
    expect(meanFor(28)).toBeGreaterThan(meanFor(31));
    expect(meanFor(31)).toBeGreaterThan(meanFor(35));
  });

  it("keeps every change inside the annual caps and every rating in 1-99", () => {
    const extremes = [
      { attributes: 20, potential: 99 },
      { attributes: 50, potential: 70 },
      { attributes: 70, potential: 75 },
      { attributes: 97, potential: 99 },
      { attributes: 98, potential: 98 },
    ];
    for (const [index, spec] of extremes.entries()) {
      for (const age of [18, 21, 24, 27, 30, 33, 37]) {
        const pairs = develop(
          world(),
          cohort({ tag: `cap${index}`, age, count: 60, ...spec }),
          SEED + index,
        );
        for (const { before, after } of pairs) {
          const delta = overallOf(after) - overallOf(before);
          expect(delta).toBeLessThanOrEqual(MAX_ANNUAL_OVERALL_GAIN);
          expect(delta).toBeGreaterThanOrEqual(-MAX_ANNUAL_OVERALL_LOSS);
          for (const key of PLAYER_ATTRIBUTE_KEYS) {
            expect(after.attributes[key]).toBeGreaterThanOrEqual(RATING_MIN);
            expect(after.attributes[key]).toBeLessThanOrEqual(RATING_MAX);
            expect(
              Math.abs(after.attributes[key] - before.attributes[key]),
            ).toBeLessThanOrEqual(MAX_ANNUAL_ATTRIBUTE_CHANGE);
          }
          // Potential is a ceiling for anyone who started under it.
          if (overallOf(before) <= before.potential.overall) {
            expect(overallOf(after)).toBeLessThanOrEqual(
              after.potential.overall,
            );
          }
          expect(after.age).toBe(before.age + 1);
        }
      }
    }
  });
});

describe("determinism", () => {
  const players = () => [
    ...cohort({ tag: "det", age: 21, count: 25 }),
    ...cohort({ tag: "det", age: 33, count: 25 }),
  ];

  it("same seed gives identical ratings, a different seed does not", () => {
    const a = develop(world(), players(), SEED);
    const b = develop(world(), players(), SEED);
    const c = develop(world(), players(), SEED + 1);
    expect(a.map((pair) => pair.after)).toEqual(b.map((pair) => pair.after));
    expect(a.map((pair) => pair.after.attributes)).not.toEqual(
      c.map((pair) => pair.after.attributes),
    );
  });

  it("does not mutate the state it is given", () => {
    const state = withPlayers(world(), players());
    const before = structuredClone(state.world.players);
    processSeasonPlayerDevelopment(state, createSeededRng(SEED));
    expect(state.world.players).toEqual(before);
  });
});

describe("inputs push growth the right way (developing players)", () => {
  // 22 -> 23 sits in the tapered band with plenty of room to potential.
  const AGE = 21;
  const COUNT = 400;

  function teamFor(state: GameState): TeamId {
    return state.user.activeOwnerTeamId;
  }

  function withFacilities(state: GameState, level: number): GameState {
    const teamId = teamFor(state);
    const ops = state.business.franchiseOps[teamId]!;
    const slot = { level, upgradeWeeksRemaining: 0 };
    return {
      ...state,
      business: {
        ...state.business,
        franchiseOps: {
          ...state.business.franchiseOps,
          [teamId]: {
            ...ops,
            facilities: {
              ...ops.facilities,
              practice: slot,
              training: slot,
              medical: slot,
            },
          },
        },
      },
    };
  }

  function withTrainerQuality(state: GameState, quality: number): GameState {
    const teamId = teamFor(state);
    const staff = { ...state.world.staff };
    let found = false;
    for (const id of state.world.teams[teamId]!.staff ?? []) {
      const member = staff[id];
      if (member?.role !== "trainer") continue;
      found = true;
      staff[id] = {
        ...member,
        attributes: {
          ...member.attributes,
          playerDevelopment: quality,
          skillDevelopment: quality,
          potentialDevelopment: quality,
        },
      };
    }
    expect(found).toBe(true);
    return { ...state, world: { ...state.world, staff } };
  }

  const gain = (state: GameState, workEthic = 50) =>
    meanOverallChange(
      develop(
        state,
        cohort({
          tag: "in",
          age: AGE,
          count: COUNT,
          teamId: teamFor(state),
          workEthic,
        }),
        SEED,
      ),
    );

  it("higher work ethic grows more", () => {
    const low = gain(world(), 10);
    const mid = gain(world(), 50);
    const high = gain(world(), 95);
    expect(mid).toBeGreaterThan(low + 0.1);
    expect(high).toBeGreaterThan(mid + 0.1);
  });

  it("better facilities grow more", () => {
    const poor = gain(withFacilities(world(), 1));
    const elite = gain(withFacilities(world(), FACILITY_LEVEL_MAX));
    expect(elite).toBeGreaterThan(poor + 0.15);
  });

  it("better trainers grow more", () => {
    const poor = gain(withTrainerQuality(world(), 20));
    const elite = gain(withTrainerQuality(world(), 90));
    expect(elite).toBeGreaterThan(poor + 0.15);
  });
});

describe("injuries (developmentOpportunityFactor)", () => {
  const healthy = () =>
    createPlayer({
      age: 22,
      attributes: uniformPlayerAttributes(60),
      potential: { overall: 90 },
    });

  it("is exactly 1 with no active injury and never leaves 0.4-1", () => {
    expect(developmentOpportunityFactor(healthy())).toBe(1);
    for (const severity of ["minor", "moderate", "major", "severe"] as const) {
      for (const recoveryProgress of [0, 0.5, 1]) {
        const factor = developmentOpportunityFactor(
          createPlayer({
            activeInjuries: [createTestInjury({ severity, recoveryProgress })],
          }),
        );
        expect(factor).toBeGreaterThanOrEqual(0.4);
        expect(factor).toBeLessThanOrEqual(1);
      }
    }
  });

  it("costs more for worse injuries and less as recovery progresses", () => {
    const factorOf = (
      severity: "minor" | "moderate" | "major" | "severe",
      recoveryProgress: number,
    ) =>
      developmentOpportunityFactor(
        createPlayer({
          activeInjuries: [createTestInjury({ severity, recoveryProgress })],
        }),
      );
    expect(factorOf("moderate", 0)).toBeLessThan(factorOf("minor", 0));
    expect(factorOf("major", 0)).toBeLessThan(factorOf("moderate", 0));
    expect(factorOf("severe", 0)).toBeLessThan(factorOf("major", 0));
    expect(factorOf("major", 0.8)).toBeGreaterThan(factorOf("major", 0));
  });

  it("scales only positive gains of the player, by that factor", () => {
    const injured = createPlayer({
      ...healthy(),
      activeInjuries: [createTestInjury({ severity: "severe" })],
    });
    const factor = developmentOpportunityFactor(injured);
    expect(factor).toBeLessThanOrEqual(0.6);

    let healthyTotal = 0;
    let injuredTotal = 0;
    for (let seed = 0; seed < 300; seed += 1) {
      const a = developPlayer(healthy(), createSeededRng(seed));
      const b = developPlayer(injured, createSeededRng(seed), 1);
      healthyTotal += overallOf(a) - overallOf(healthy());
      injuredTotal += overallOf(b) - overallOf(healthy());
      for (const key of PLAYER_ATTRIBUTE_KEYS) {
        // The same draws; injury can only shrink a positive delta.
        expect(b.attributes[key]).toBeLessThanOrEqual(a.attributes[key]);
      }
    }
    expect(injuredTotal).toBeLessThan(healthyTotal * 0.8);
    expect(injuredTotal).toBeGreaterThan(0);
  });

  it("leaves declines untouched", () => {
    const vet = (activeInjuries: ReturnType<typeof createTestInjury>[]) =>
      createPlayer({
        age: 35,
        attributes: uniformPlayerAttributes(70),
        potential: { overall: 80 },
        activeInjuries,
      });
    const injured = vet([createTestInjury({ severity: "severe" })]);
    for (let seed = 0; seed < 200; seed += 1) {
      const a = developPlayer(vet([]), createSeededRng(seed));
      const b = developPlayer(injured, createSeededRng(seed));
      for (const key of PLAYER_ATTRIBUTE_KEYS) {
        if (a.attributes[key] < 70) {
          expect(b.attributes[key]).toBe(a.attributes[key]);
        }
      }
    }
  });
});

describe("training camps", () => {
  const ages = [20, 24, 28, 32, 36];

  it.each(DEVELOPMENT_FOCUSES.filter((focus) => focus !== "balanced"))(
    "%s never lowers any rating versus no camp and adds at most the bonus",
    (focus) => {
      const targets = DEVELOPMENT_FOCUS_ATTRIBUTES[focus];
      let improved = 0;
      for (const age of ages) {
        const player = createPlayer({
          age,
          attributes: uniformPlayerAttributes(65),
          potential: { overall: age < 28 ? 85 : 66 },
        });
        for (let seed = 0; seed < 40; seed += 1) {
          const plain = developPlayer(player, createSeededRng(seed), 1);
          const camp = developPlayer(player, createSeededRng(seed), 1, focus);
          for (const key of PLAYER_ATTRIBUTE_KEYS) {
            const gain = camp.attributes[key] - plain.attributes[key];
            if (targets.includes(key)) {
              expect(gain).toBeGreaterThanOrEqual(0);
              expect(gain).toBeLessThanOrEqual(CAMP_ATTRIBUTE_BONUS);
              expect(
                camp.attributes[key] - player.attributes[key],
              ).toBeLessThanOrEqual(MAX_ANNUAL_ATTRIBUTE_CHANGE);
              if (gain > 0) improved += 1;
            } else {
              expect(gain).toBe(0);
            }
          }
          const overall = calculatePlayerOverall(
            camp.position,
            camp.attributes,
          );
          expect(overall).toBeLessThanOrEqual(player.potential.overall);
          expect(
            overall -
              calculatePlayerOverall(player.position, player.attributes),
          ).toBeLessThanOrEqual(MAX_ANNUAL_OVERALL_GAIN);
        }
      }
      expect(improved).toBeGreaterThan(0);
    },
  );

  it("balanced equals the default output", () => {
    const player = createPlayer({
      age: 22,
      attributes: uniformPlayerAttributes(60),
      potential: { overall: 90 },
    });
    for (let seed = 0; seed < 30; seed += 1) {
      expect(
        developPlayer(player, createSeededRng(seed), 1, "balanced"),
      ).toEqual(developPlayer(player, createSeededRng(seed)));
    }
  });

  it("helps a declining veteran hold their camp skills", () => {
    const player = createPlayer({
      age: 34,
      attributes: uniformPlayerAttributes(70),
      potential: { overall: 70 },
    });
    const targets = DEVELOPMENT_FOCUS_ATTRIBUTES.defense;
    const campChange = (focus: DevelopmentFocus) => {
      let sum = 0;
      for (let seed = 0; seed < 200; seed += 1) {
        const developed = developPlayer(
          player,
          createSeededRng(seed),
          1,
          focus,
        );
        for (const key of targets) {
          sum += developed.attributes[key] - player.attributes[key];
        }
      }
      return sum;
    };
    expect(campChange("defense")).toBeGreaterThan(campChange("balanced"));
  });

  describe("campAssignments", () => {
    const state = world();
    const userTeam = state.user.activeOwnerTeamId;
    const cpuTeam = Object.keys(state.world.teams).find(
      (id) => id !== userTeam,
    ) as TeamId;

    it("sends owner picks of any age, up to the trainer's slots", () => {
      const roster = state.world.teams[userTeam]!.roster;
      const slots = campSlotsForTeam(state, userTeam);
      const plans = Object.fromEntries(
        roster.map((id) => [id, "shooting" as const]),
      );
      const veteran = roster[0]!;
      const planned: GameState = {
        ...state,
        world: {
          ...state.world,
          players: {
            ...state.world.players,
            [veteran]: { ...state.world.players[veteran]!, age: 35 },
          },
        },
        business: { ...state.business, developmentPlans: plans },
      };
      const camps = campAssignments(planned);
      const mine = roster.filter((id) => camps[id]);
      expect(mine).toEqual(roster.slice(0, slots));
      expect(camps[veteran]).toBe("shooting");
    });

    it("sends CPU players to their position's camp, up to the slots, any age", () => {
      const camps = campAssignments(state);
      const roster = state.world.teams[cpuTeam]!.roster;
      const sent = roster.filter((id) => camps[id]);
      expect(sent).toHaveLength(
        Math.min(roster.length, campSlotsForTeam(state, cpuTeam)),
      );
      for (const id of sent) {
        expect(camps[id]).toBe(
          DEFAULT_FOCUS_BY_POSITION[state.world.players[id]!.position],
        );
      }
      // Free agents never attend.
      for (const player of Object.values(state.world.players)) {
        if (player.teamId == null) expect(camps[player.id]).toBeUndefined();
      }
    });
  });
});

describe("retirement rules", () => {
  /** Every rostered player is the given age; ratings untouched. */
  function leagueAtAge(age: number): GameState {
    const state = world();
    const players = { ...state.world.players };
    for (const [id, player] of Object.entries(players)) {
      if (player.teamId != null) players[id] = { ...player, age };
    }
    return { ...state, world: { ...state.world, players } };
  }
  const rostered = (state: GameState) =>
    Object.values(state.world.players).filter((p) => p.teamId != null);

  it("never retires rostered players below the minimum age", () => {
    const state = leagueAtAge(PLAYER_RETIREMENT_MIN_AGE - 1);
    const result = processPlayerRetirements(state, createSeededRng(SEED)).state;
    for (const player of rostered(state)) {
      expect(result.world.players[player.id]!.retired).not.toBe(true);
    }
  });

  it("retires old players at roughly the stated probability and cleans up after them", () => {
    const age = 41;
    const state = leagueAtAge(age);
    const result = processPlayerRetirements(state, createSeededRng(SEED)).state;
    const before = rostered(state);
    const retired = before.filter(
      (player) => result.world.players[player.id]!.retired === true,
    );
    const expected = mean(
      before.map((player) =>
        playerRetirementProbability(age, overallOf(player)),
      ),
    );
    expect(retired.length).toBeGreaterThan(0);
    expect(Math.abs(retired.length / before.length - expected)).toBeLessThan(
      0.12,
    );

    for (const player of retired) {
      const after = result.world.players[player.id]!;
      expect(after.teamId).toBeNull();
      expect(after.contractId).toBeNull();
      expect(after.age).toBe(age);
      expect(result.business.contracts[player.contractId!]).toBeUndefined();
      for (const team of Object.values(result.world.teams)) {
        expect(team.roster).not.toContain(player.id);
      }
    }
    // Everyone else is untouched and keeps team and contract.
    for (const player of before) {
      if (retired.includes(player)) continue;
      expect(result.world.players[player.id]!.teamId).toBe(player.teamId);
      expect(result.world.players[player.id]!.contractId).toBe(
        player.contractId,
      );
    }
  });

  it("is idempotent for players who already retired", () => {
    const state = leagueAtAge(45);
    const once = processPlayerRetirements(state, createSeededRng(SEED)).state;
    const twice = processPlayerRetirements(
      once,
      createSeededRng(SEED + 1),
    ).state;
    for (const player of Object.values(once.world.players)) {
      if (player.retired !== true) continue;
      expect(twice.world.players[player.id]).toEqual(player);
    }
  });
});

describe("the real season rollover", () => {
  const before = buildOffseasonFixture({
    seed: SEED,
    phase: "offseason.season_transition",
  }).state;
  const after = buildOffseasonFixture({
    seed: SEED,
    phase: "offseason.roster_decisions",
  }).state;

  it("ages every active player exactly once and passes the invariants", () => {
    assertOffseasonInvariants(after, {
      label: `seed ${SEED}`,
      previous: before,
    });
    let checked = 0;
    for (const player of Object.values(before.world.players)) {
      if (player.retired === true) continue;
      const next = after.world.players[player.id];
      if (next === undefined) continue;
      if (next.retired === true) {
        expect([player.age, player.age + 1]).toContain(next.age);
      } else {
        expect(next.age).toBe(player.age + 1);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(100);
  });

  it("develops within the annual caps and keeps ratings legal", () => {
    let gainers = 0;
    let decliners = 0;
    for (const player of Object.values(before.world.players)) {
      const next = after.world.players[player.id];
      if (player.retired === true || next === undefined) continue;
      if (next.retired === true) continue;
      const delta = overallOf(next) - overallOf(player);
      expect(delta).toBeLessThanOrEqual(MAX_ANNUAL_OVERALL_GAIN);
      expect(delta).toBeGreaterThanOrEqual(-MAX_ANNUAL_OVERALL_LOSS);
      expect(overallOf(next)).toBeLessThanOrEqual(
        Math.max(next.potential.overall, overallOf(player)),
      );
      if (delta > 0) gainers += 1;
      if (delta < 0) decliners += 1;
    }
    expect(gainers).toBeGreaterThan(0);
    expect(decliners).toBeGreaterThan(0);
  });

  it("young players gain and old players decline across the league", () => {
    const changes = (test: (age: number) => boolean) =>
      Object.values(before.world.players)
        .filter((p) => p.retired !== true && test(p.age))
        .flatMap((p) => {
          const next = after.world.players[p.id];
          return next === undefined || next.retired === true
            ? []
            : [overallOf(next) - overallOf(p)];
        });
    const young = changes((age) => age <= 22);
    const old = changes((age) => age >= 31);
    expect(young.length).toBeGreaterThan(5);
    expect(old.length).toBeGreaterThan(5);
    expect(mean(young)).toBeGreaterThan(0);
    expect(mean(old)).toBeLessThan(0);
  });

  it("retires players off rosters, contracts and the free-agent pool", () => {
    const newlyRetired = Object.values(after.world.players).filter(
      (player) =>
        player.retired === true &&
        before.world.players[player.id]?.retired !== true,
    );
    expect(newlyRetired.length).toBeGreaterThan(0);
    const rosterIds = new Set(
      Object.values(after.world.teams).flatMap((team) => team.roster),
    );
    for (const player of newlyRetired) {
      expect(player.teamId).toBeNull();
      expect(player.contractId).toBeNull();
      expect(rosterIds.has(player.id)).toBe(false);
      const contracts = Object.values(after.business.contracts).filter(
        (contract) => contract.playerId === player.id,
      );
      expect(contracts).toHaveLength(0);
      const previous = before.world.players[player.id]!;
      // Only players who were old enough, or sat out unsigned, retire.
      expect(
        previous.age >= PLAYER_RETIREMENT_MIN_AGE - 1 ||
          previous.teamId === null,
      ).toBe(true);
    }
  });
});
