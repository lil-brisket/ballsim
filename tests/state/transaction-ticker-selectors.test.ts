import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { createDomainEvent } from "@/domain/events";
import type { DomainEvent } from "@/domain/events";
import { bootstrapWorld } from "@/systems/world-pipeline";
import type { GameState } from "@/state/game-state";
import { toTransactionTickerView } from "@/state/transaction-ticker-selectors";
import { createTestGameState } from "../factories/game-state";

const base = bootstrapWorld(
  createTestGameState({ saveId: "ticker" }),
  createSeededRng("ticker"),
).state;
const myTeamId = base.user.activeOwnerTeamId as string;
const teamIds = Object.keys(base.world.teams);
const otherA = teamIds.find((id) => id !== myTeamId)!;
const otherB = teamIds.find((id) => id !== myTeamId && id !== otherA)!;
const rosterA = base.world.teams[otherA]!.roster.map(String);
const rosterB = base.world.teams[otherB]!.roster.map(String);
const mine = base.world.teams[myTeamId]!.roster.map(String);

const DEADLINE = "2027-02-10";
const FA_START = "2027-07-01";

function trade(date: string, playerId: string, from: string, to: string) {
  return createDomainEvent({
    type: "PlayerTraded",
    occurredOn: date,
    payload: { playerId, fromTeamId: from, toTeamId: to },
  });
}

function signing(
  date: string,
  playerId: string,
  teamId: string,
  extra: Record<string, unknown> = {},
  type:
    | "FreeAgentSigned"
    | "ContractSigned"
    | "RfaOfferSheetSigned" = "FreeAgentSigned",
) {
  return createDomainEvent({
    type,
    occurredOn: date,
    payload: { playerId, teamId, ...extra },
  });
}

function stateWith(
  events: DomainEvent[],
  input: {
    currentDate: string;
    deadline?: string | null;
    freeAgency?: boolean;
  },
): GameState {
  return {
    ...base,
    world: {
      ...base.world,
      calendar: { ...base.world.calendar, currentDate: input.currentDate },
    },
    competition: {
      ...base.competition,
      season: {
        ...base.competition.season,
        tradeDeadlineDate: input.deadline ?? null,
      },
      phase: input.freeAgency
        ? {
            activePhaseId: "offseason.free_agency",
            enteredDate: FA_START,
          }
        : base.competition.phase,
      seasonEventLog: events,
    },
  };
}

describe("toTransactionTickerView", () => {
  it("shows only deadline-day moves, with an empty view before any happen", () => {
    const events = [
      trade("2027-02-09", rosterA[0]!, otherA, otherB),
      trade(DEADLINE, rosterB[0]!, otherB, otherA),
    ];
    const today = toTransactionTickerView(
      stateWith([], { currentDate: DEADLINE, deadline: DEADLINE }),
    );
    expect(today).toMatchObject({
      window: "deadline",
      title: "Trade deadline",
      status: "Today",
      items: [],
      summary: null,
    });
    const after = toTransactionTickerView(
      stateWith(events, { currentDate: "2027-02-11", deadline: DEADLINE }),
    )!;
    expect(after.items).toHaveLength(1);
    expect(after.items[0]!.occurredOn).toBe(DEADLINE);
  });

  it("is absent outside the deadline and free agency windows", () => {
    const events = [trade(DEADLINE, rosterA[0]!, otherA, otherB)];
    for (const currentDate of ["2027-02-09", "2027-02-12", "2027-03-01"]) {
      expect(
        toTransactionTickerView(
          stateWith(events, { currentDate, deadline: DEADLINE }),
        ),
      ).toBeNull();
    }
    expect(
      toTransactionTickerView(stateWith(events, { currentDate: DEADLINE })),
    ).toBeNull();
  });

  it("groups a two-sided trade into one item and summarises the deadline", () => {
    const events = [
      trade(DEADLINE, rosterA[0]!, otherA, otherB),
      trade(DEADLINE, rosterB[0]!, otherB, otherA),
      trade(DEADLINE, rosterA[1]!, myTeamId, otherB),
    ];
    const view = toTransactionTickerView(
      stateWith(events, { currentDate: "2027-02-11", deadline: DEADLINE }),
    )!;
    expect(view.items).toHaveLength(2);
    expect(view.items.every((item) => item.kind === "trade")).toBe(true);
    expect(view.summary?.trades).toBe(2);
    const best = (i: (typeof view.items)[number]) =>
      Math.max(...i.players.map((p) => p.overall ?? -1));
    const biggest = view.items.find(
      (i) => i.headline === view.summary!.biggestMove,
    )!;
    expect(biggest).toBeDefined();
    expect(best(biggest)).toBe(Math.max(...view.items.map(best)));
  });

  it("reports no biggest move when there were no trades", () => {
    const view = toTransactionTickerView(
      stateWith([], { currentDate: "2027-02-11", deadline: DEADLINE }),
    )!;
    expect(view.summary).toEqual({ trades: 0, biggestMove: null });
  });

  it("shows free agency signings from the first day, excluding extensions", () => {
    const events = [
      signing("2027-06-30", rosterA[0]!, otherA),
      signing(FA_START, rosterA[1]!, otherA),
      signing("2027-07-02", rosterA[2]!, otherB, {}, "RfaOfferSheetSigned"),
      signing(
        "2027-07-02",
        rosterA[3]!,
        otherB,
        { reason: "extension" },
        "ContractSigned",
      ),
      signing(
        "2027-07-02",
        rosterA[4]!,
        otherB,
        { reason: "free_agent" },
        "ContractSigned",
      ),
    ];
    const view = toTransactionTickerView(
      stateWith(events, { currentDate: "2027-07-02", freeAgency: true }),
    )!;
    expect(view.window).toBe("free_agency");
    expect(view.title).toBe("Free agency");
    expect(view.status).toBe("Day 1 of free agency");
    expect(view.items).toHaveLength(3);
    expect(view.items.every((i) => i.kind === "signing")).toBe(true);
    expect(view.items.some((i) => i.occurredOn < FA_START)).toBe(false);
  });

  it("counts a free-agent signing once (it also emits ContractSigned)", () => {
    const events = [
      signing(FA_START, rosterA[0]!, otherA, { contractId: "c_1" }),
      signing(
        FA_START,
        rosterA[0]!,
        otherA,
        { contractId: "c_1" },
        "ContractSigned",
      ),
      signing(
        FA_START,
        rosterA[1]!,
        otherA,
        { contractId: "c_2", reason: "free_agent" },
        "ContractSigned",
      ),
    ];
    const view = toTransactionTickerView(
      stateWith(events, { currentDate: "2027-07-02", freeAgency: true }),
    )!;
    expect(view.items.map((item) => item.players[0]?.playerId).sort()).toEqual(
      [rosterA[0]!, rosterA[1]!].sort(),
    );
  });

  it("covers the opening date and the first three days played", () => {
    const events = [signing(FA_START, rosterA[0]!, otherA)];
    expect(
      toTransactionTickerView(
        stateWith(events, { currentDate: FA_START, freeAgency: true }),
      )?.status,
    ).toBe("Free agency opens");
    expect(
      toTransactionTickerView(
        stateWith(events, { currentDate: "2027-07-04", freeAgency: true }),
      )?.status,
    ).toBe("Day 3 of free agency");
    expect(
      toTransactionTickerView(
        stateWith(events, { currentDate: "2027-07-05", freeAgency: true }),
      ),
    ).toBeNull();
  });

  it("orders newest first with your team's moves pinned", () => {
    const events = [
      signing(FA_START, mine[0]!, myTeamId),
      signing(FA_START, rosterA[0]!, otherA),
      signing("2027-07-02", rosterA[1]!, otherB),
      signing("2027-07-02", mine[1]!, myTeamId),
    ];
    const view = toTransactionTickerView(
      stateWith(events, { currentDate: "2027-07-02", freeAgency: true }),
    )!;
    expect(view.items.map((i) => i.isMyTeam)).toEqual([
      true,
      true,
      false,
      false,
    ]);
    expect(view.items.map((i) => i.id)).toEqual([
      events[3]!.id,
      events[0]!.id,
      events[2]!.id,
      events[1]!.id,
    ]);
  });

  it("is pure", () => {
    const state = stateWith([signing(FA_START, rosterA[0]!, otherA)], {
      currentDate: FA_START,
      freeAgency: true,
    });
    const before = JSON.stringify(state);
    expect(toTransactionTickerView(state)).toEqual(
      toTransactionTickerView(state),
    );
    expect(JSON.stringify(state)).toBe(before);
  });
});
