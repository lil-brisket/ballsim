import { describe, expect, it } from "vitest";
import { createDomainEvent, type DomainEventType } from "@/domain/events";
import { createSeededRng } from "@/domain/rng";
import type { GameState } from "@/state/game-state";
import { getTeamTransactions } from "@/state/team-transaction-selectors";
import { withoutDuplicateSigningEvents } from "@/state/transaction-events";
import { toTransactionHubView } from "@/state/transaction-hub-selectors";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createTestGameState } from "../factories/game-state";

function event(
  type: DomainEventType,
  payload: Record<string, unknown>,
  occurredOn = "2027-07-01",
) {
  return createDomainEvent({ type, occurredOn, payload });
}

describe("withoutDuplicateSigningEvents", () => {
  it("drops the ContractSigned that shares a contract with a free-agent signing", () => {
    const fa = event("FreeAgentSigned", { contractId: "c1", playerId: "p1" });
    const contract = event("ContractSigned", {
      contractId: "c1",
      playerId: "p1",
    });
    expect(withoutDuplicateSigningEvents([contract, fa])).toEqual([fa]);
  });

  it("treats an RFA offer sheet the same way", () => {
    const sheet = event("RfaOfferSheetSigned", { contractId: "c2" });
    const contract = event("ContractSigned", { contractId: "c2" });
    expect(withoutDuplicateSigningEvents([sheet, contract])).toEqual([sheet]);
  });

  it("keeps lone ContractSigned events (extensions, draft picks, matches) and order", () => {
    const extension = event("ContractSigned", {
      contractId: "c3",
      reason: "extension",
    });
    const noContract = event("ContractSigned", { playerId: "p9" });
    const trade = event("PlayerTraded", { playerId: "p4" });
    const fa = event("FreeAgentSigned", { contractId: "c5" });
    const list = [extension, trade, noContract, fa];
    expect(withoutDuplicateSigningEvents(list)).toEqual(list);
  });

  it("does not mutate its input", () => {
    const list = [
      event("ContractSigned", { contractId: "c1" }),
      event("FreeAgentSigned", { contractId: "c1" }),
    ];
    const copy = [...list];
    withoutDuplicateSigningEvents(list);
    expect(list).toEqual(copy);
  });
});

describe("transaction listings show a signing once", () => {
  const base = bootstrapWorld(
    createTestGameState({ saveId: "txn_dedupe" }),
    createSeededRng("txn_dedupe"),
  ).state;
  const teamId = base.user.activeOwnerTeamId as string;
  const playerId = String(base.world.teams[teamId]!.roster[0]);
  const payload = { contractId: "c_fa", playerId, teamId };
  const state: GameState = {
    ...base,
    competition: {
      ...base.competition,
      seasonEventLog: [
        event("ContractSigned", payload),
        event("FreeAgentSigned", payload),
      ],
    },
  };

  it("on the Transactions hub", () => {
    const view = toTransactionHubView(state, {
      group: "all",
      teamId: null,
      range: "season",
      search: "",
      limit: 50,
      sort: "newest",
      activityMode: "league",
    });
    const rows = view.groups.flatMap((group) => group.rows);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.type).toBe("FreeAgentSigned");
  });

  it("in the team's transactions", () => {
    const rows = getTeamTransactions(state, base.user.activeOwnerTeamId);
    expect(rows.map((row) => row.event.type)).toEqual(["FreeAgentSigned"]);
  });
});
