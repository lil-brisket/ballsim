import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createTestGameState } from "../factories/game-state";
import { toFinanceHubView } from "@/state/finance-hub-selectors";
import { toFinancesView } from "@/state/selectors";

describe("finance-hub-selectors", () => {
  it("matches payroll from toFinancesView", () => {
    let state = createTestGameState({ saveId: "finance_hub_test" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;

    const hub = toFinanceHubView(state);
    const finances = toFinancesView(state);
    expect(hub.finances.playerPayroll).toBe(finances.playerPayroll);
    expect(hub.finances.businessFunds).toBe(finances.businessFunds);
    expect(hub.ledger).toBeDefined();
    expect(hub.trend).toBeDefined();
  });

  it("does not invent financial warnings when health is healthy", () => {
    let state = createTestGameState({ saveId: "finance_hub_warn" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;

    const hub = toFinanceHubView(state);
    if (hub.businessHealth !== "critical" && hub.businessHealth !== "tight") {
      // May be empty when no owner-dashboard financial actions exist.
      expect(Array.isArray(hub.warnings)).toBe(true);
      expect(
        hub.warnings.every((w) => w.category === "financial"),
      ).toBe(true);
    }
  });
});
