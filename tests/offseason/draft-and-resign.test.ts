/**
 * Offseason: the draft and the re-sign / extension windows, run against real
 * fixture saves. Complements tests/systems/draft/* (engine units) and
 * tests/systems/contract-extensions*.test.ts (negotiation maths).
 */

import { beforeAll, describe, expect, it } from "vitest";
import { getContractSalaryForYear } from "@/domain/entities/contract";
import { draftClassIdFor, type DraftClass } from "@/domain/entities/draft";
import type { PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import { generateDraftOrder, validateDraftSelection } from "@/systems/draft";
import { drawLottery, runDraftLottery } from "@/systems/draft/draft-lottery";
import { DRAFT_ROOKIE_CONTRACT_YEARS } from "@/systems/draft-config";
import {
  EXTENSION_MAX_YEARS,
  getExtensionBlockReason,
  offerContractExtension,
  playerExtensionAsk,
} from "@/systems/contract-extensions";
import { listFreeAgents } from "@/systems/free-agency";
import { canPerformAction } from "@/systems/league-rules/action-guards";
import { getLeagueSalaryCap } from "@/systems/league-salary-cap";
import { getActivePhaseId, type LeaguePhaseId } from "@/systems/phase-engine";
import {
  salaryForPlayer,
  SUPERMAX_CAP_FRACTION,
  vetMinSalary,
} from "@/systems/salary-scale";
import { createSeededRng } from "@/domain/rng";
import { TEST_RNG_SEED } from "../helpers/determinism";
import {
  advanceThroughPhase,
  buildOffseasonFixture,
  offseasonFixtureSettings,
  OffseasonPhaseStuckError,
  type PhaseAdvanceResult,
} from "./driver";
import { assertOffseasonInvariants } from "./invariants";
import { stateForComparison } from "./snapshot";

const SEED = TEST_RNG_SEED;
const ROUNDS = 2;

function draftOf(state: GameState): DraftClass {
  const draft =
    state.world.drafts[draftClassIdFor(state.competition.season.year + 1)];
  if (draft === undefined) throw new Error("No draft class for next year.");
  return draft;
}

/** Same save with the user franchise on the manual (no draft assist) policy. */
function asManual(state: GameState): GameState {
  const { ai } = offseasonFixtureSettings("manual");
  const teamId = state.user.activeOwnerTeamId;
  return {
    ...state,
    settings: { ...state.settings, ai },
    user: {
      ...state.user,
      ownedFranchises: {
        ...state.user.ownedFranchises,
        [teamId]: {
          ...state.user.ownedFranchises[teamId]!,
          aiAssistance: { ...ai.assistance },
          managementPreset: ai.managementPreset,
        },
      },
    },
  };
}

function inPhase(state: GameState, phaseId: LeaguePhaseId): GameState {
  return {
    ...state,
    competition: {
      ...state.competition,
      phase: { ...state.competition.phase!, activePhaseId: phaseId },
    },
  };
}

function winsOf(state: GameState, teamId: TeamId): number {
  return state.competition.standings.byTeamId[teamId]?.wins ?? 0;
}

function worstFirst(state: GameState, teamIds: TeamId[]): TeamId[] {
  return [...teamIds].sort(
    (a, b) =>
      winsOf(state, a) - winsOf(state, b) || (a < b ? -1 : a > b ? 1 : 0),
  );
}

describe("draft order", () => {
  let start: GameState;
  let draft: DraftClass;
  let teamIds: TeamId[];

  beforeAll(() => {
    start = buildOffseasonFixture({
      seed: SEED,
      phase: "offseason.draft",
    }).state;
    draft = draftOf(start);
    teamIds = Object.keys(start.world.teams) as TeamId[];
  });

  it("opens an active two-round order of one slot per team and round", () => {
    expect(draft.status).toBe("active");
    expect(draft.order).toHaveLength(teamIds.length * ROUNDS);
    expect(draft.order.map((slot) => slot.overallPick)).toEqual(
      draft.order.map((_, index) => index + 1),
    );
    for (const round of [1, 2]) {
      const picks = draft.order.filter((slot) => slot.round === round);
      expect(picks).toHaveLength(teamIds.length);
      const originals = picks.map(
        (slot) => start.world.draftPicks[slot.draftPickId]!.originalTeamId,
      );
      expect([...originals].sort()).toEqual([...teamIds].sort());
    }
    expect(
      draft.order.slice(0, teamIds.length).every((slot) => slot.round === 1),
    ).toBe(true);
    // With draft assist the engine has already made the picks ahead of the
    // user's first slot, and no others.
    const used = draft.order.filter((slot) => slot.status === "used");
    expect(
      draft.order.slice(0, used.length).every((s) => s.status === "used"),
    ).toBe(true);
    expect(draft.selections).toHaveLength(used.length);
  });

  it("generates at least one prospect per pick; only drafted ones are players", () => {
    const prospects = Object.values(draft.prospects);
    expect(prospects.length).toBeGreaterThanOrEqual(draft.order.length);
    // Only drafted prospects have become players.
    for (const prospect of prospects) {
      expect(start.world.players[prospect.playerId] !== undefined).toBe(
        prospect.status === "selected",
      );
    }
  });

  it("is on in a new league and draws the first round from the lottery", () => {
    expect(start.settings.draftLottery.enabled).toBe(true);
    const lottery = draft.lottery;
    expect(lottery).toBeTruthy();
    const { preLotteryOrder, finalOrder, picksDrawn } = lottery!;
    expect(finalOrder).toHaveLength(preLotteryOrder.length);
    expect([...finalOrder].sort()).toEqual([...preLotteryOrder].sort());
    // Lottery teams are ranked worst record first before the draw, and the
    // picks beyond the drawn ones keep that order.
    expect(preLotteryOrder).toEqual(worstFirst(start, preLotteryOrder));
    expect(finalOrder.slice(picksDrawn)).toEqual(
      preLotteryOrder.filter(
        (id) => !finalOrder.slice(0, picksDrawn).includes(id),
      ),
    );
    expect(lottery!.odds.reduce((sum, odds) => sum + odds, 0)).toBeCloseTo(1);

    const firstRound = draft.order.filter((slot) => slot.round === 1);
    const originalOf = (pickId: string) =>
      start.world.draftPicks[pickId as never]!.originalTeamId;
    // Lottery teams first in the drawn order, then the playoff teams by
    // record (worst first).
    expect(
      firstRound
        .slice(0, finalOrder.length)
        .map((s) => originalOf(s.draftPickId)),
    ).toEqual(finalOrder);
    const rest = firstRound
      .slice(finalOrder.length)
      .map((s) => originalOf(s.draftPickId));
    expect(rest).toEqual(worstFirst(start, rest));
    // Round two ignores the lottery: reverse standings.
    const secondRound = draft.order
      .filter((slot) => slot.round === 2)
      .map((s) => originalOf(s.draftPickId));
    expect(secondRound).toEqual(worstFirst(start, secondRound));
  });

  it("is re-derivable: the stored lottery is the seeded draw for that year", () => {
    const again = runDraftLottery(start, draft.seasonYear);
    // The draw happened earlier in the offseason, so only the order is
    // compared (date and standings can differ by then).
    expect(again?.finalOrder).toEqual(draft.lottery!.finalOrder);
  });

  it("uses plain reverse standings when the lottery is off", () => {
    const off: GameState = {
      ...start,
      settings: {
        ...start.settings,
        draftLottery: { ...start.settings.draftLottery, enabled: false },
      },
    };
    expect(runDraftLottery(off, draft.seasonYear)).toBeNull();
    const order = generateDraftOrder(off, draft.seasonYear, null);
    expect(order).toHaveLength(teamIds.length * ROUNDS);
    for (const round of [1, 2]) {
      const originals = order
        .filter((slot) => slot.round === round)
        .map((s) => off.world.draftPicks[s.draftPickId]!.originalTeamId);
      expect(originals).toEqual(worstFirst(off, teamIds));
    }
  });

  it("applies the lottery order when given one, and only to round one", () => {
    const worst = worstFirst(start, teamIds);
    const lotteryOrder = [...worst].reverse();
    const order = generateDraftOrder(start, draft.seasonYear, lotteryOrder);
    const originals = (round: number) =>
      order
        .filter((slot) => slot.round === round)
        .map((s) => start.world.draftPicks[s.draftPickId]!.originalTeamId);
    expect(originals(1)).toEqual(lotteryOrder);
    expect(originals(2)).toEqual(worst);
  });

  it("is deterministic for a seed", () => {
    const rng = () => createSeededRng(SEED);
    const odds = draft.lottery!.odds;
    const teams = draft.lottery!.preLotteryOrder;
    const picks = draft.lottery!.picksDrawn;
    expect(drawLottery(teams, odds, picks, rng())).toEqual(
      drawLottery(teams, odds, picks, rng()),
    );
  });

  it("gives each slot to the current owner of its pick, including traded ones", () => {
    for (const slot of draft.order) {
      expect(slot.ownerTeamId).toBe(
        start.world.draftPicks[slot.draftPickId]!.ownerTeamId,
      );
    }
    const [first, second] = [draft.order[0]!, draft.order[1]!];
    const traded: GameState = {
      ...start,
      world: {
        ...start.world,
        draftPicks: {
          ...start.world.draftPicks,
          [first.draftPickId]: {
            ...start.world.draftPicks[first.draftPickId]!,
            ownerTeamId: second.ownerTeamId,
          },
        },
      },
    };
    const order = generateDraftOrder(
      traded,
      draft.seasonYear,
      draft.lottery?.finalOrder ?? null,
    );
    expect(order[0]!.draftPickId).toBe(first.draftPickId);
    expect(order[0]!.ownerTeamId).toBe(second.ownerTeamId);
    // Trading a pick moves the right to pick, not the position.
    expect(order.map((slot) => slot.draftPickId)).toEqual(
      draft.order.map((slot) => slot.draftPickId),
    );
  });
});

describe("selection validation", () => {
  let start: GameState;
  let draft: DraftClass;

  beforeAll(() => {
    start = buildOffseasonFixture({
      seed: SEED,
      phase: "offseason.draft",
    }).state;
    draft = draftOf(start);
  });

  const input = (
    slotIndex: number,
    overrides: Partial<Parameters<typeof validateDraftSelection>[1]> = {},
  ) => {
    const slot = draft.order.filter((entry) => entry.status === "available")[
      slotIndex
    ]!;
    const prospect = Object.values(draft.prospects).find(
      (candidate) => candidate.status === "eligible",
    )!;
    return {
      draftClassId: draft.id,
      draftPickId: slot.draftPickId,
      prospectPlayerId: prospect.playerId,
      teamId: slot.ownerTeamId,
      ...overrides,
    };
  };

  it("accepts an available pick for its owner and an eligible prospect", () => {
    expect(validateDraftSelection(start, input(0)).valid).toBe(true);
  });

  it("rejects a team that does not own the pick", () => {
    const other = draft.order.find(
      (slot) => slot.ownerTeamId !== input(0).teamId,
    )!;
    const result = validateDraftSelection(
      start,
      input(0, { teamId: other.ownerTeamId }),
    );
    expect(result.errors.map((e) => e.code)).toContain("TEAM_OWNERSHIP");
  });

  it("rejects an unknown prospect and an unknown pick", () => {
    const unknown = validateDraftSelection(
      start,
      input(0, { prospectPlayerId: "player_nobody" as PlayerId }),
    );
    expect(unknown.errors.map((e) => e.code)).toContain("PROSPECT_NOT_FOUND");
    const noPick = validateDraftSelection(
      start,
      input(0, { draftPickId: "pick_nobody" as never }),
    );
    expect(noPick.errors.map((e) => e.code)).toContain("PICK_NOT_FOUND");
  });
});

describe("running the draft", () => {
  let start: GameState;
  let delegated: PhaseAdvanceResult;
  let manual: PhaseAdvanceResult;
  let manualStart: GameState;
  let userId: TeamId;

  beforeAll(() => {
    // The fixture is parked as the draft opens; with draft assist the first
    // picks (up to the user's) are already made. The manual run starts from
    // draft preparation so it makes its own picks from pick one.
    start = buildOffseasonFixture({
      seed: SEED,
      phase: "offseason.draft",
    }).state;
    userId = start.user.activeOwnerTeamId;
    delegated = advanceThroughPhase(start, "offseason.draft");
    const preparation = buildOffseasonFixture({
      seed: SEED,
      phase: "offseason.draft_preparation",
    }).state;
    manualStart = advanceThroughPhase(
      asManual(preparation),
      "offseason.draft_preparation",
    ).state;
    manual = advanceThroughPhase(manualStart, "offseason.draft");
  });

  const runs = () =>
    [
      ["delegated (engine draft assist)", () => ({ ...delegated, start })],
      ["manual (user pick path)", () => ({ ...manual, start: manualStart })],
    ] as const;

  describe.each(runs())("%s", (_label, get) => {
    it("moves on to free agency in a legal state", () => {
      const result = get();
      expect(result.toPhaseId).toBe("offseason.free_agency");
      assertOffseasonInvariants(result.state, { label: `draft ${_label}` });
    });

    it("makes every pick exactly once and completes the class", () => {
      const { state, start } = get();
      const draft = draftOf(state);
      const before = draftOf(start);
      expect(draft.status).toBe("complete");
      expect(draft.order.every((slot) => slot.status === "used")).toBe(true);
      expect(draft.selections).toHaveLength(before.order.length);
      expect(draft.pickResults).toHaveLength(before.order.length);
      const pickIds = draft.selections.map((s) => s.draftPickId);
      expect(new Set(pickIds).size).toBe(pickIds.length);
      expect([...pickIds].sort()).toEqual(
        before.order.map((slot) => slot.draftPickId).sort(),
      );
      // Order and ownership are not rewritten by the draft itself.
      expect(draft.order.map((s) => [s.draftPickId, s.ownerTeamId])).toEqual(
        before.order.map((s) => [s.draftPickId, s.ownerTeamId]),
      );
      for (const slot of draft.order) {
        expect(state.world.draftPicks[slot.draftPickId]!.status).toBe("used");
      }
      expect(draft.teamGrades).toBeDefined();
    });

    it("turns each slot into exactly one new player on the owner's side", () => {
      const { state, start } = get();
      const draft = draftOf(state);
      const selected = draft.order.map((slot) => slot.selectedPlayerId!);
      expect(new Set(selected).size).toBe(selected.length);
      const before = draftOf(start);
      const picksMade = draft.order
        .filter((_, index) => before.order[index]!.status === "available")
        .map((slot) => slot.selectedPlayerId!);
      const newPlayers = Object.keys(state.world.players).filter(
        (id) => start.world.players[id] === undefined,
      );
      expect([...newPlayers].sort()).toEqual([...picksMade].sort());
      expect(selected).toHaveLength(before.order.length);
      for (const selection of draft.selections) {
        const slot = draft.order.find(
          (entry) => entry.draftPickId === selection.draftPickId,
        )!;
        expect(selection.teamId).toBe(slot.ownerTeamId);
        expect(selection.overallPick).toBe(slot.overallPick);
        expect(slot.selectedPlayerId).toBe(selection.playerId);
        expect(draft.prospects[selection.playerId]!.status).toBe("selected");
        const player = state.world.players[selection.playerId]!;
        expect(player.teamId).not.toBeNull();
        expect(state.world.teams[player.teamId!]!.roster).toContain(player.id);
      }
    });

    it("gives the user one player per pick it owns", () => {
      const { state, start } = get();
      const ownedSlots = draftOf(start).order.filter(
        (slot) => slot.ownerTeamId === userId,
      );
      expect(ownedSlots.length).toBeGreaterThan(0);
      const draft = draftOf(state);
      const userPicks = draft.selections.filter((s) => s.teamId === userId);
      expect(userPicks).toHaveLength(ownedSlots.length);
      expect(userPicks.map((s) => s.draftPickId).sort()).toEqual(
        ownedSlots.map((slot) => slot.draftPickId).sort(),
      );
    });

    it("signs each draftee to a valid rookie contract", () => {
      const { state } = get();
      const draft = draftOf(state);
      const year = state.competition.season.year;
      const cap = getLeagueSalaryCap(state);
      const min = vetMinSalary(cap);
      const max = Math.round((cap * SUPERMAX_CAP_FRACTION) / 1_000) * 1_000;
      for (const selection of draft.selections) {
        const player = state.world.players[selection.playerId]!;
        const contract = state.business.contracts[player.contractId!]!;
        expect(contract.playerId).toBe(player.id);
        expect(contract.teamId).toBe(selection.teamId);
        // The draft is an offseason event: the deal starts next season.
        expect(contract.startYear).toBe(year + 1);
        expect(contract.endYear).toBe(year + DRAFT_ROOKIE_CONTRACT_YEARS);
        const salaries = Object.values(contract.salaryByYear);
        expect(salaries).toHaveLength(DRAFT_ROOKIE_CONTRACT_YEARS);
        const expected = salaryForPlayer({
          overall: calculatePlayerOverall(player.position, player.attributes),
          age: player.age,
          years: 0,
          cap,
          kind: "rookie",
        });
        expect(salaries.every((salary) => salary === expected)).toBe(true);
        expect(expected).toBeGreaterThanOrEqual(min);
        expect(expected).toBeLessThanOrEqual(max);
        expect(getContractSalaryForYear(contract, year + 1)).toBe(expected);
      }
    });

    it("keeps first-round rookie money at or above second-round money on average", () => {
      const { state } = get();
      const average = (round: number) => {
        const picks = draftOf(state).selections.filter(
          (s) => s.round === round,
        );
        const total = picks.reduce(
          (sum, s) =>
            sum +
            getContractSalaryForYear(
              state.business.contracts[
                state.world.players[s.playerId]!.contractId!
              ]!,
              state.competition.season.year + 1,
            )!,
          0,
        );
        return total / picks.length;
      };
      expect(average(1)).toBeGreaterThanOrEqual(average(2));
    });

    it("leaves undrafted prospects out of the league", () => {
      const { state } = get();
      const draft = draftOf(state);
      const undrafted = Object.values(draft.prospects).filter(
        (prospect) => prospect.status === "eligible",
      );
      expect(undrafted.length).toBeGreaterThan(0);
      const pool = new Set(listFreeAgents(state).playerIds);
      const rostered = new Set(
        Object.values(state.world.teams).flatMap((team) => team.roster),
      );
      for (const prospect of undrafted) {
        // The engine keeps them in the class only: no player record, no
        // roster spot and no free-agent listing.
        expect(state.world.players[prospect.playerId]).toBeUndefined();
        expect(rostered.has(prospect.playerId)).toBe(false);
        expect(pool.has(prospect.playerId)).toBe(false);
      }
    });
  });

  it("makes both paths pick the same number of players", () => {
    expect(draftOf(delegated.state).selections).toHaveLength(
      draftOf(manual.state).selections.length,
    );
  });

  it("stops for the user only without draft assist", () => {
    const delegatedNoClicks = advanceThroughPhase(start, "offseason.draft", {
      autoUser: false,
    });
    expect(delegatedNoClicks.toPhaseId).toBe("offseason.free_agency");
    expect(() =>
      advanceThroughPhase(manualStart, "offseason.draft", {
        autoUser: false,
        maxDays: 5,
      }),
    ).toThrow(OffseasonPhaseStuckError);
  });

  it("is deterministic", () => {
    const again = advanceThroughPhase(start, "offseason.draft");
    expect(stateForComparison(again.state)).toEqual(
      stateForComparison(delegated.state),
    );
  });

  it("rejects a pick once the draft is complete", () => {
    const draft = draftOf(delegated.state);
    const slot = draft.order[0]!;
    const result = validateDraftSelection(delegated.state, {
      draftClassId: draft.id,
      draftPickId: slot.draftPickId,
      prospectPlayerId: Object.values(draft.prospects).find(
        (p) => p.status === "eligible",
      )!.playerId,
      teamId: slot.ownerTeamId,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.code)).toEqual(
      expect.arrayContaining(["DRAFT_NOT_ACTIVE", "PICK_USED"]),
    );
  });
});

describe("league rules by phase", () => {
  const PHASES: readonly LeaguePhaseId[] = [
    "postseason.season_review",
    "offseason.season_transition",
    "offseason.roster_decisions",
    "offseason.draft_preparation",
    "offseason.draft",
    "offseason.free_agency",
    "offseason.staff_development",
    "preseason.preparation",
    "regular",
    "playoffs",
    "end_of_season.wrap_up",
  ];
  const EXTENSION_PHASES: readonly LeaguePhaseId[] = [
    "offseason.roster_decisions",
    "preseason.preparation",
    "regular",
  ];

  let base: GameState;
  let teamId: TeamId;
  let playerId: PlayerId;

  beforeAll(() => {
    base = buildOffseasonFixture({
      seed: SEED,
      phase: "offseason.roster_decisions",
    }).state;
    teamId = base.user.activeOwnerTeamId;
    playerId = base.world.teams[teamId]!.roster[0]!;
  });

  it.each(PHASES)("contract_extension in %s", (phaseId) => {
    const state = inPhase(base, phaseId);
    const result = canPerformAction(state, {
      kind: "contract_extension",
      playerId,
      teamId,
    });
    const open = EXTENSION_PHASES.includes(phaseId);
    expect(result.allowed).toBe(open);
    if (!open) {
      expect(result.violations.map((v) => v.code)).toContain(
        "EXTENSION_WINDOW_CLOSED",
      );
      expect(result.violations[0]!.message).toMatch(/extension/i);
    }
  });

  it.each(PHASES)("draft_selection in %s", (phaseId) => {
    const state = inPhase(base, phaseId);
    const result = canPerformAction(state, {
      kind: "draft_selection",
      draftPickId: Object.keys(base.world.draftPicks)[0] as never,
      teamId,
    });
    expect(result.allowed).toBe(phaseId === "offseason.draft");
    if (phaseId !== "offseason.draft") {
      expect(result.violations.map((v) => v.code)).toContain(
        "DRAFT_WRONG_PHASE",
      );
    }
  });

  it("blocks extensions for a retired player in an open window", () => {
    const retired: GameState = {
      ...base,
      world: {
        ...base.world,
        players: {
          ...base.world.players,
          [playerId]: { ...base.world.players[playerId]!, retired: true },
        },
      },
    };
    expect(
      canPerformAction(retired, {
        kind: "contract_extension",
        playerId,
        teamId,
      }).allowed,
    ).toBe(false);
  });
});

describe("re-signing and extensions", () => {
  let rosterDecisions: GameState;
  let teamId: TeamId;
  let candidate: PlayerId;
  let terms: { years: number; salary: number };

  beforeAll(() => {
    rosterDecisions = buildOffseasonFixture({
      seed: SEED,
      phase: "offseason.roster_decisions",
    }).state;
    teamId = rosterDecisions.user.activeOwnerTeamId;
    const year = rosterDecisions.competition.season.year;
    const eligible = rosterDecisions.world.teams[teamId]!.roster.map(
      (id) => rosterDecisions.world.players[id]!,
    )
      .map((player) => ({
        player,
        contract: rosterDecisions.business.contracts[player.contractId!]!,
      }))
      // Expiring deals first: the re-sign case.
      .sort(
        (a, b) =>
          a.contract.endYear - b.contract.endYear ||
          (a.player.id < b.player.id ? -1 : 1),
      );
    for (const { player, contract } of eligible) {
      if (contract.endYear > year + 1) continue;
      const ask = playerExtensionAsk(rosterDecisions, player.id, teamId);
      const attempt = { years: ask.minYears, salary: ask.salary };
      if (
        getExtensionBlockReason(rosterDecisions, {
          playerId: player.id,
          teamId,
          terms: attempt,
        }) === null
      ) {
        candidate = player.id;
        terms = attempt;
        return;
      }
    }
    throw new Error("No extendable player on the user team.");
  });

  it("accepts a legal extension in roster decisions", () => {
    expect(
      getExtensionBlockReason(rosterDecisions, {
        playerId: candidate,
        teamId,
        terms,
      }),
    ).toBeNull();
    const before =
      rosterDecisions.business.contracts[
        rosterDecisions.world.players[candidate]!.contractId!
      ]!;
    const { result, response } = offerContractExtension(rosterDecisions, {
      playerId: candidate,
      teamId,
      terms,
    });
    expect(response.kind).toBe("accept");
    const player = result.state.world.players[candidate]!;
    const after = result.state.business.contracts[player.contractId!]!;
    expect(after.id).toBe(before.id);
    expect(after.teamId).toBe(teamId);
    expect(after.endYear).toBeGreaterThan(before.endYear);
    expect(after.endYear).toBe(
      Math.max(
        before.endYear + 1,
        rosterDecisions.competition.season.year + 1,
      ) +
        terms.years -
        1,
    );
    expect(
      getContractSalaryForYear(
        after,
        rosterDecisions.competition.season.year + 1,
      ),
    ).toBe(terms.salary);
    expect(
      result.events.some(
        (event) =>
          event.type === "ContractSigned" &&
          (event.payload as { reason?: string }).reason === "extension",
      ),
    ).toBe(true);
    assertOffseasonInvariants(result.state, { label: "after extension" });
  });

  it("keeps an extended player through the offseason instead of releasing him", () => {
    const { result } = offerContractExtension(rosterDecisions, {
      playerId: candidate,
      teamId,
      terms,
    });
    const year = rosterDecisions.competition.season.year;
    const extendedEnd =
      result.state.business.contracts[
        result.state.world.players[candidate]!.contractId!
      ]!.endYear;
    let state = result.state;
    for (const phase of [
      "offseason.roster_decisions",
      "offseason.draft_preparation",
      "offseason.draft",
    ] as const) {
      state = advanceThroughPhase(state, phase).state;
    }
    expect(getActivePhaseId(state)).toBe("offseason.free_agency");
    const player = state.world.players[candidate]!;
    expect(player.teamId).toBe(teamId);
    expect(state.world.teams[teamId]!.roster).toContain(candidate);
    expect(listFreeAgents(state).playerIds).not.toContain(candidate);
    const contract = state.business.contracts[player.contractId!]!;
    expect(contract.endYear).toBe(extendedEnd);
    expect(getContractSalaryForYear(contract, year + 1)).toBe(terms.salary);
    assertOffseasonInvariants(state, { label: "extended player in FA" });
  });

  it("rejects salaries below the minimum and above the maximum", () => {
    const cap = getLeagueSalaryCap(rosterDecisions);
    const min = vetMinSalary(cap);
    const max = Math.round((cap * SUPERMAX_CAP_FRACTION) / 1_000) * 1_000;
    const reason = (salary: number) =>
      getExtensionBlockReason(rosterDecisions, {
        playerId: candidate,
        teamId,
        terms: { years: terms.years, salary },
      });
    expect(reason(min - 1_000)).toMatch(/below the league minimum/i);
    expect(reason(0)).toMatch(/below the league minimum/i);
    expect(reason(max + 1_000)).toMatch(/above the league maximum/i);
    expect(reason(terms.salary + 0.5)).toMatch(/below the league minimum/i);
    expect(() =>
      offerContractExtension(rosterDecisions, {
        playerId: candidate,
        teamId,
        terms: { years: terms.years, salary: min - 1_000 },
      }),
    ).toThrow(/below the league minimum/i);
    expect(() =>
      offerContractExtension(rosterDecisions, {
        playerId: candidate,
        teamId,
        terms: { years: terms.years, salary: max + 1_000 },
      }),
    ).toThrow(/above the league maximum/i);
  });

  it("rejects lengths outside 1 to the maximum", () => {
    for (const years of [0, -1, EXTENSION_MAX_YEARS + 1, 1.5]) {
      expect(
        getExtensionBlockReason(rosterDecisions, {
          playerId: candidate,
          teamId,
          terms: { years, salary: terms.salary },
        }),
      ).toMatch(/Extensions run 1 to/);
    }
  });

  it("rejects an offer for a player on another team", () => {
    const other = Object.values(rosterDecisions.world.teams).find(
      (team) => team.id !== teamId,
    )!;
    expect(
      getExtensionBlockReason(rosterDecisions, {
        playerId: candidate,
        teamId: other.id,
        terms,
      }),
    ).toBe("Player is not on this team.");
  });

  it("does not change the save when an offer is rejected", () => {
    const before = structuredClone(rosterDecisions);
    expect(() =>
      offerContractExtension(rosterDecisions, {
        playerId: candidate,
        teamId,
        terms: { years: 0, salary: terms.salary },
      }),
    ).toThrow();
    expect(rosterDecisions).toEqual(before);
  });

  describe.each([
    "offseason.draft_preparation",
    "offseason.draft",
    "offseason.free_agency",
  ] as const)("in %s", (phase) => {
    let state: GameState;
    let player: PlayerId;

    beforeAll(() => {
      state = buildOffseasonFixture({ seed: SEED, phase }).state;
      player = state.world.teams[state.user.activeOwnerTeamId]!.roster[0]!;
    });

    it("rejects an extension with a clear message", () => {
      const input = {
        playerId: player,
        teamId: state.user.activeOwnerTeamId,
        terms: { years: 2, salary: terms.salary },
      };
      expect(getExtensionBlockReason(state, input)).toMatch(
        /open in the preseason, the regular season and roster decisions/i,
      );
      expect(() => offerContractExtension(state, input)).toThrow(
        /roster decisions/i,
      );
      const check = canPerformAction(state, {
        kind: "contract_extension",
        playerId: player,
        teamId: input.teamId,
      });
      expect(check.allowed).toBe(false);
    });
  });
});
