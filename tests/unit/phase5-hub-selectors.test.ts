import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createTestGameState } from "../factories/game-state";
import { toScoutingHubView } from "@/state/scouting-hub-selectors";
import { toFreeAgencyHubView } from "@/state/free-agency-hub-selectors";
import { toAwardsHubView } from "@/state/awards-hub-selectors";
import {
  resolveUserPlayoffStatus,
  toPlayoffHubView,
} from "@/state/playoff-hub-selectors";
import { toFinancesView } from "@/state/selectors";
import type { GameState } from "@/state/game-state";

function withPhase(
  state: GameState,
  phase: GameState["competition"]["season"]["phase"],
  stage?: GameState["competition"]["season"]["offseasonStage"],
): GameState {
  return {
    ...state,
    competition: {
      ...state.competition,
      season: {
        ...state.competition.season,
        phase,
        offseasonStage:
          stage ??
          (phase === "offseason"
            ? "draft_preparation"
            : state.competition.season.offseasonStage),
      },
    },
  };
}

describe("scouting-hub-selectors", () => {
  it("surfaces needs-attention before fully scouted prospects", () => {
    let state = createTestGameState({ saveId: "scouting_hub" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    state = withPhase(state, "offseason", "draft_preparation");

    const hub = toScoutingHubView(state);
    expect(hub.coverage).toBeDefined();
    expect(Array.isArray(hub.needsAttention)).toBe(true);
    expect(Array.isArray(hub.prospects)).toBe(true);
    for (let i = 1; i < hub.prospects.length; i += 1) {
      if (hub.prospects[i]!.needsAttention && !hub.prospects[i - 1]!.needsAttention) {
        expect.fail("needsAttention prospects must sort first");
      }
    }
  });
});

describe("free-agency-hub-selectors", () => {
  it("matches payroll/cap from finances and exposes true OVR intentionally", () => {
    let state = createTestGameState({ saveId: "fa_hub" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;

    const hub = toFreeAgencyHubView(state);
    const finances = toFinancesView(state);
    expect(hub.playerPayroll).toBe(finances.playerPayroll);
    expect(hub.capSpace).toBe(finances.capSpace);
    expect(hub.exposesTrueOverall).toBe(true);
    expect(hub.inactiveReason).toBeTruthy();
  });
});

describe("awards-hub-selectors", () => {
  it("marks historical browsing when selected season differs", () => {
    let state = createTestGameState({ saveId: "awards_hub" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;

    const current = toAwardsHubView(state);
    expect(current.currentSeasonYear).toBe(state.competition.season.year);
    expect(current.isBrowsingHistorical).toBe(false);

    const historical = toAwardsHubView(state, {
      seasonYear: state.competition.season.year - 1,
    });
    expect(historical.isBrowsingHistorical).toBe(true);
  });
});

describe("playoff-hub-selectors", () => {
  it("returns unavailable when tournament not started", () => {
    let state = createTestGameState({ saveId: "playoff_hub" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;

    const hub = toPlayoffHubView(state);
    expect(hub.available).toBe(false);
    expect(hub.rounds).toEqual([]);
    expect(resolveUserPlayoffStatus(state, hub.userTeamId)).toBe(
      "not_in_playoffs",
    );
  });

  it("uses canonical user status values only", () => {
    const allowed = new Set([
      "not_in_playoffs",
      "in_playoffs",
      "eliminated",
      "advanced",
      "champion",
    ]);
    let state = createTestGameState({ saveId: "playoff_status" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    const hub = toPlayoffHubView(state);
    expect(allowed.has(hub.userStatus)).toBe(true);
  });
});
