import { describe, expect, it } from "vitest";
import { createTestGameState } from "../factories/game-state";
import {
  toContractsView,
  toDashboardSnapshot,
  toEventLogView,
  toFinancesView,
  toObjectivesView,
  toScheduleView,
  toStandingsView,
} from "@/state/selectors";
import { appendEventLog } from "@/state/game-state";
import { createDomainEvent } from "@/domain/events";
import { getFinancialStatement } from "@/systems/team-finances";

describe("owner selectors", () => {
  it("dashboard includes finances, rank, objectives, and activity", () => {
    let state = createTestGameState({ saveId: "save_sel" });
    state = appendEventLog(state, [
      createDomainEvent({
        type: "GameCompleted",
        occurredOn: state.world.calendar.currentDate,
        payload: { gameId: "g1" },
      }),
    ]);
    const dash = toDashboardSnapshot(state);
    expect(dash.controlledTeam.id).toBe(state.user.activeOwnerTeamId);
    expect(dash.currentDate).toBe(state.world.calendar.currentDate);
    expect(dash.standingsRank).toBeGreaterThan(0);
    expect(dash.cash).toBeTypeOf("number");
    expect(dash.revenueTotal).toBeTypeOf("number");
    expect(dash.recentActivity).toHaveLength(1);
    expect(toObjectivesView(state)).toEqual(dash.objectives);
  });

  it("finances match getFinancialStatement", () => {
    const state = createTestGameState({ saveId: "save_fin" });
    const view = toFinancesView(state);
    const statement = getFinancialStatement(
      state,
      state.user.activeOwnerTeamId,
      state.competition.season.year,
    );
    expect(view.statement).toEqual(statement);
  });

  it("standings and schedule are derived from competition", () => {
    const state = createTestGameState({ saveId: "save_comp" });
    const standings = toStandingsView(state);
    expect(standings.some((row) => row.isUserTeam)).toBe(true);
    expect(standings.every((row) => row.rank >= 1)).toBe(true);
    expect(toScheduleView(state)).toEqual([]);
    expect(toContractsView(state)).toEqual([]);
    expect(toEventLogView(state)).toEqual([]);
  });
});
