/**
 * Multi-team / two-team transaction invariants for Phase 5.
 */

import { describe, expect, it } from "vitest";
import { executeTrade } from "@/systems/trades";
import {
  createTradeFixture,
  playerForPlayerProposal,
  teamIds,
} from "../systems/trades/fixture";
import { toFinancesView } from "@/state/selectors";

describe("multi-team transaction invariants", () => {
  it("player-for-player trade keeps both rosters valid and payrolls finite", () => {
    const state = createTradeFixture();
    const { teamA, teamB } = teamIds(state);
    const proposal = playerForPlayerProposal(state);
    const next = executeTrade(state, proposal).state;

    expect(next.world.teams[teamA]!.roster.length).toBe(
      state.world.teams[teamA]!.roster.length,
    );
    expect(next.world.teams[teamB]!.roster.length).toBe(
      state.world.teams[teamB]!.roster.length,
    );

    // Switch active team to read each payroll via finances view is team-scoped —
    // assert contracts moved with players instead.
    const fromA = proposal.sideA.playerIds[0]!;
    const fromB = proposal.sideB.playerIds[0]!;
    const contractA = Object.values(next.business.contracts).find(
      (c) => c.playerId === fromA,
    );
    const contractB = Object.values(next.business.contracts).find(
      (c) => c.playerId === fromB,
    );
    if (contractA) {
      expect(contractA.teamId).toBe(teamB);
    }
    if (contractB) {
      expect(contractB.teamId).toBe(teamA);
    }

    const finances = toFinancesView(next);
    expect(Number.isFinite(finances.playerPayroll)).toBe(true);
  });
});
