/**
 * Phase 5 cross-surface parity — shared values must agree across hubs.
 */

import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createTestGameState } from "../factories/game-state";
import { toContractHubView } from "@/state/contract-hub-selectors";
import { toFinanceHubView } from "@/state/finance-hub-selectors";
import { toOwnerDashboardView } from "@/state/owner-dashboard";
import { toTeamHubView } from "@/state/team-hub-selectors";
import { toLeagueHubView } from "@/state/league-hub-selectors";
import { toStandingsPageView } from "@/state/standings-selectors";
import { toFinancesView } from "@/state/selectors";
import { toFreeAgencyHubView } from "@/state/free-agency-hub-selectors";
import { toOffseasonHubView } from "@/state/offseason-hub-selectors";
import { toPlayoffHubView } from "@/state/playoff-hub-selectors";
import { getActiveOwnerTeamId } from "@/state/owner-context";

describe("cross-surface parity", () => {
  it("payroll and cap space agree across Contracts, Finances, Front Office, FA", () => {
    let state = createTestGameState({ saveId: "parity_payroll" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;

    const finances = toFinancesView(state);
    const contracts = toContractHubView(state);
    const financeHub = toFinanceHubView(state);
    const owner = toOwnerDashboardView(state);
    const fa = toFreeAgencyHubView(state);

    expect(contracts.playerPayroll).toBe(finances.playerPayroll);
    expect(financeHub.finances.playerPayroll).toBe(finances.playerPayroll);
    expect(fa.playerPayroll).toBe(finances.playerPayroll);
    expect(fa.capSpace).toBe(finances.capSpace);
    expect(financeHub.finances.capSpace).toBe(finances.capSpace);
    expect(owner.currentDate).toBe(state.world.calendar.currentDate);
  });

  it("team record agrees across Team Hub, League Hub, Standings", () => {
    let state = createTestGameState({ saveId: "parity_record" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;

    const teamId = getActiveOwnerTeamId(state);
    const teamHub = toTeamHubView(state);
    const leagueHub = toLeagueHubView(state);
    const standings = toStandingsPageView(state);
    const owner = toOwnerDashboardView(state);

    expect(teamHub.wins).toBe(owner.team.wins);
    expect(teamHub.losses).toBe(owner.team.losses);
    expect(leagueHub.snapshot.userRecord).toBe(
      `${owner.team.wins}–${owner.team.losses}`,
    );

    const standingRow = standings.leagueRows.find((r) => r.teamId === teamId);
    if (standingRow) {
      expect(standingRow.wins).toBe(owner.team.wins);
      expect(standingRow.losses).toBe(owner.team.losses);
    }
  });

  it("current date agrees across Offseason hub and owner dashboard", () => {
    let state = createTestGameState({ saveId: "parity_date" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;

    const owner = toOwnerDashboardView(state);
    const offseason = toOffseasonHubView(state);
    expect(offseason.currentDate).toBe(owner.currentDate);
    expect(offseason.currentDate).toBe(state.world.calendar.currentDate);
  });

  it("playoff tournament status agrees with standings page", () => {
    let state = createTestGameState({ saveId: "parity_playoffs" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;

    const playoffs = toPlayoffHubView(state);
    const standings = toStandingsPageView(state);
    expect(playoffs.tournamentStatus).toBe(standings.playoffStatus);
  });
});
