import { describe, expect, it } from "vitest";
import {
  toTransactionHubView,
  TRANSACTION_FILTER_GROUPS,
} from "@/state/transaction-hub-selectors";
import { createTestGameState } from "../factories/game-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createSeededRng } from "@/domain/rng";
import { createDomainEvent } from "@/domain/events";
import { appendSeasonEventLog } from "@/state/game-state";

describe("transaction-hub-selectors", () => {
  it("filter groups map to domain event types", () => {
    expect(TRANSACTION_FILTER_GROUPS.trades).toContain("PlayerTraded");
    expect(TRANSACTION_FILTER_GROUPS.signings).toContain("FreeAgentSigned");
    expect(TRANSACTION_FILTER_GROUPS.releases).toContain("PlayerReleased");
  });

  it("groups multi-player same-day trades into two-sided rows", () => {
    let state = createTestGameState({ saveId: "txn_trade" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;

    const teams = Object.values(state.world.teams);
    const teamA = teams[0]!;
    const teamB = teams[1]!;
    const players = Object.values(state.world.players).filter(
      (p) => p.teamId === teamA.id || p.teamId === teamB.id,
    );
    const p1 = players.find((p) => p.teamId === teamA.id);
    const p2 = players.find((p) => p.teamId === teamB.id);
    if (!p1 || !p2) {
      return; // skip if roster empty in fixture
    }

    const date = state.world.calendar.currentDate;
    const events = [
      createDomainEvent({
        type: "PlayerTraded",
        occurredOn: date,
        payload: {
          playerId: p1.id,
          fromTeamId: teamA.id,
          toTeamId: teamB.id,
        },
      }),
      createDomainEvent({
        type: "PlayerTraded",
        occurredOn: date,
        payload: {
          playerId: p2.id,
          fromTeamId: teamB.id,
          toTeamId: teamA.id,
        },
      }),
    ];
    state = appendSeasonEventLog(state, events);

    const view = toTransactionHubView(state, {
      group: "trades",
      teamId: null,
      range: "season",
      search: "",
      limit: 25,
    });

    const tradeRow = view.groups
      .flatMap((g) => g.rows)
      .find((r) => r.type === "PlayerTraded");
    expect(tradeRow).toBeDefined();
    expect(tradeRow!.tradeSides).not.toBeNull();
    expect(tradeRow!.tradeSides!.length).toBe(2);
  });

  it("orders newest first", () => {
    let state = createTestGameState({ saveId: "txn_order" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;

    const view = toTransactionHubView(state, {
      group: "all",
      teamId: null,
      range: "season",
      search: "",
      limit: 50,
    });

    const dates = view.groups.map((g) => g.date);
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i - 1]! >= dates[i]!).toBe(true);
    }
  });
});
