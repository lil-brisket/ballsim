import { describe, expect, it } from "vitest";
import { applyPreset, cloneGameSettings } from "@/domain/game-settings";
import { createTestGameState } from "../../factories/game-state";
import { createSeededRng } from "@/domain/rng";
import { runUserFranchiseAssist } from "@/systems/simulation/user-franchise-assist";
import { evaluateManagementAction } from "@/systems/simulation/management-policy";
import { DEFAULT_ROSTER_SIZE } from "@/systems/roster-generation-config";
import { STARTER_ROLES } from "@/systems/staff-generation";
import { findTeamStaffByRole } from "@/systems/staff-effects";
import { bootstrapWorld } from "@/systems/world-pipeline";

function bootstrapped(saveId: string) {
  let state = createTestGameState({ saveId });
  state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
  return state;
}

describe("user-franchise-assist", () => {
  it("does nothing when preset is off", () => {
    const state = bootstrapped("assist_off");
    state.settings.ai.managementPreset = "off";
    state.settings.ai.assistance = applyPreset("off");
    const result = runUserFranchiseAssist(state, createSeededRng(1));
    const assistEvents = result.events.filter((e) => e.type === "AiAssistAction");
    expect(assistEvents.length).toBe(0);
  });

  it("continuity can fill roster below minimum during free agency", () => {
    let state = bootstrapped("assist_roster");
    state.settings.ai.managementPreset = "continuity";
    state.settings.ai.assistance = applyPreset("continuity");
    state.competition.season.phase = "offseason";
    state.competition.season.offseasonStage = "free_agency";

    const teamId = state.user.activeOwnerTeamId;
    const team = state.world.teams[teamId]!;
    const keep = team.roster.slice(0, Math.max(1, DEFAULT_ROSTER_SIZE - 3));
    for (const playerId of team.roster) {
      if (!keep.includes(playerId)) {
        const player = state.world.players[playerId];
        if (player) {
          state.world.players[playerId] = { ...player, teamId: null };
        }
      }
    }
    state.world.teams[teamId] = { ...team, roster: [...keep] };

    const result = runUserFranchiseAssist(state, createSeededRng(2));
    const after = result.state.world.teams[teamId]!;
    expect(after.roster.length).toBeGreaterThan(keep.length);
  });

  it("continuity cannot execute trades", () => {
    const settings = cloneGameSettings(bootstrapped("assist_trade").settings);
    settings.ai.managementPreset = "continuity";
    settings.ai.assistance = applyPreset("continuity");
    expect(evaluateManagementAction(settings, "EXECUTE_TRADE").outcome).toBe(
      "DENY_CONTINUE",
    );
  });

  it("hires missing starter staff under continuity", () => {
    let state = bootstrapped("assist_staff");
    state.settings.ai.managementPreset = "continuity";
    state.settings.ai.assistance = applyPreset("continuity");
    const teamId = state.user.activeOwnerTeamId;
    const team = state.world.teams[teamId]!;
    for (const staffId of team.staff) {
      const staff = state.world.staff[staffId];
      if (staff) {
        state.world.staff[staffId] = { ...staff, teamId: null };
      }
    }
    state.world.teams[teamId] = { ...team, staff: [] };

    const result = runUserFranchiseAssist(state, createSeededRng(3));
    let hired = 0;
    for (const role of STARTER_ROLES) {
      if (findTeamStaffByRole(result.state, teamId, role) !== null) {
        hired += 1;
      }
    }
    expect(hired).toBeGreaterThan(0);
  });
});
