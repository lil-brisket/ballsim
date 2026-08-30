import { describe, expect, it } from "vitest";
import { asPlayerId, asTeamId } from "@/domain/ids";
import { createPlayer } from "../../factories/player";
import { createSeededRng } from "@/domain/rng";
import {
  applyInjuryFromSeverity,
  processExposureEvent,
  tickDailyRecovery,
} from "@/systems/injury";
import { createGameAcuteExposure } from "@/systems/injury/injury-exposure";
import type { GameState } from "@/state/game-state";
import type { Staff } from "@/domain/entities/staff";

function stateWithStaff(players: ReturnType<typeof createPlayer>[]): {
  state: GameState;
  staff: Staff;
} {
  const playerMap: GameState["world"]["players"] = {};
  for (const p of players) playerMap[p.id] = p;
  const staffId = "staff_med_1";
  const staff = {
    id: staffId,
    teamId: asTeamId("team_1"),
    firstName: "Pat",
    lastName: "Medic",
    role: "medical",
    age: 45,
    overall: 70,
    attributes: {
      injuryPrevention: 80,
      injuryDiagnosis: 75,
      rehabilitation: 78,
      recovery: 82,
      conditioning: 70,
    },
    morale: 60,
    preferences: {},
    development: { stage: "prime", trend: "stable" },
    career: [],
  } as unknown as Staff;

  const state = {
    world: {
      players: playerMap,
      staff: { [staffId]: staff },
      teams: {
        [asTeamId("team_1")]: {
          id: asTeamId("team_1"),
          roster: players.map((p) => p.id),
          staff: [staffId],
          rosterManagement: {
            startingLineup: [],
            bench: [],
            inactive: [],
            rotation: [],
            rotationStyle: "balanced",
            rotationPhilosophy: "balanced",
            rotationDepth: 12,
            rotationPreset: "balanced",
            closingLineupPolicy: "auto",
            closingLineupIds: [],
            lastConfiguredBy: "default",
          },
        },
      },
      calendar: { currentDate: "2026-02-01" },
    },
    settings: { injuryFrequency: "high" },
  } as unknown as GameState;

  return { state, staff };
}

describe("staff isolation from player injuries", () => {
  it("injury creation and recovery never mutate staff morale or attributes", () => {
    const player = createPlayer({ id: "p1", teamId: "team_1" });
    let { state, staff } = stateWithStaff([player]);
    const moraleBefore = staff.morale;
    const attrsBefore = { ...(staff.attributes as Record<string, number>) };

    state = applyInjuryFromSeverity(state, asPlayerId("p1"), {
      type: "Ankle Sprain",
      severity: "major",
      catalogKey: "ankle_sprain",
    });

    const rng = createSeededRng(99);
    for (let i = 0; i < 5; i++) {
      const result = tickDailyRecovery(state, rng);
      state = result.state;
    }

    const exposure = processExposureEvent(
      state,
      createGameAcuteExposure({
        playerId: asPlayerId("p1"),
        teamId: asTeamId("team_1"),
        date: "2026-02-01",
        minutesPlayed: 40,
        fatigue: 0.9,
      }),
      rng,
    );
    state = exposure.state;

    const staffAfter = state.world.staff[staff.id]!;
    expect(staffAfter.morale).toBe(moraleBefore);
    expect(staffAfter.attributes).toEqual(attrsBefore);
  });
});
