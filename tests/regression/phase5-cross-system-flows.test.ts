/**
 * Phase 5 cross-system flow invariants (selector-level).
 */

import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createTestGameState } from "../factories/game-state";
import { ownerNavGroupsForState } from "@/application/owner-nav-config";
import { toOffseasonHubView } from "@/state/offseason-hub-selectors";
import { toDraftHubView } from "@/state/draft-hub-selectors";
import { toFreeAgencyHubView } from "@/state/free-agency-hub-selectors";
import { toPlayoffHubView } from "@/state/playoff-hub-selectors";
import { toContractHubView } from "@/state/contract-hub-selectors";
import { toFinanceHubView } from "@/state/finance-hub-selectors";
import { toOwnerDashboardView } from "@/state/owner-dashboard";
import type { GameState } from "@/state/game-state";

function withPhase(
  state: GameState,
  phase: GameState["competition"]["season"]["phase"],
  stage: GameState["competition"]["season"]["offseasonStage"] = "none",
): GameState {
  return {
    ...state,
    competition: {
      ...state.competition,
      season: {
        ...state.competition.season,
        phase,
        offseasonStage: stage,
      },
    },
  };
}

describe("phase5 cross-system flows", () => {
  it("Flow 8 — offseason command center stays synced with contracts/finances", () => {
    let state = createTestGameState({ saveId: "flow8_offseason" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    state = withPhase(state, "offseason", "roster_decisions");

    const hub = toOffseasonHubView(state);
    const contracts = toContractHubView(state);
    const finances = toFinanceHubView(state);
    const owner = toOwnerDashboardView(state);

    expect(hub.active).toBe(true);
    expect(hub.playerPayroll).toBe(contracts.playerPayroll);
    expect(hub.playerPayroll).toBe(finances.finances.playerPayroll);
    expect(hub.currentDate).toBe(owner.currentDate);
    expect(ownerNavGroupsForState(state).some((g) => g.id === "offseason")).toBe(
      true,
    );
  });

  it("Flow 6/5 — draft and FA hubs do not invent active state outside stage", () => {
    let state = createTestGameState({ saveId: "flow_draft_fa" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    state = withPhase(state, "regular");

    expect(toDraftHubView(state).active).toBe(false);
    expect(toFreeAgencyHubView(state).active).toBe(false);
  });

  it("Flow 7 — playoffs hub unavailable before tournament starts", () => {
    let state = createTestGameState({ saveId: "flow_playoffs" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;

    expect(toPlayoffHubView(state).available).toBe(false);
  });
});
