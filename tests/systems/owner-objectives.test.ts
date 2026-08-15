import { describe, expect, it } from "vitest";
import { createOwnerObjective } from "@/domain/entities/owner-objective";
import { asOwnerObjectiveId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import {
  evaluateOwnerObjectives,
  generateOwnerObjectives,
} from "@/systems/owner-objectives";
import { OWNER_OBJECTIVE_PAYROLL_LIMIT } from "@/systems/owner-objectives-config";
import { getTeamPayroll } from "@/systems/salary-cap";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { applyCashAndBooksImpact } from "@/systems/team-finances";

function bootstrappedState(saveId: string) {
  const state = createInitialGameState({
    saveId, rngSeed: 11,
    settings: CBL_GAME_SETTINGS,
  });
  const rng = createSeededRng(state.meta.rngState);
  return bootstrapWorld(state, rng).state;
}

describe("owner objectives", () => {
  it("generates season objectives from roster strength and payroll limit", () => {
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
    expect(active.length).toBe(2);
    expect(active.some((objective) => objective.type === "payroll_limit")).toBe(
      true,
    );
    expect(
      active.some(
        (objective) =>
          objective.type === "make_playoffs" ||
          objective.type === "minimum_win_total",
      ),
    ).toBe(true);
    const payroll = active.find((objective) => objective.type === "payroll_limit");
    expect(payroll?.target).toBe(OWNER_OBJECTIVE_PAYROLL_LIMIT);

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
    const objective = result.state.user.objectives[0]!;
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

    // Lower target still failed after "payroll drop" simulation via higher target.
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
    expect(result.state.user.objectives[0]!.status).toBe("completed");
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
    expect(result.state.user.objectives[0]!.status).toBe("failed");
  });
});
