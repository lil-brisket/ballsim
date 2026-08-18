import { describe, expect, it } from "vitest";
import { asOwnerObjectiveId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import {
  evaluateOwnerObjectives,
  generateOwnerObjectives,
} from "@/systems/owner-objectives";
import { getTeamPayroll } from "@/systems/salary-cap";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { applyCashAndBooksImpact } from "@/systems/team-finances";
import { testOwnerObjective as createOwnerObjective } from "../helpers/owner-objective";
import { OWNER_PHILOSOPHIES } from "@/domain/entities/owner-philosophy";
import { getOwnerPhilosophyProfile } from "@/systems/owner-philosophy-config";
import {
  serializeGameState,
  deserializeGameState,
} from "@/persistence/mappers/game-state-mapper";
import { GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";
import { applyGameplayFinancialConsequences } from "@/systems/gameplay-financial-consequences";
import { GAMEPLAY_OBJECTIVE_REWARD } from "@/systems/owner-objectives-config";

function bootstrappedState(saveId: string) {
  const state = createInitialGameState({
    saveId,
    rngSeed: 11,
    settings: CBL_GAME_SETTINGS,
  });
  const rng = createSeededRng(state.meta.rngState);
  return bootstrapWorld(state, rng).state;
}

describe("owner objectives", () => {
  it("generates primary, secondary, and long-term mandate objectives", () => {
    let state = bootstrappedState("obj_gen");
    state = {
      ...state,
      competition: {
        ...state.competition,
        season: { ...state.competition.season, phase: "regular" },
      },
    };
    const result = generateOwnerObjectives(state);
    const active = result.state.user.objectives.filter(
      (objective) => objective.status === "active",
    );
    expect(active.some((objective) => objective.role === "primary")).toBe(true);
    expect(active.some((objective) => objective.role === "secondary")).toBe(
      true,
    );
    expect(
      active.some(
        (objective) =>
          objective.role === "long_term" ||
          objective.lifecycle === "career" ||
          objective.lifecycle === "multi_season" ||
          objective.lifecycle === "milestone",
      ),
    ).toBe(true);
    expect(active.length).toBeGreaterThanOrEqual(3);
    expect(active.length).toBeLessThanOrEqual(6);

    const again = generateOwnerObjectives(result.state);
    expect(again.state.user.objectives).toHaveLength(
      result.state.user.objectives.length,
    );
  });

  it("tracks win progress and completes minimum_win_total", () => {
    let state = bootstrappedState("obj_wins");
    const teamId = state.user.controlledTeamId;
    const year = state.competition.season.year;
    state = {
      ...state,
      competition: {
        ...state.competition,
        season: { ...state.competition.season, phase: "regular" },
        standings: {
          byTeamId: {
            ...state.competition.standings.byTeamId,
            [teamId]: {
              ...state.competition.standings.byTeamId[teamId]!,
              wins: 40,
              losses: 10,
            },
          },
        },
      },
      user: {
        ...state.user,
        objectives: [
          createOwnerObjective({
            id: asOwnerObjectiveId("obj_w"),
            type: "minimum_win_total",
            description: "Win 40",
            status: "active",
            seasonYear: year,
            target: 40,
            progress: 0,
            consequenceApplied: false,
          }),
        ],
      },
    };
    const result = evaluateOwnerObjectives(state);
    const objective = result.state.user.objectives.find((o) => o.id === "obj_w")!;
    expect(objective.status).toBe("completed");
    expect(objective.progress).toBe(40);
  });

  it("fails payroll_limit immediately and keeps failed when payroll drops", () => {
    let state = bootstrappedState("obj_pay");
    const teamId = state.user.controlledTeamId;
    const year = state.competition.season.year;
    const payroll = getTeamPayroll(teamId, year, state);
    state = {
      ...state,
      competition: {
        ...state.competition,
        season: { ...state.competition.season, phase: "regular" },
      },
      user: {
        ...state.user,
        objectives: [
          createOwnerObjective({
            id: asOwnerObjectiveId("obj_p"),
            type: "payroll_limit",
            description: "Cap payroll",
            status: "active",
            seasonYear: year,
            target: Math.max(0, payroll - 1),
            progress: payroll,
            consequenceApplied: false,
          }),
        ],
      },
    };
    const failed = evaluateOwnerObjectives(state);
    expect(failed.state.user.objectives.find((o) => o.id === "obj_p")!.status).toBe(
      "failed",
    );

    const stillFailed = {
      ...failed.state,
      user: {
        ...failed.state.user,
        objectives: failed.state.user.objectives.map((objective) =>
          objective.id === "obj_p"
            ? { ...objective, target: payroll + 1_000_000 }
            : objective,
        ),
      },
    };
    const reeval = evaluateOwnerObjectives(stillFailed);
    expect(reeval.state.user.objectives.find((o) => o.id === "obj_p")!.status).toBe(
      "failed",
    );
  });

  it("completes improve_finances from positive net income", () => {
    let state = bootstrappedState("obj_ni");
    const teamId = state.user.controlledTeamId;
    const year = state.competition.season.year;
    state = applyCashAndBooksImpact(state, teamId, 200_000_000, year, {
      revenueCategory: "other",
    }).state;
    state = {
      ...state,
      competition: {
        ...state.competition,
        season: { ...state.competition.season, phase: "regular" },
      },
      user: {
        ...state.user,
        objectives: [
          createOwnerObjective({
            id: asOwnerObjectiveId("obj_f"),
            type: "improve_finances",
            description: "Positive net income",
            status: "active",
            seasonYear: year,
            consequenceApplied: false,
          }),
        ],
      },
    };
    const result = evaluateOwnerObjectives(state);
    const financeObjective = result.state.user.objectives.find(
      (objective) => objective.id === "obj_f",
    );
    expect(financeObjective?.status).toBe("completed");
  });

  it("completes make_playoffs only from qualifiedTeams", () => {
    let state = bootstrappedState("obj_po");
    const teamId = state.user.controlledTeamId;
    const year = state.competition.season.year;
    state = {
      ...state,
      competition: {
        ...state.competition,
        season: { ...state.competition.season, phase: "playoffs" },
        playoffs: {
          ...state.competition.playoffs,
          status: "in_progress",
          fieldSize: 8,
          qualifiedTeams: [{ teamId, seed: 1 }],
          series: [],
        },
      },
      user: {
        ...state.user,
        objectives: [
          createOwnerObjective({
            id: asOwnerObjectiveId("obj_mp"),
            type: "make_playoffs",
            description: "Make playoffs",
            status: "active",
            seasonYear: year,
            consequenceApplied: false,
          }),
        ],
      },
    };
    const result = evaluateOwnerObjectives(state);
    expect(
      result.state.user.objectives.find((o) => o.id === "obj_mp")!.status,
    ).toBe("completed");
  });

  it("fails make_playoffs in postseason without qualification", () => {
    let state = bootstrappedState("obj_po_fail");
    const year = state.competition.season.year;
    state = {
      ...state,
      competition: {
        ...state.competition,
        season: { ...state.competition.season, phase: "postseason" },
      },
      user: {
        ...state.user,
        objectives: [
          createOwnerObjective({
            id: asOwnerObjectiveId("obj_mpf"),
            type: "make_playoffs",
            description: "Make playoffs",
            status: "active",
            seasonYear: year,
            consequenceApplied: false,
          }),
        ],
      },
    };
    const result = evaluateOwnerObjectives(state);
    expect(
      result.state.user.objectives.find((o) => o.id === "obj_mpf")!.status,
    ).toBe("failed");
  });

  it("evaluates develop_young_players against baseline target", () => {
    let state = bootstrappedState("obj_youth");
    const year = state.competition.season.year;
    state = {
      ...state,
      competition: {
        ...state.competition,
        season: { ...state.competition.season, phase: "regular" },
      },
      user: {
        ...state.user,
        objectives: [
          createOwnerObjective({
            id: asOwnerObjectiveId("obj_y"),
            type: "develop_young_players",
            description: "Develop youth",
            status: "active",
            seasonYear: year,
            baseline: 0,
            target: 0,
            progress: 0,
            consequenceApplied: false,
          }),
        ],
      },
    };
    const result = evaluateOwnerObjectives(state);
    expect(
      result.state.user.objectives.find((o) => o.id === "obj_y")!.status,
    ).toBe("completed");
  });

  it("keeps career objectives active across season year changes", () => {
    let state = bootstrappedState("obj_career");
    const year = state.competition.season.year;
    state = {
      ...state,
      competition: {
        ...state.competition,
        season: {
          ...state.competition.season,
          year: year + 1,
          phase: "regular",
        },
      },
      user: {
        ...state.user,
        objectives: [
          createOwnerObjective({
            id: asOwnerObjectiveId("obj_career_championships"),
            type: "championship_count",
            description: "Win 3 titles",
            status: "active",
            seasonYear: year,
            lifecycle: "career",
            role: "long_term",
            category: "long_term",
            target: 3,
            progress: 0,
            consequenceApplied: false,
          }),
        ],
      },
    };
    const result = evaluateOwnerObjectives(state);
    const career = result.state.user.objectives.find(
      (o) => o.id === "obj_career_championships",
    )!;
    expect(career.status).toBe("active");
    expect(career.lifecycle).toBe("career");
  });

  it("does not post cash for non-whitelisted objective completion", () => {
    let state = bootstrappedState("obj_nocash");
    const teamId = state.user.controlledTeamId;
    const year = state.competition.season.year;
    const before = state.business.finances[teamId]!.cash;
    state = {
      ...state,
      user: {
        ...state.user,
        objectives: [
          createOwnerObjective({
            id: asOwnerObjectiveId("obj_aware"),
            type: "awareness",
            description: "Raise awareness",
            status: "completed",
            seasonYear: year,
            consequenceApplied: false,
          }),
        ],
      },
    };
    const once = applyGameplayFinancialConsequences(state);
    expect(once.state.business.finances[teamId]!.cash).toBe(before);
    expect(once.state.user.objectives[0]!.consequenceApplied).toBe(true);
  });

  it("still posts cash for whitelisted make_playoffs completion", () => {
    let state = bootstrappedState("obj_cash");
    const teamId = state.user.controlledTeamId;
    const year = state.competition.season.year;
    const before = state.business.finances[teamId]!.cash;
    state = {
      ...state,
      user: {
        ...state.user,
        objectives: [
          createOwnerObjective({
            id: asOwnerObjectiveId("obj_mp_cash"),
            type: "make_playoffs",
            description: "Make playoffs",
            status: "completed",
            seasonYear: year,
            consequenceApplied: false,
          }),
        ],
      },
    };
    const once = applyGameplayFinancialConsequences(state);
    expect(once.state.business.finances[teamId]!.cash).toBe(
      before + GAMEPLAY_OBJECTIVE_REWARD,
    );
  });
});

describe("owner philosophy profiles", () => {
  it("defines distinct priorities and tolerances for all five philosophies", () => {
    const profiles = OWNER_PHILOSOPHIES.map((id) =>
      getOwnerPhilosophyProfile(id),
    );
    expect(profiles).toHaveLength(5);
    expect(new Set(profiles.map((p) => p.preferredPrimary[0])).size).toBeGreaterThan(
      1,
    );
    expect(
      getOwnerPhilosophyProfile("win_now").winTolerance.unacceptable,
    ).toBeGreaterThan(
      getOwnerPhilosophyProfile("build_for_the_future").winTolerance
        .unacceptable,
    );
    expect(
      getOwnerPhilosophyProfile("financially_conservative").payrollPressure,
    ).toBeGreaterThan(getOwnerPhilosophyProfile("win_now").payrollPressure);
    expect(
      getOwnerPhilosophyProfile("market_expansion").categoryWeights.franchise,
    ).toBeGreaterThan(
      getOwnerPhilosophyProfile("win_now").categoryWeights.franchise,
    );
    expect(
      getOwnerPhilosophyProfile("balanced").categoryWeights.competitive,
    ).toBe(
      getOwnerPhilosophyProfile("balanced").categoryWeights.financial,
    );
  });

  it("generates different primary categories for win_now vs market_expansion in a small market", () => {
    let state = bootstrappedState("obj_phil");
    const teamId = state.user.controlledTeamId;
    state = {
      ...state,
      competition: {
        ...state.competition,
        season: { ...state.competition.season, phase: "regular" },
      },
      business: {
        ...state.business,
        franchiseOps: {
          ...state.business.franchiseOps,
          [teamId]: {
            ...state.business.franchiseOps[teamId]!,
            marketSize: 25,
          },
        },
      },
    };

    const winNow = generateOwnerObjectives({
      ...state,
      user: { ...state.user, ownerPhilosophy: "win_now", objectives: [] },
    });
    const market = generateOwnerObjectives({
      ...state,
      user: {
        ...state.user,
        ownerPhilosophy: "market_expansion",
        objectives: [],
      },
    });

    const winPrimary = winNow.state.user.objectives.find(
      (o) => o.role === "primary",
    )!;
    const marketPrimary = market.state.user.objectives.find(
      (o) => o.role === "primary",
    )!;
    expect(winPrimary.category).toBe("competitive");
    expect(["franchise", "financial"]).toContain(marketPrimary.category);
  });
});

describe("owner mandate persistence", () => {
  it("new saves include philosophy and patience at schema 26", () => {
    const state = bootstrappedState("obj_persist_new");
    expect(state.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    expect(state.user.ownerPhilosophy).toBe("balanced");
    expect(state.user.ownerPatience).toBeGreaterThan(0);
    const restored = deserializeGameState(serializeGameState(state));
    expect(restored.user.ownerPhilosophy).toBe(state.user.ownerPhilosophy);
    expect(restored.user.ownerPatience).toBe(state.user.ownerPatience);
  });

  it("migrates v25 saves without philosophy to balanced", () => {
    const state = bootstrappedState("obj_migrate");
    const json = JSON.parse(serializeGameState(state)) as {
      meta: { schemaVersion: number };
      user: Record<string, unknown>;
    };
    json.meta.schemaVersion = 25;
    delete json.user.ownerPhilosophy;
    delete json.user.ownerPatience;
    json.user.objectives = (
      json.user.objectives as Array<Record<string, unknown>>
    ).map((objective) => {
      const next = { ...objective };
      delete next.category;
      delete next.lifecycle;
      delete next.role;
      return next;
    });
    const restored = deserializeGameState(JSON.stringify(json));
    expect(restored.meta.schemaVersion).toBe(26);
    expect(restored.user.ownerPhilosophy).toBe("balanced");
    expect(restored.user.ownerPatience).toBeGreaterThan(0);
    for (const objective of restored.user.objectives) {
      expect(objective.category).toBeTruthy();
      expect(objective.lifecycle).toBeTruthy();
      expect(objective.role).toBeTruthy();
    }
  });
});
