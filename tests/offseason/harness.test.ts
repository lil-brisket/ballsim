import { describe, expect, it } from "vitest";
import type { GameState } from "@/state/game-state";
import { getActivePhaseId } from "@/systems/phase-engine";
import { TEST_RNG_SEED } from "../helpers/determinism";
import {
  advanceThroughPhase,
  buildOffseasonFixture,
  createOffseasonLeague,
  OFFSEASON_FIXTURE_PHASES,
  OffseasonPhaseStuckError,
} from "./driver";
import {
  assertOffseasonInvariants,
  collectOffseasonInvariantIssues,
} from "./invariants";
import {
  diffOffseasonSnapshots,
  snapshotOffseason,
  stateForComparison,
} from "./snapshot";

const SEED = TEST_RNG_SEED;

function codes(state: GameState, previous?: GameState): string[] {
  return collectOffseasonInvariantIssues(state, { previous }).map(
    (issue) => issue.code,
  );
}

describe("offseason fixtures", () => {
  it.each(OFFSEASON_FIXTURE_PHASES)("parks a valid save at %s", (phase) => {
    const fixture = buildOffseasonFixture({ seed: SEED, phase });
    expect(getActivePhaseId(fixture.state)).toBe(phase);
    expect(fixture.userTeamId).toBe(fixture.state.user.activeOwnerTeamId);
    assertOffseasonInvariants(fixture.state, { label: `seed ${SEED}` });
  });

  it("hands out independent copies", () => {
    const a = buildOffseasonFixture({ seed: SEED, phase: "offseason.draft" });
    const b = buildOffseasonFixture({ seed: SEED, phase: "offseason.draft" });
    expect(a.state).not.toBe(b.state);
    expect(stateForComparison(a.state)).toEqual(stateForComparison(b.state));
  });

  it("builds different leagues from different seeds", () => {
    expect(snapshotOffseason(createOffseasonLeague(SEED))).not.toEqual(
      snapshotOffseason(createOffseasonLeague(SEED + 1)),
    );
  });
});

describe("advanceThroughPhase", () => {
  it("is deterministic for the same state and actions", () => {
    const { state } = buildOffseasonFixture({
      seed: SEED,
      phase: "offseason.roster_decisions",
    });
    const a = advanceThroughPhase(state, "offseason.roster_decisions");
    const b = advanceThroughPhase(state, "offseason.roster_decisions");
    expect(stateForComparison(a.state)).toEqual(stateForComparison(b.state));
    expect(a.events.map((event) => event.type)).toEqual(
      b.events.map((event) => event.type),
    );
    expect(a.toPhaseId).toBe("offseason.draft_preparation");
  });

  it("does not mutate the state it is given", () => {
    const { state } = buildOffseasonFixture({
      seed: SEED,
      phase: "offseason.roster_decisions",
    });
    const before = structuredClone(state);
    advanceThroughPhase(state, "offseason.roster_decisions");
    expect(state).toEqual(before);
  });

  it("refuses a phase the state is not in", () => {
    const { state } = buildOffseasonFixture({
      seed: SEED,
      phase: "offseason.draft",
    });
    expect(() => advanceThroughPhase(state, "offseason.free_agency")).toThrow(
      /expected phase "offseason.free_agency"/,
    );
  });

  it("applies scripted actions and records rejected ones", () => {
    const { state } = buildOffseasonFixture({
      seed: SEED,
      phase: "offseason.roster_decisions",
    });
    let ran = false;
    const result = advanceThroughPhase(state, "offseason.roster_decisions", {
      userActions: [
        {
          label: "marker",
          run: (current) => {
            ran = true;
            return current;
          },
        },
        {
          label: "illegal",
          run: () => {
            throw new Error("not allowed");
          },
        },
        { label: "never", onDay: 9999, run: (current) => current },
      ],
    });
    expect(ran).toBe(true);
    expect(result.actions).toEqual([
      { label: "marker", day: 0, status: "applied" },
      { label: "illegal", day: 0, status: "rejected", error: "not allowed" },
      { label: "never", day: 9999, status: "not_run" },
    ]);
  });

  it("reports a phase that waits on the user as stuck", () => {
    const { state } = buildOffseasonFixture({
      seed: SEED,
      phase: "postseason.season_review",
    });
    expect(() =>
      advanceThroughPhase(state, "postseason.season_review", {
        autoUser: false,
        maxDays: 3,
      }),
    ).toThrow(OffseasonPhaseStuckError);
  });
});

describe("offseason invariants", () => {
  const { state } = buildOffseasonFixture({
    seed: SEED,
    phase: "offseason.free_agency",
  });

  it("pass on a real save", () => {
    expect(codes(state)).toEqual([]);
  });

  it("catch a player on two rosters", () => {
    const [a, b] = Object.values(state.world.teams);
    const stolen = a!.roster[0]!;
    const broken: GameState = {
      ...state,
      world: {
        ...state.world,
        teams: {
          ...state.world.teams,
          [b!.id]: { ...b!, roster: [...b!.roster, stolen] },
        },
      },
    };
    expect(codes(broken)).toContain("ROSTER_DUPLICATE");
  });

  it("catch a rostered player in the free-agent pool", () => {
    const player = Object.values(state.world.players).find(
      (candidate) => candidate.teamId != null && candidate.retired !== true,
    )!;
    const broken: GameState = {
      ...state,
      world: {
        ...state.world,
        players: {
          ...state.world.players,
          [player.id]: { ...player, contractId: null, teamId: null },
        },
      },
    };
    expect(codes(broken)).toContain("ROSTER_AND_FREE_AGENT");
  });

  it("catch a player who belongs to a team but is on no roster", () => {
    const team = Object.values(state.world.teams)[0]!;
    const broken: GameState = {
      ...state,
      world: {
        ...state.world,
        teams: {
          ...state.world.teams,
          [team.id]: { ...team, roster: team.roster.slice(1) },
        },
      },
    };
    expect(codes(broken)).toContain("PLAYER_OFF_ROSTER");
  });

  it("catch a contract below the minimum", () => {
    const contract = Object.values(state.business.contracts).find(
      (candidate) =>
        candidate.endYear >= state.competition.season.year + 1 &&
        state.world.players[candidate.playerId]?.contractId === candidate.id,
    )!;
    const year = String(contract.endYear);
    const broken: GameState = {
      ...state,
      business: {
        ...state.business,
        contracts: {
          ...state.business.contracts,
          [contract.id]: {
            ...contract,
            salaryByYear: { ...contract.salaryByYear, [year]: 1 },
          },
        },
      },
    };
    expect(codes(broken)).toContain("CONTRACT_BELOW_MINIMUM");
  });

  it("catch an expired contract on a roster", () => {
    const contract = Object.values(state.business.contracts).find(
      (candidate) =>
        state.world.players[candidate.playerId]?.contractId === candidate.id,
    )!;
    const broken: GameState = {
      ...state,
      business: {
        ...state.business,
        contracts: {
          ...state.business.contracts,
          [contract.id]: {
            ...contract,
            startYear: 1990,
            endYear: 1991,
            salaryByYear: { "1990": 1_000_000, "1991": 1_000_000 },
          },
        },
      },
    };
    expect(codes(broken)).toContain("CONTRACT_EXPIRED_ON_TEAM");
  });

  it("catch a cash balance that skips the ledger", () => {
    const teamId = Object.keys(state.business.finances)[0]!;
    const finances = state.business.finances[teamId]!;
    const broken: GameState = {
      ...state,
      business: {
        ...state.business,
        finances: {
          ...state.business.finances,
          [teamId]: {
            ...finances,
            businessFunds: finances.businessFunds + 12_345,
          },
        },
      },
    };
    expect(codes(broken)).toContain("CASH_LEDGER_MISMATCH");
  });

  it("catch an out-of-range rating and a NaN field", () => {
    const player = Object.values(state.world.players).find(
      (candidate) => candidate.retired !== true,
    )!;
    const broken: GameState = {
      ...state,
      world: {
        ...state.world,
        players: {
          ...state.world.players,
          [player.id]: {
            ...player,
            age: Number.NaN,
            attributes: { ...player.attributes, speed: 120 },
          },
        },
      },
    };
    expect(codes(broken)).toEqual(
      expect.arrayContaining(["RATING_OUT_OF_RANGE", "PLAYER_FIELD_INVALID"]),
    );
  });

  it("catch a duplicate draft pick", () => {
    const [first] = Object.values(state.world.draftPicks);
    const broken: GameState = {
      ...state,
      world: {
        ...state.world,
        draftPicks: {
          ...state.world.draftPicks,
          [`${first!.id}_copy`]: {
            ...first!,
            id: `${first!.id}_copy` as never,
          },
        },
      },
    };
    expect(codes(broken)).toContain("PICK_DUPLICATE");
  });

  it("catch a player who aged twice across a rollover", () => {
    const before = buildOffseasonFixture({
      seed: SEED,
      phase: "offseason.staff_development",
    }).state;
    const after = buildOffseasonFixture({
      seed: SEED,
      phase: "preseason.preparation",
    }).state;
    expect(codes(after, before)).toEqual([]);
    const player = Object.values(after.world.players).find(
      (candidate) =>
        candidate.retired !== true && before.world.players[candidate.id],
    )!;
    const broken: GameState = {
      ...after,
      world: {
        ...after.world,
        players: {
          ...after.world.players,
          [player.id]: { ...player, age: player.age + 1 },
        },
      },
    };
    expect(codes(broken, before)).toContain("AGE_INCREMENT");
  });

  it("name the seed, phase and rule when asserting", () => {
    const player = Object.values(state.world.players).find(
      (candidate) => candidate.retired !== true,
    )!;
    const broken: GameState = {
      ...state,
      world: {
        ...state.world,
        players: {
          ...state.world.players,
          [player.id]: {
            ...player,
            attributes: { ...player.attributes, speed: 0 },
          },
        },
      },
    };
    expect(() =>
      assertOffseasonInvariants(broken, { label: "seed 42" }),
    ).toThrow(
      /seed 42, season \d+, offseason\.free_agency[\s\S]*RATING_OUT_OF_RANGE/,
    );
  });
});

describe("snapshotOffseason", () => {
  it("is stable and shows what changed between phases", () => {
    const before = buildOffseasonFixture({
      seed: SEED,
      phase: "offseason.draft",
    }).state;
    const after = buildOffseasonFixture({
      seed: SEED,
      phase: "offseason.free_agency",
    }).state;
    expect(snapshotOffseason(before)).toEqual(snapshotOffseason(before));
    const diff = diffOffseasonSnapshots(
      snapshotOffseason(before),
      snapshotOffseason(after),
    );
    expect(diff.some((line) => line.startsWith("phaseId:"))).toBe(true);
  });
});
