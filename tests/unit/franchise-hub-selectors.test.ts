import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createTestGameState } from "../factories/game-state";
import {
  sortFranchiseObjectives,
  toFranchiseHubView,
} from "@/state/franchise-hub-selectors";
import type { ObjectiveView } from "@/state/selectors";
import { explainFranchiseValue } from "@/state/franchise-value";
import { getActiveOwnerTeamId } from "@/state/owner-context";
import { FACILITY_CATEGORIES } from "@/domain/entities/franchise-ops";
import { toFranchiseBusinessView } from "@/state/franchise-selectors";
import { assessRelocation } from "@/state/relocation-assessment";
import { RELOCATION_MIN_SEASONS_IN_CITY } from "@/systems/relocation-config";
import type { GameState } from "@/state/game-state";
import type { SeasonPhase } from "@/domain/entities/season";

function bootstrapped(saveId: string): GameState {
  const state = createTestGameState({ saveId });
  const rng = createSeededRng(state.meta.rngState);
  return bootstrapWorld(state, rng).state;
}

function withPhase(state: GameState, phase: SeasonPhase): GameState {
  return {
    ...state,
    competition: {
      ...state.competition,
      season: {
        ...state.competition.season,
        phase,
        offseasonStage: phase === "offseason" ? "free_agency" : "none",
      },
    },
  };
}

function withTenure(state: GameState, seasonsInCity: number): GameState {
  const teamId = getActiveOwnerTeamId(state);
  const year = state.competition.season.year;
  const process = state.business.relocationByTeamId[teamId]!;
  return {
    ...state,
    business: {
      ...state.business,
      relocationByTeamId: {
        ...state.business.relocationByTeamId,
        [teamId]: {
          ...process,
          cityStartSeasonYear: year - seasonsInCity + 1,
          cooldownSeasonsRemaining: 0,
          failedAttemptCooldownSeasonsRemaining: 0,
        },
      },
    },
  };
}

function withWeakRelocationCase(state: GameState): GameState {
  const teamId = getActiveOwnerTeamId(state);
  const ops = state.business.franchiseOps[teamId]!;
  const finances = state.business.finances[teamId]!;
  const standing = state.competition.standings.byTeamId[teamId];
  return {
    ...state,
    competition: {
      ...state.competition,
      standings: {
        ...state.competition.standings,
        byTeamId: {
          ...state.competition.standings.byTeamId,
          [teamId]: standing
            ? { ...standing, wins: 12, losses: 50 }
            : standing,
        },
      },
    },
    business: {
      ...state.business,
      franchiseOps: {
        ...state.business.franchiseOps,
        [teamId]: {
          ...ops,
          marketSize: 35,
          fanSentiment: 30,
        },
      },
      finances: {
        ...state.business.finances,
        [teamId]: {
          ...finances,
          businessFunds: 500_000,
        },
      },
    },
  };
}

function withFacilityUpgrade(
  state: GameState,
  category: "practice",
  weeks: number,
): GameState {
  const teamId = getActiveOwnerTeamId(state);
  const ops = state.business.franchiseOps[teamId]!;
  return {
    ...state,
    business: {
      ...state.business,
      franchiseOps: {
        ...state.business.franchiseOps,
        [teamId]: {
          ...ops,
          facilities: {
            ...ops.facilities,
            [category]: {
              ...ops.facilities[category],
              upgradeWeeksRemaining: weeks,
            },
          },
        },
      },
    },
  };
}

function withRelocationStage(
  state: GameState,
  stage: "evaluate" | "explore" | "none",
): GameState {
  const teamId = getActiveOwnerTeamId(state);
  const process = state.business.relocationByTeamId[teamId]!;
  return {
    ...state,
    business: {
      ...state.business,
      relocationByTeamId: {
        ...state.business.relocationByTeamId,
        [teamId]: {
          ...process,
          stage,
        },
      },
    },
  };
}

describe("franchise-hub-selectors", () => {
  it("builds high-level hub matching franchise value", () => {
    const state = bootstrapped("franchise_hub_test");
    const hub = toFranchiseHubView(state);
    const teamId = getActiveOwnerTeamId(state);
    const value = explainFranchiseValue(state, teamId);

    expect(hub.franchiseValue).toBe(value.total);
    expect(hub.links.length).toBeGreaterThanOrEqual(4);
    expect(hub.snapshot).toHaveProperty("fanSentiment");
    expect(hub.snapshot.franchiseHealthLabel).toMatch(
      /^(Excellent|Strong|Adequate|Concerning|Critical)$/,
    );
    expect(hub.snapshot.franchiseHealthLabel).not.toMatch(/overall/);
    expect(hub.snapshot.franchiseHealthSummary).toEqual(
      expect.stringMatching(/overall/),
    );
    expect(hub.history).toBeDefined();
    expect(hub.valueExplanation.standing).toBe(value.standing);
  });

  it("shapes a facility summary without exposing FacilityRowView costs", () => {
    const state = bootstrapped("franchise_hub_facilities");
    const hub = toFranchiseHubView(state);
    const business = toFranchiseBusinessView(state);

    expect(hub.facilitiesSummary.levels).toHaveLength(FACILITY_CATEGORIES.length);
    for (const row of hub.facilitiesSummary.levels) {
      expect(row).toEqual({
        category: row.category,
        level: row.level,
        upgrading: row.upgrading,
      });
      expect(row).not.toHaveProperty("upgradeCost");
      expect(row).not.toHaveProperty("upgradeWeeksRemaining");
    }
    expect(hub.facilitiesSummary.weeklyOpex).toBe(
      business.cashRunway.outflowBreakdown.facilities,
    );
    expect(hub.financeSnapshot.cash).toBe(business.cashRunway.cash);
    expect(hub.facilitiesSummary.arenaCapacity).toBe(business.arenaCapacity);
  });

  it("flags an in-progress facility upgrade", () => {
    let state = bootstrapped("franchise_hub_upgrade");
    state = withFacilityUpgrade(state, "practice", 2);
    const hub = toFranchiseHubView(state);
    expect(hub.facilitiesSummary.upgradingCount).toBe(1);
    const practice = hub.facilitiesSummary.levels.find(
      (row) => row.category === "practice",
    );
    expect(practice?.upgrading).toBe(true);
  });

  it("marks in-season economically viable relocation as not_available without href", () => {
    let state = bootstrapped("franchise_hub_reloc_season");
    state = withTenure(state, RELOCATION_MIN_SEASONS_IN_CITY + 2);
    state = withWeakRelocationCase(state);
    state = withPhase(state, "regular");
    const assessment = assessRelocation(state);
    expect(["consider", "strong_case"]).toContain(assessment.status);

    const hub = toFranchiseHubView(state);
    expect(hub.relocationSummary.state).toBe("not_available");
    expect(hub.relocationSummary.href).toBeNull();
    expect(
      hub.decisions.some((item) => item.id === "action_relocation"),
    ).toBe(false);
  });

  it("marks offseason canStart as eligible with a live relocation href", () => {
    let state = bootstrapped("franchise_hub_reloc_eligible");
    state = withTenure(state, RELOCATION_MIN_SEASONS_IN_CITY + 2);
    state = withWeakRelocationCase(state);
    state = withPhase(state, "offseason");
    const assessment = assessRelocation(state);
    expect(assessment.canStart).toBe(true);

    const hub = toFranchiseHubView(state);
    expect(hub.relocationSummary.state).toBe("eligible");
    expect(hub.relocationSummary.href).toBe(
      `/dashboard/${state.meta.saveId}/relocation`,
    );
    const relocationDecision = hub.decisions.find(
      (item) => item.id === "action_relocation",
    );
    expect(relocationDecision).toBeDefined();
    expect(relocationDecision?.href).toBe(
      `/dashboard/${state.meta.saveId}/relocation`,
    );
    expect(relocationDecision?.hrefLabel).toBe("Review Stay vs Move");
  });

  it("marks in_progress in offseason with href", () => {
    let state = bootstrapped("franchise_hub_reloc_progress");
    state = withTenure(state, RELOCATION_MIN_SEASONS_IN_CITY + 2);
    state = withRelocationStage(state, "evaluate");
    state = withPhase(state, "offseason");

    const hub = toFranchiseHubView(state);
    expect(hub.relocationSummary.state).toBe("in_progress");
    expect(hub.relocationSummary.href).toBe(
      `/dashboard/${state.meta.saveId}/relocation`,
    );
  });

  it("marks in_progress in-season without href", () => {
    let state = bootstrapped("franchise_hub_reloc_progress_season");
    state = withTenure(state, RELOCATION_MIN_SEASONS_IN_CITY + 2);
    state = withRelocationStage(state, "evaluate");
    state = withPhase(state, "regular");

    const hub = toFranchiseHubView(state);
    expect(hub.relocationSummary.state).toBe("in_progress");
    expect(hub.relocationSummary.href).toBeNull();
    expect(
      hub.decisions.some((item) => item.id === "action_relocation"),
    ).toBe(false);
  });

  it("marks tenure cooldown without a live href", () => {
    let state = bootstrapped("franchise_hub_reloc_cooldown");
    state = withTenure(state, 2);
    state = withWeakRelocationCase(state);
    state = withPhase(state, "offseason");
    const assessment = assessRelocation(state);
    expect(assessment.status).toBe("blocked_tenure");

    const hub = toFranchiseHubView(state);
    expect(hub.relocationSummary.state).toBe("cooldown");
    expect(hub.relocationSummary.href).toBeNull();
    expect(
      hub.decisions.some((item) => item.id === "action_relocation"),
    ).toBe(false);
  });

  it("sorts active objectives first", () => {
    const objectives: ObjectiveView[] = [
      {
        id: "b",
        type: "make_playoffs",
        description: "Completed",
        status: "completed",
        seasonYear: 2026,
        category: "on_court",
        lifecycle: "season",
        role: "primary",
        target: 1,
        progress: 1,
        horizonYears: 1,
        baseline: null,
        consequenceApplied: false,
      },
      {
        id: "a",
        type: "make_playoffs",
        description: "Active",
        status: "active",
        seasonYear: 2026,
        category: "on_court",
        lifecycle: "season",
        role: "primary",
        target: 1,
        progress: 0,
        horizonYears: 1,
        baseline: null,
        consequenceApplied: false,
      },
    ];
    expect(sortFranchiseObjectives(objectives)[0]!.id).toBe("a");
  });
});
