import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createTestGameState } from "../factories/game-state";
import { toOffseasonHubView } from "@/state/offseason-hub-selectors";
import { toOwnerDashboardView } from "@/state/owner-dashboard";
import { toFinancesView } from "@/state/selectors";
import type { GameState } from "@/state/game-state";

function withPhase(
  state: GameState,
  phase: GameState["competition"]["season"]["phase"],
): GameState {
  return {
    ...state,
    competition: {
      ...state.competition,
      season: {
        ...state.competition.season,
        phase,
        offseasonStage:
          phase === "offseason"
            ? "free_agency"
            : state.competition.season.offseasonStage,
      },
    },
  };
}

describe("offseason-hub-selectors", () => {
  it("returns inactive view outside offseason", () => {
    let state = createTestGameState({ saveId: "offseason_inactive" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    state = withPhase(state, "regular");

    const hub = toOffseasonHubView(state);
    expect(hub.active).toBe(false);
    expect(hub.timeline).toEqual([]);
    expect(hub.status).toEqual([]);
    expect(hub.quickLinks).toHaveLength(1);
    expect(hub.quickLinks[0]?.href).toContain("/calendar");
  });

  it("builds active command center during offseason with header parity", () => {
    let state = createTestGameState({ saveId: "offseason_active" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    state = withPhase(state, "offseason");

    const hub = toOffseasonHubView(state);
    const owner = toOwnerDashboardView(state);
    const finances = toFinancesView(state);

    expect(hub.active).toBe(true);
    expect(hub.currentDate).toBe(owner.currentDate);
    expect(hub.seasonYear).toBe(owner.seasonYear);
    expect(hub.record).toBe(`${owner.team.wins}–${owner.team.losses}`);
    expect(hub.playerPayroll).toBe(finances.playerPayroll);
    expect(hub.capSpace).toBe(finances.capSpace);
    expect(hub.timeline.length).toBeGreaterThan(0);
    expect(hub.status.length).toBeGreaterThan(0);
    expect(hub.actionCenter).toBeDefined();
    expect(hub.quickLinks.some((l) => l.href.endsWith("/draft"))).toBe(true);
    expect(hub.quickLinks.some((l) => l.href.endsWith("/calendar"))).toBe(
      true,
    );
  });

  it("maps timeline milestones to destination hrefs", () => {
    let state = createTestGameState({ saveId: "offseason_timeline" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    state = withPhase(state, "offseason");

    const hub = toOffseasonHubView(state);
    const draftEvent = hub.timeline.find((e) => e.key === "draftStart");
    const faEvent = hub.timeline.find((e) => e.key === "freeAgencyOpen");
    if (draftEvent) {
      expect(draftEvent.href).toContain("/draft");
    }
    if (faEvent) {
      expect(faEvent.href).toContain("/free-agency");
    }
    const dates = hub.timeline
      .map((e) => e.date)
      .filter((d): d is string => d !== null);
    const sorted = [...dates].sort((a, b) => a.localeCompare(b));
    expect(dates).toEqual(sorted);
  });

  it("status checklist describes state without inventing completion gates", () => {
    let state = createTestGameState({ saveId: "offseason_status" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    state = withPhase(state, "offseason");

    const hub = toOffseasonHubView(state);
    const ids = hub.status.map((s) => s.id);
    expect(ids).toEqual([
      "contracts",
      "staff",
      "draft",
      "free_agency",
      "development",
      "roster",
    ]);
    for (const item of hub.status) {
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.detail.length).toBeGreaterThan(0);
      expect(typeof item.done).toBe("boolean");
    }
  });
});
