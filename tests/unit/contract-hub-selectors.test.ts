import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createTestGameState } from "../factories/game-state";
import {
  sortContractHubRows,
  toContractHubView,
  type ContractHubRow,
} from "@/state/contract-hub-selectors";
import { toContractsView, toFinancesView } from "@/state/selectors";

describe("contract-hub-selectors", () => {
  it("builds hub view matching payroll from toFinancesView", () => {
    let state = createTestGameState({ saveId: "contract_hub_test" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;

    const hub = toContractHubView(state);
    const finances = toFinancesView(state);
    const contracts = toContractsView(state);

    expect(hub.playerPayroll).toBe(finances.playerPayroll);
    expect(hub.capSpace).toBe(finances.capSpace);
    expect(hub.overview.playerCount).toBe(contracts.length);
    expect(hub.rows).toHaveLength(contracts.length);
  });

  it("separates contract state from available action", () => {
    let state = createTestGameState({ saveId: "contract_hub_actions" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;

    const hub = toContractHubView(state);
    for (const row of hub.rows) {
      expect(row.contractState).toBeTruthy();
      if (!row.hasPendingTeamOption) {
        expect(row.availableAction).toBe("none");
      } else {
        expect(row.availableAction).toBe("exercise_team_option");
      }
    }
  });

  it("sorts actionable then expiring then salary desc then name", () => {
    const rows: ContractHubRow[] = [
      {
        contractId: "c1",
        playerId: "p1",
        playerName: "Zebra",
        position: "C",
        salary: 10_000_000,
        startYear: 2025,
        endYear: 2028,
        yearsRemaining: 3,
        status: "active",
        hasPendingTeamOption: false,
        hasPendingPlayerOption: false,
        age: 28,
        expirationYear: 2028,
        contractState: "active",
        optionLabel: "—",
        availableAction: "none",
        isExpiring: false,
        isLargeCommitment: true,
      },
      {
        contractId: "c2",
        playerId: "p2",
        playerName: "Alpha",
        position: "PG",
        salary: 5_000_000,
        startYear: 2025,
        endYear: 2026,
        yearsRemaining: 1,
        status: "active",
        hasPendingTeamOption: false,
        hasPendingPlayerOption: false,
        age: 24,
        expirationYear: 2026,
        contractState: "expiring",
        optionLabel: "—",
        availableAction: "none",
        isExpiring: true,
        isLargeCommitment: false,
      },
      {
        contractId: "c3",
        playerId: "p3",
        playerName: "Option",
        position: "SF",
        salary: 2_000_000,
        startYear: 2024,
        endYear: 2025,
        yearsRemaining: 0,
        status: "team_option",
        hasPendingTeamOption: true,
        hasPendingPlayerOption: false,
        age: 26,
        expirationYear: 2025,
        contractState: "option_pending",
        optionLabel: "Team option pending",
        availableAction: "exercise_team_option",
        isExpiring: false,
        isLargeCommitment: false,
      },
    ];

    const sorted = sortContractHubRows(rows);
    expect(sorted.map((r) => r.contractId)).toEqual(["c3", "c2", "c1"]);
  });
});
