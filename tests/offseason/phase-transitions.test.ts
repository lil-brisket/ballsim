import { beforeAll, describe, expect, it } from "vitest";
import { createContract } from "@/domain/entities/contract";
import { draftClassIdFor } from "@/domain/entities/draft";
import { draftPickIdFor } from "@/domain/entities/draft-pick";
import type { TradeProposal } from "@/domain/entities/trade-proposal";
import type { DomainEvent } from "@/domain/events";
import { asContractId, type PlayerId, type TeamId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import type { GameState } from "@/state/game-state";
import { draftYearForSeason } from "@/systems/draft";
import {
  buildOfferSheet,
  canEnterPhase,
  canPerformAction,
  createPendingRfaStatus,
  getActionBlockReason,
  assertActionAllowed,
  type LeagueAction,
  type LeagueActionKind,
} from "@/systems/league-rules";
import {
  TRANSACTION_LEGALITY_MATRIX,
  resolveTradeWindowSegment,
} from "@/systems/league-rules/transaction-matrix";
import {
  LEAGUE_PHASE_IDS,
  PHASE_DEFINITIONS,
  getActivePhaseId,
  previewAdvance,
  setActivePhase,
  type LeaguePhaseId,
} from "@/systems/phase-engine";
import { advanceSimulation } from "@/systems/simulation/advance-simulation";
import {
  advanceLeaguePhase,
  processPhaseExit,
} from "@/systems/simulation/offseason-lifecycle";
import { TEST_RNG_SEED } from "../helpers/determinism";
import { advanceThroughPhase, createOffseasonLeague } from "./driver";
import { assertOffseasonInvariants } from "./invariants";
import { stateForComparison } from "./snapshot";

const SEED = TEST_RNG_SEED;

// ---------------------------------------------------------------------------
// Whole-cycle run, shared by the lifecycle sections. One league, one season
// plus the following offseason, run phase by phase with the real engine.
// ---------------------------------------------------------------------------

type CycleStep = {
  from: LeaguePhaseId;
  to: LeaguePhaseId;
  before: GameState;
  after: GameState;
  events: DomainEvent[];
  days: number;
};

function runCycle(): CycleStep[] {
  let state = createOffseasonLeague(SEED);
  const steps: CycleStep[] = [];
  let regularReached = 0;
  while (steps.length < 20) {
    const from = getActivePhaseId(state);
    const result = advanceThroughPhase(state, from);
    steps.push({
      from,
      to: result.toPhaseId,
      before: state,
      after: result.state,
      events: result.events,
      days: result.days,
    });
    state = result.state;
    if (result.toPhaseId === "regular") {
      regularReached += 1;
      if (regularReached === 2) break;
    }
  }
  return steps;
}

let cycle: CycleStep[] = [];
let cycleError: unknown;

beforeAll(() => {
  try {
    cycle = runCycle();
  } catch (error) {
    cycleError = error;
  }
}, 120_000);

function step(from: LeaguePhaseId, nth = 0): CycleStep {
  if (cycleError !== undefined) throw cycleError;
  const found = cycle.filter((entry) => entry.from === from)[nth];
  if (found === undefined) throw new Error(`no cycle step from ${from}`);
  return found;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

// ---------------------------------------------------------------------------
// Actions x phases
// ---------------------------------------------------------------------------

const MATRIX_KINDS = Object.keys(
  TRANSACTION_LEGALITY_MATRIX,
) as (keyof typeof TRANSACTION_LEGALITY_MATRIX)[];

type PhaseCase = { phase: LeaguePhaseId; tradesOpen: boolean; name: string };

const PHASE_CASES: PhaseCase[] = LEAGUE_PHASE_IDS.flatMap(
  (phase): PhaseCase[] =>
    phase === "regular"
      ? [
          { phase, tradesOpen: true, name: "regular (before deadline)" },
          { phase, tradesOpen: false, name: "regular (after deadline)" },
        ]
      : [{ phase, tradesOpen: false, name: phase }],
);

let base: GameState;

function teams(state: GameState): { a: TeamId; b: TeamId } {
  const ids = Object.keys(state.world.teams).sort() as TeamId[];
  return { a: ids[0]!, b: ids[1]! };
}

function rostered(state: GameState, teamId: TeamId): PlayerId {
  return state.world.teams[teamId]!.roster[0]!;
}

function playerProposal(state: GameState): TradeProposal {
  const { a, b } = teams(state);
  return {
    sideA: { teamId: a, playerIds: [rostered(state, a)], draftPickIds: [] },
    sideB: { teamId: b, playerIds: [rostered(state, b)], draftPickIds: [] },
  };
}

function pickProposal(state: GameState): TradeProposal {
  const { a, b } = teams(state);
  return {
    sideA: {
      teamId: a,
      playerIds: [],
      draftPickIds: [draftPickIdFor(a, state.competition.season.year + 1, 1)],
    },
    sideB: { teamId: b, playerIds: [], draftPickIds: [] },
  };
}

function withRfa(
  state: GameState,
  pendingMatch: boolean,
): { state: GameState; playerId: PlayerId } {
  const { a, b } = teams(state);
  const playerId = rostered(state, a);
  const year = state.competition.season.year;
  const pending = createPendingRfaStatus({
    playerId,
    originalTeamId: a,
    seasonYear: year,
    qualifyingOfferSalary: 5_000_000,
  });
  const status = pendingMatch
    ? {
        ...pending,
        resolution: "pending_match" as const,
        activeOfferSheet: buildOfferSheet(
          b,
          createContract({
            id: asContractId(`contract_rfa_${playerId}`),
            playerId,
            teamId: b,
            startYear: year,
            endYear: year + 1,
            salaryByYear: {
              [String(year)]: 5_000_000,
              [String(year + 1)]: 5_000_000,
            },
          }),
          state.world.calendar.currentDate,
        ),
      }
    : pending;
  return {
    playerId,
    state: {
      ...state,
      business: {
        ...state.business,
        rfaStatuses: { ...state.business.rfaStatuses, [playerId]: status },
      },
    },
  };
}

/** A state and action where only the phase can make the action illegal. */
function scenario(
  kind: LeagueActionKind,
  phaseCase: PhaseCase,
): { state: GameState; action: LeagueAction } {
  const { a, b } = teams(base);
  let state: GameState = {
    ...base,
    competition: {
      ...base.competition,
      season: {
        ...base.competition.season,
        tradeDeadlineDate: phaseCase.tradesOpen ? "2099-01-01" : "2000-01-01",
      },
    },
  };
  const playerId = rostered(state, a);
  let action: LeagueAction;
  switch (kind) {
    case "trade":
    case "player_trade":
      action = { kind, proposal: playerProposal(state) };
      break;
    case "pick_trade":
      action = { kind, proposal: pickProposal(state) };
      break;
    case "sign_free_agent":
    case "make_free_agent_offer":
    case "contract_extension":
    case "player_release":
      action = { kind, playerId, teamId: a };
      break;
    case "submit_rfa_offer_sheet": {
      const rfa = withRfa(state, false);
      state = rfa.state;
      action = {
        kind,
        playerId: rfa.playerId,
        offeringTeamId: b,
        terms: createContract({
          id: asContractId("contract_offer"),
          playerId: rfa.playerId,
          teamId: b,
          startYear: state.competition.season.year,
          endYear: state.competition.season.year,
          salaryByYear: { [String(state.competition.season.year)]: 5_000_000 },
        }),
      };
      break;
    }
    case "issue_rfa_qualifying_offer":
      action = { kind, playerId, teamId: a };
      break;
    case "match_rfa_offer":
    case "decline_rfa_match": {
      const rfa = withRfa(state, true);
      state = rfa.state;
      action = { kind, playerId: rfa.playerId, teamId: a };
      break;
    }
    case "draft_selection":
      action = {
        kind,
        draftPickId: draftPickIdFor(a, state.competition.season.year + 1, 1),
        teamId: a,
      };
      break;
    case "advance_phase":
      action = {
        kind,
        toPhaseId: PHASE_DEFINITIONS[phaseCase.phase].nextPhaseId ?? "regular",
      };
      break;
    default:
      action = { kind };
  }
  return { state: setActivePhase(state, phaseCase.phase), action };
}

function allowed(kind: LeagueActionKind, phaseCase: PhaseCase): boolean {
  const { state, action } = scenario(kind, phaseCase);
  return canPerformAction(state, action).allowed;
}

/** Independent oracle: phases where each phase-gated action is open. */
const OPEN_PHASES: Partial<Record<LeagueActionKind, readonly string[]>> = {
  trade: [
    "offseason.roster_decisions",
    "offseason.draft_preparation",
    "offseason.draft",
    "offseason.free_agency",
    "offseason.staff_development",
    "preseason.preparation",
    "regular (before deadline)",
  ],
  sign_free_agent: [
    "offseason.free_agency",
    "preseason.preparation",
    "regular (before deadline)",
    "regular (after deadline)",
  ],
  make_free_agent_offer: ["offseason.free_agency"],
  submit_rfa_offer_sheet: ["offseason.free_agency"],
  match_rfa_offer: ["offseason.free_agency"],
  decline_rfa_match: ["offseason.free_agency"],
  issue_rfa_qualifying_offer: ["offseason.roster_decisions"],
  contract_extension: [
    "offseason.roster_decisions",
    "preseason.preparation",
    "regular (before deadline)",
    "regular (after deadline)",
  ],
  draft_selection: ["offseason.draft"],
};
OPEN_PHASES.player_trade = OPEN_PHASES.trade;
OPEN_PHASES.pick_trade = OPEN_PHASES.trade;

describe("league actions across every phase", () => {
  beforeAll(() => {
    base = createOffseasonLeague(SEED, "manual");
  }, 60_000);

  it("covers all 11 league phases", () => {
    expect(LEAGUE_PHASE_IDS).toHaveLength(11);
  });

  describe.each(Object.keys(OPEN_PHASES) as LeagueActionKind[])(
    "%s",
    (kind) => {
      it.each(PHASE_CASES)(
        "is open only where intended: $name",
        (phaseCase) => {
          expect(allowed(kind, phaseCase)).toBe(
            OPEN_PHASES[kind]!.includes(phaseCase.name),
          );
        },
      );
    },
  );

  it("allows player release in every phase except season transition", () => {
    for (const phaseCase of PHASE_CASES) {
      expect(allowed("player_release", phaseCase), phaseCase.name).toBe(
        phaseCase.phase !== "offseason.season_transition",
      );
    }
  });

  it("allows draft selection in offseason.draft only", () => {
    const open = PHASE_CASES.filter((phaseCase) =>
      allowed("draft_selection", phaseCase),
    ).map((phaseCase) => phaseCase.phase);
    expect(open).toEqual(["offseason.draft"]);
  });

  it.each(MATRIX_KINDS)("matrix agrees with the guard for %s", (kind) => {
    const disagreements: string[] = [];
    for (const phaseCase of PHASE_CASES) {
      const segment = resolveTradeWindowSegment(
        phaseCase.phase,
        phaseCase.tradesOpen,
      );
      const verdict = TRANSACTION_LEGALITY_MATRIX[kind][segment];
      if (verdict === "phase_defined") continue;
      const guard = allowed(kind, phaseCase);
      if (guard !== (verdict === "allowed")) {
        disagreements.push(
          `${kind} in ${phaseCase.name}: matrix ${verdict}, guard ${guard ? "allowed" : "blocked"}`,
        );
      }
    }
    expect(disagreements).toEqual([]);
  });

  it("explains every rejection and stays silent on every approval", () => {
    const kinds: LeagueActionKind[] = [
      ...MATRIX_KINDS,
      "make_free_agent_offer",
      "advance_phase",
      "activate_draft",
      "begin_regular_season",
      "begin_playoffs",
    ];
    for (const kind of kinds) {
      for (const phaseCase of PHASE_CASES) {
        const { state, action } = scenario(kind, phaseCase);
        const label = `${kind} in ${phaseCase.name}`;
        const result = canPerformAction(state, action);
        if (result.allowed) {
          expect(result.violations, label).toEqual([]);
          expect(getActionBlockReason(state, action), label).toBeNull();
          expect(() => assertActionAllowed(state, action), label).not.toThrow();
          continue;
        }
        expect(result.violations.length, label).toBeGreaterThan(0);
        for (const violation of result.violations) {
          expect(violation.code.length, label).toBeGreaterThan(0);
          expect(violation.message.trim().length, label).toBeGreaterThan(10);
        }
        const reason = getActionBlockReason(state, action);
        expect(reason, label).toBe(result.violations[0]!.message);
        expect(() => assertActionAllowed(state, action), label).toThrow(
          reason!,
        );
      }
    }
  });

  it("rejects advancing out of an automatic phase", () => {
    for (const phase of [
      "offseason.season_transition",
      "end_of_season.wrap_up",
    ] as const) {
      const { state, action } = scenario("advance_phase", {
        phase,
        tradesOpen: false,
        name: phase,
      });
      const result = canPerformAction(state, action);
      expect(result.allowed).toBe(false);
      expect(result.violations.map((v) => v.code)).toContain("AUTOMATIC_PHASE");
    }
  });
});

// ---------------------------------------------------------------------------
// The engine's own phase graph
// ---------------------------------------------------------------------------

describe("phase definitions", () => {
  it("chain every phase to a defined next phase with no dead end", () => {
    for (const phase of LEAGUE_PHASE_IDS) {
      const next = PHASE_DEFINITIONS[phase].nextPhaseId;
      expect(next, phase).not.toBeNull();
      expect(LEAGUE_PHASE_IDS, phase).toContain(next);
    }
  });

  it("return to the regular season from every phase", () => {
    for (const start of LEAGUE_PHASE_IDS) {
      const seen = new Set<LeaguePhaseId>([start]);
      let current = start;
      while (current !== "regular" || seen.size === 1) {
        const next = PHASE_DEFINITIONS[current].nextPhaseId!;
        if (next === "regular") break;
        expect(seen.has(next), `${start} loops at ${next}`).toBe(false);
        seen.add(next);
        current = next;
      }
    }
  });
});

describe("the full season cycle", () => {
  it("visits the phases in order, each once per season", () => {
    const visited = cycle.map((entry) => entry.from);
    expect(visited).toEqual([
      "preseason.preparation",
      "regular",
      "playoffs",
      "postseason.season_review",
      "offseason.season_transition",
      "offseason.roster_decisions",
      "offseason.draft_preparation",
      "offseason.draft",
      "offseason.free_agency",
      "offseason.staff_development",
      "preseason.preparation",
    ]);
    expect(new Set(visited.slice(0, 10)).size).toBe(10);
    expect(cycle.at(-1)!.to).toBe("regular");
  });

  it("moves each phase to the definition's next phase", () => {
    for (const entry of cycle) {
      expect(entry.to, entry.from).toBe(
        PHASE_DEFINITIONS[entry.from].nextPhaseId,
      );
      expect(getActivePhaseId(entry.after), entry.from).toBe(entry.to);
    }
  });

  it("reports each LeaguePhaseAdvanced event with the real next phase", () => {
    for (const entry of cycle) {
      const advances = entry.events.filter(
        (event) => event.type === "LeaguePhaseAdvanced",
      );
      for (const event of advances) {
        const payload = event.payload as { from: string; to: string };
        if (payload.from === entry.from) {
          expect(payload.to, entry.from).toBe(entry.to);
        }
      }
      const leaving = advances.filter(
        (event) => (event.payload as { from: string }).from === entry.from,
      );
      expect(leaving.length, entry.from).toBeLessThanOrEqual(1);
    }
  });

  it("never gets stuck and keeps the offseason bounded", () => {
    for (const entry of cycle) {
      expect(entry.days, entry.from).toBeLessThan(400);
    }
  });

  it("leaves the league valid after every transition", () => {
    const first = cycle[0]!.before;
    for (const entry of cycle) {
      assertOffseasonInvariants(entry.after, {
        label: `seed ${SEED}, after ${entry.from}`,
        previous: first,
      });
    }
  });
});

// ---------------------------------------------------------------------------
// Refusing to advance
// ---------------------------------------------------------------------------

function expectRefused(
  state: GameState,
  pattern: RegExp,
): ReturnType<typeof previewAdvance> {
  const snapshot = clone(state);
  const preview = previewAdvance(state);
  expect(preview.canAdvance).toBe(false);
  expect(preview.blockReason ?? "").toMatch(pattern);
  expect(() => advanceLeaguePhase(state, createSeededRng(SEED))).toThrow(
    pattern,
  );
  expect(state).toEqual(snapshot);
  return preview;
}

describe("advancing with work outstanding", () => {
  it("refuses to advance out of the automatic season transition", () => {
    const state = step("offseason.season_transition").before;
    expect(getActivePhaseId(state)).toBe("offseason.season_transition");
    expectRefused(state, /runs automatically/);
  });

  it("refuses to leave draft preparation with the class unresolved", () => {
    // The draft class exists once the draft is created; borrow that state.
    const entered = setActivePhase(
      step("offseason.draft").before,
      "offseason.draft_preparation",
    );
    const year = draftYearForSeason(entered.competition.season.year);
    const state: GameState = {
      ...entered,
      user: {
        ...entered.user,
        pendingDraftClassDecisions: {
          ...entered.user.pendingDraftClassDecisions,
          [String(year)]: { draftYear: year, resolved: false },
        },
      },
    };
    const preview = expectRefused(state, /required decision/);
    expect(preview.requiredRemaining).toBeGreaterThanOrEqual(1);
    expect(preview.fromPhaseId).toBe("offseason.draft_preparation");
  });

  it("refuses to leave the draft while the user is on the clock", () => {
    const entered = step("offseason.draft").before;
    const year = draftYearForSeason(entered.competition.season.year);
    const classId = draftClassIdFor(year);
    const draft = entered.world.drafts[classId]!;
    expect(draft.status).toBe("active");
    const userTeam = entered.user.activeOwnerTeamId;
    const slotIndex = draft.order.findIndex(
      (slot) => slot.status === "available",
    );
    const order = draft.order.map((slot, index) =>
      index === slotIndex ? { ...slot, ownerTeamId: userTeam } : slot,
    );
    const state: GameState = {
      ...entered,
      world: {
        ...entered.world,
        drafts: { ...entered.world.drafts, [classId]: { ...draft, order } },
      },
    };
    const preview = previewAdvance(state);
    expect(preview.requiredRemaining).toBeGreaterThanOrEqual(1);
    expectRefused(state, /.+/);
  });

  it("refuses to leave roster decisions with a pending option", () => {
    const entered = step("offseason.roster_decisions").before;
    const year = entered.competition.season.year;
    const userTeam = entered.user.activeOwnerTeamId;
    const playerId = entered.world.teams[userTeam]!.roster[0]!;
    const old =
      entered.business.contracts[entered.world.players[playerId]!.contractId!]!;
    const optioned = createContract({
      id: old.id,
      playerId,
      teamId: userTeam,
      startYear: year - 1,
      endYear: year - 1,
      salaryByYear: { [String(year - 1)]: 2_000_000 },
      teamOption: { year, salary: 2_000_000, status: "pending" },
    });
    const state: GameState = {
      ...entered,
      business: {
        ...entered.business,
        contracts: { ...entered.business.contracts, [old.id]: optioned },
      },
    };
    const preview = expectRefused(state, /required decision/);
    expect(preview.requiredRemaining).toBeGreaterThanOrEqual(1);
  });

  it("refuses to leave the draft before it is complete", () => {
    const state = step("offseason.draft").before;
    const preview = previewAdvance(state);
    expect(preview.canAdvance).toBe(false);
    expect(preview.blockReason).toMatch(/draft/i);
  });
});

// ---------------------------------------------------------------------------
// Entry requirements
// ---------------------------------------------------------------------------

function codesFor(state: GameState, to: LeaguePhaseId): string[] {
  return canEnterPhase(state, to).violations.map((v) => v.code);
}

describe("entering a phase", () => {
  it("opens free agency only after a complete draft and RFA qualification", () => {
    const ready = step("offseason.free_agency").before;
    expect(canEnterPhase(ready, "offseason.free_agency").allowed).toBe(true);

    const noRfa: GameState = {
      ...ready,
      competition: {
        ...ready.competition,
        season: {
          ...ready.competition.season,
          rfaQualificationComplete: false,
        },
      },
    };
    expect(codesFor(noRfa, "offseason.free_agency")).toEqual([
      "RFA_QUALIFICATION_INCOMPLETE",
    ]);

    const drafts = Object.fromEntries(
      Object.entries(ready.world.drafts).map(([id, draft]) => [
        id,
        { ...draft, status: "active" as const },
      ]),
    );
    const openDraft: GameState = {
      ...ready,
      world: { ...ready.world, drafts },
    };
    expect(codesFor(openDraft, "offseason.free_agency")).toEqual([
      "DRAFT_NOT_COMPLETE",
    ]);
    const reason = canEnterPhase(
      openDraft,
      "offseason.free_agency",
    ).blockReason;
    expect(reason).toMatch(/draft is not complete/);
  });

  it("opens the regular season only with rosters of 12 to 15", () => {
    const ready = step("preseason.preparation", 1).before;
    expect(canEnterPhase(ready, "regular").allowed).toBe(true);
    const teamId = Object.keys(ready.world.teams).sort()[0] as TeamId;
    const team = ready.world.teams[teamId]!;
    const withRoster = (size: number): GameState => ({
      ...ready,
      world: {
        ...ready.world,
        teams: {
          ...ready.world.teams,
          [teamId]: {
            ...team,
            roster: Array.from(
              { length: size },
              (_, index) => team.roster[index % team.roster.length]!,
            ),
          },
        },
      },
    });
    for (const size of [12, 15]) {
      expect(
        canEnterPhase(withRoster(size), "regular").allowed,
        `${size}`,
      ).toBe(true);
    }
    for (const size of [11, 16, 0]) {
      const result = canEnterPhase(withRoster(size), "regular");
      expect(result.allowed, `${size}`).toBe(false);
      expect(result.blockReason, `${size}`).toContain(teamId);
    }
    const short = previewAdvance(withRoster(11));
    expect(short.canAdvance).toBe(false);
    expect(short.blockReason).toMatch(/roster/i);
  });

  it("opens the draft only with a finalized order and a class", () => {
    const entered = step("offseason.draft").before;
    expect(canEnterPhase(entered, "offseason.draft").allowed).toBe(true);
    const classId = draftClassIdFor(
      draftYearForSeason(entered.competition.season.year),
    );
    const draft = entered.world.drafts[classId]!;
    const trimmed: GameState = {
      ...entered,
      world: {
        ...entered.world,
        drafts: {
          ...entered.world.drafts,
          [classId]: {
            ...draft,
            status: "not_started",
            order: draft.order.slice(1),
          },
        },
      },
    };
    expect(codesFor(trimmed, "offseason.draft")).toContain(
      "DRAFT_ORDER_NOT_FINALIZED",
    );
    const missing: GameState = {
      ...entered,
      world: { ...entered.world, drafts: {} },
    };
    expect(codesFor(missing, "offseason.draft")).toContain(
      "DRAFT_CLASS_MISSING",
    );
  });
});

// ---------------------------------------------------------------------------
// Season rollover
// ---------------------------------------------------------------------------

describe("season rollover", () => {
  function finishedYear(): number {
    return step("postseason.season_review").before.competition.season.year;
  }

  it("moves to the next season exactly once", () => {
    const review = step("postseason.season_review").before;
    const preseason = step("preseason.preparation", 1).before;
    expect(getActivePhaseId(preseason)).toBe("preseason.preparation");
    expect(preseason.competition.season.year).toBe(finishedYear() + 1);
    for (const entry of cycle) {
      const year = entry.after.competition.season.year;
      const expected =
        entry.from === "offseason.staff_development" ||
        cycle.indexOf(entry) >
          cycle.indexOf(step("offseason.staff_development"))
          ? finishedYear() + 1
          : finishedYear();
      expect(year, `after ${entry.from}`).toBe(expected);
    }
    expect(review.competition.season.year).toBe(finishedYear());
  });

  it("ages every player once across the whole span", () => {
    const review = step("postseason.season_review").before;
    const preseason = step("preseason.preparation", 1).before;
    const afterTransition = step("offseason.season_transition").after;
    let compared = 0;
    for (const player of Object.values(preseason.world.players)) {
      const before = review.world.players[player.id];
      if (before === undefined || before.retired === true) continue;
      const mid = afterTransition.world.players[player.id]!;
      if (player.retired !== true) {
        expect(player.age - before.age, player.id).toBe(1);
        expect(player.age, player.id).toBe(mid.age);
      } else {
        expect(player.age - before.age).toBeLessThanOrEqual(1);
      }
      compared += 1;
    }
    expect(compared).toBeGreaterThan(100);
  });

  it("does not age anyone before the transition runs", () => {
    const review = step("postseason.season_review").before;
    const entered = step("postseason.season_review").after;
    for (const player of Object.values(review.world.players)) {
      expect(entered.world.players[player.id]?.age, player.id).toBe(player.age);
    }
  });

  it("adds one franchise history record per team for the finished year", () => {
    const year = finishedYear();
    const before = step("offseason.staff_development").before;
    const after = step("preseason.preparation", 1).before;
    const review = step("postseason.season_review").before;
    for (const teamId of Object.keys(after.world.teams)) {
      const countFor = (state: GameState) =>
        (state.business.franchiseHistory[teamId]?.seasons ?? []).filter(
          (season) => season.seasonYear === year,
        ).length;
      expect(countFor(review), teamId).toBe(0);
      expect(countFor(before), teamId).toBe(1);
      expect(countFor(after), teamId).toBe(1);
      expect(
        after.business.franchiseHistory[teamId]!.seasons.length -
          (review.business.franchiseHistory[teamId]?.seasons.length ?? 0),
        teamId,
      ).toBe(1);
    }
  });

  it("keeps the finished year's awards and adds none for the new year", () => {
    const year = finishedYear();
    const before = step("offseason.staff_development").before;
    const after = step("preseason.preparation", 1).before;
    const ids = (state: GameState) =>
      Object.keys(state.business.awards.results).sort();
    expect(ids(after)).toEqual(ids(before));
    expect(ids(after).length).toBeGreaterThan(0);
    expect(ids(after).some((id) => id.includes(`:${year + 1}:`))).toBe(false);
    expect(ids(after).filter((id) => id.includes(`:${year}:`)).length).toBe(
      new Set(ids(after)).size -
        ids(after).filter((id) => !id.includes(`:${year}:`)).length,
    );
  });

  it("leaves no expired contract on a roster", () => {
    const after = step("preseason.preparation", 1).before;
    const year = after.competition.season.year;
    for (const team of Object.values(after.world.teams)) {
      for (const playerId of team.roster) {
        const player = after.world.players[playerId]!;
        const contract = after.business.contracts[player.contractId!]!;
        expect(contract.endYear, playerId).toBeGreaterThanOrEqual(year);
      }
    }
  });

  it("resets the schedule, standings and playoffs", () => {
    const after = step("preseason.preparation", 1).before;
    const { competition } = after;
    expect(competition.season.id).toBe(`season_${competition.season.year}`);
    expect(competition.schedule.gameIds).toEqual([]);
    expect(Object.keys(competition.games)).toEqual([]);
    const rows = Object.values(competition.standings.byTeamId);
    expect(rows).toHaveLength(Object.keys(after.world.teams).length);
    for (const row of rows) {
      expect(row.wins + row.losses, row.teamId).toBe(0);
    }
    expect(competition.playoffs.series ?? []).toEqual(
      step("preseason.preparation", 0).before.competition.playoffs.series ?? [],
    );
  });

  it("regenerates draft picks for the new horizon", () => {
    const before = step("offseason.staff_development").before;
    const after = step("preseason.preparation", 1).before;
    const maxYear = (state: GameState) =>
      Math.max(
        ...Object.values(state.world.draftPicks).map((pick) => pick.seasonYear),
      );
    expect(maxYear(after)).toBe(maxYear(before) + 1);
    const teamCount = Object.keys(after.world.teams).length;
    const horizonPicks = Object.values(after.world.draftPicks).filter(
      (pick) => pick.seasonYear === maxYear(after),
    );
    expect(horizonPicks.length).toBe(teamCount * 2);
    expect(
      new Set(Object.values(after.world.draftPicks).map((pick) => pick.id))
        .size,
    ).toBe(Object.keys(after.world.draftPicks).length);
  });

  it("does not double-run development when staff development exits directly", () => {
    const entry = step("offseason.staff_development");
    const rng = createSeededRng(entry.before.meta.rngState);
    const direct = processPhaseExit(
      entry.before,
      "offseason.staff_development",
      rng,
    ).state;
    for (const player of Object.values(entry.before.world.players)) {
      expect(direct.world.players[player.id]?.age, player.id).toBe(player.age);
    }
    expect(direct.competition.season.year).toBe(
      entry.before.competition.season.year + 1,
    );
  });

  it("develops players once when the transition exit hook runs directly", () => {
    const entry = step("offseason.season_transition");
    const before = entry.before;
    const exited = processPhaseExit(
      before,
      "offseason.season_transition",
      createSeededRng(before.meta.rngState),
    ).state;
    for (const player of Object.values(before.world.players)) {
      const aged = exited.world.players[player.id]!;
      if (aged.retired === true || player.retired === true) continue;
      expect(aged.age - player.age, player.id).toBe(1);
    }
  });

  it("does not develop twice when the daily lifecycle follows the exit hook", () => {
    // processPhaseExit leaves the phase pointer on season_transition, so the
    // next simulated day runs the automatic transition again. The second run
    // must not age, develop or settle the economy a second time.
    const before = step("offseason.season_transition").before;
    const rng = createSeededRng(before.meta.rngState);
    const exited = processPhaseExit(
      before,
      "offseason.season_transition",
      rng,
    ).state;
    const next = advanceSimulation(exited, rng, {
      days: 1,
      gameFidelity: "box_score",
    }).state;
    for (const player of Object.values(before.world.players)) {
      const aged = next.world.players[player.id]!;
      if (aged.retired === true || player.retired === true) continue;
      expect(aged.age - player.age, player.id).toBe(1);
    }
  });

  it("is deterministic across identical replays of the transition", () => {
    const before = step("offseason.season_transition").before;
    // generatedAt on franchise reports is wall-clock (see report notes).
    const run = () =>
      JSON.stringify(
        stateForComparison(
          advanceThroughPhase(clone(before), "offseason.season_transition")
            .state,
        ),
        (key, value) => (key === "generatedAt" ? undefined : value),
      );
    expect(run()).toEqual(run());
  });
});
