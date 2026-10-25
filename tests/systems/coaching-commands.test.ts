import { describe, expect, it } from "vitest";
import { DEFAULT_COACHING_PHILOSOPHY } from "@/domain/coaching/coaching-philosophy";
import { asPlayerId } from "@/domain/ids";
import { toCoachingView } from "@/state/team-management-selectors";
import { generateRosters } from "@/systems/roster-generation";
import {
  applyCoachingPresetCommand,
  updateCoachingPhilosophyCommand,
} from "@/systems/team-management-commands";
import { createTestGameState } from "../factories/game-state";
import { createTestRng } from "../helpers/determinism";

function bootstrappedState() {
  return generateRosters(createTestGameState(), createTestRng(1)).state;
}

describe("coaching commands", () => {
  it("saves a focal player from the roster", () => {
    const state = bootstrappedState();
    const teamId = state.user.activeOwnerTeamId;
    const playerId = state.world.teams[teamId]!.roster[0]!;
    const result = updateCoachingPhilosophyCommand(state, {
      teamId,
      philosophy: { ...DEFAULT_COACHING_PHILOSOPHY, focalPlayerId: playerId },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.state.world.teams[teamId]!.coachingPhilosophy.focalPlayerId,
    ).toBe(playerId);
    expect(toCoachingView(result.state).philosophy.focalPlayerId).toBe(
      playerId,
    );
  });

  it("rejects a focal player who is not on the roster", () => {
    const state = bootstrappedState();
    const teamId = state.user.activeOwnerTeamId;
    const result = updateCoachingPhilosophyCommand(state, {
      teamId,
      philosophy: {
        ...DEFAULT_COACHING_PHILOSOPHY,
        focalPlayerId: asPlayerId("player_elsewhere"),
      },
    });
    expect(result).toEqual({
      ok: false,
      error: "Focal player must be on your roster.",
    });
  });

  it("rejects unknown philosophy values", () => {
    const state = bootstrappedState();
    const result = updateCoachingPhilosophyCommand(state, {
      teamId: state.user.activeOwnerTeamId,
      philosophy: {
        ...DEFAULT_COACHING_PHILOSOPHY,
        pace: "warp" as "fast",
      },
    });
    expect(result.ok).toBe(false);
  });

  it("keeps the focal player when a preset is applied", () => {
    const state = bootstrappedState();
    const teamId = state.user.activeOwnerTeamId;
    const playerId = state.world.teams[teamId]!.roster[0]!;
    const withFocal = updateCoachingPhilosophyCommand(state, {
      teamId,
      philosophy: { ...DEFAULT_COACHING_PHILOSOPHY, focalPlayerId: playerId },
    });
    if (!withFocal.ok) throw new Error(withFocal.error);
    const result = applyCoachingPresetCommand(withFocal.state, {
      teamId,
      presetId: "fastPace",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const team = result.state.world.teams[teamId]!;
    expect(team.coachingPhilosophy).toMatchObject({
      pace: "fast",
      focalPlayerId: playerId,
    });
    expect(toCoachingView(result.state).activePreset).toBe("fastPace");
  });

  it("clears a focal player who left the roster when a preset is applied", () => {
    const state = bootstrappedState();
    const teamId = state.user.activeOwnerTeamId;
    const team = state.world.teams[teamId]!;
    const stale = {
      ...state,
      world: {
        ...state.world,
        teams: {
          ...state.world.teams,
          [teamId]: {
            ...team,
            coachingPhilosophy: {
              ...team.coachingPhilosophy,
              focalPlayerId: asPlayerId("player_gone"),
            },
          },
        },
      },
    };
    const result = applyCoachingPresetCommand(stale, {
      teamId,
      presetId: "balanced",
    });
    if (!result.ok) throw new Error(result.error);
    expect(
      result.state.world.teams[teamId]!.coachingPhilosophy.focalPlayerId,
    ).toBeNull();
  });

  it("lists the roster as focal options, best overall first", () => {
    const state = bootstrappedState();
    const view = toCoachingView(state);
    const team = state.world.teams[state.user.activeOwnerTeamId]!;
    expect(view.focalPlayerOptions).toHaveLength(team.roster.length);
    const overalls = view.focalPlayerOptions.map((option) => option.overall);
    expect(overalls).toEqual([...overalls].sort((a, b) => b - a));
    expect(view.philosophy.focalPlayerId).toBeNull();
  });
});
