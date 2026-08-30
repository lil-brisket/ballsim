import { describe, expect, it } from "vitest";
import { asPlayerId, asTeamId } from "@/domain/ids";
import { createPlayer } from "../factories/player";
import {
  getPlayerAvailability,
  listPlayableRosterPlayerIds,
} from "@/systems/player-availability";
import type { GameState } from "@/state/game-state";
import { emptyTeamRosterManagement } from "@/domain/entities/team-roster-management";

function stateWithPlayers(
  players: ReturnType<typeof createPlayer>[],
  inactive: string[] = [],
): GameState {
  const map: GameState["world"]["players"] = {};
  for (const p of players) map[p.id] = p;
  return {
    world: {
      players: map,
      teams: {
        [asTeamId("team_1")]: {
          id: asTeamId("team_1"),
          roster: players.map((p) => p.id),
          rosterManagement: {
            ...emptyTeamRosterManagement(),
            inactive: inactive.map((id) => asPlayerId(id)),
          },
        },
      },
    },
  } as unknown as GameState;
}

describe("player-availability", () => {
  it("marks healthy players available", () => {
    const player = createPlayer({ id: "p1", teamId: "team_1" });
    const state = stateWithPlayers([player]);
    const avail = getPlayerAvailability(
      state,
      asPlayerId("p1"),
      asTeamId("team_1"),
    );
    expect(avail.available).toBe(true);
    expect(avail.canPlay).toBe(true);
    expect(avail.status).toBe("available");
  });

  it("treats limited as playable with workload caps", () => {
    const player = createPlayer({
      id: "p1",
      teamId: "team_1",
      availability: "limited",
      injury: {
        type: "Ankle Sprain",
        severity: "moderate",
        gamesRemaining: { min: 1, max: 3 },
        recommendedWorkloadMpg: 18,
        maximumWorkloadMpg: 22,
        recoveryProgress: 0.4,
      },
    });
    const state = stateWithPlayers([player]);
    const avail = getPlayerAvailability(
      state,
      asPlayerId("p1"),
      asTeamId("team_1"),
    );
    expect(avail.canPlay).toBe(true);
    expect(avail.status).toBe("limited");
    expect(avail.recommendedWorkloadMpg).toBe(18);
    expect(avail.maximumWorkloadMpg).toBe(22);
    expect(avail.limitReason).toContain("18");
  });

  it("treats out and suspended as not playable", () => {
    const out = createPlayer({
      id: "p1",
      teamId: "team_1",
      availability: "out",
      injury: {
        type: "Knee",
        severity: "major",
        gamesRemaining: { min: 10, max: 20 },
        recommendedWorkloadMpg: null,
        maximumWorkloadMpg: 0,
        recoveryProgress: 0,
      },
    });
    const suspended = createPlayer({
      id: "p2",
      teamId: "team_1",
      availability: "suspended",
      suspension: { gamesRemaining: 2 },
    });
    const state = stateWithPlayers([out, suspended]);
    expect(
      getPlayerAvailability(state, asPlayerId("p1"), asTeamId("team_1"))
        .canPlay,
    ).toBe(false);
    expect(
      getPlayerAvailability(state, asPlayerId("p2"), asTeamId("team_1"))
        .status,
    ).toBe("suspended");
    expect(listPlayableRosterPlayerIds(state, asTeamId("team_1"))).toEqual([]);
  });

  it("labels legacy undisclosed injuries clearly", () => {
    const player = createPlayer({
      id: "p1",
      teamId: "team_1",
      availability: "out",
      injury: {
        type: "Undisclosed",
        severity: "unknown",
        gamesRemaining: null,
        recommendedWorkloadMpg: null,
        maximumWorkloadMpg: null,
        recoveryProgress: 0,
      },
    });
    const state = stateWithPlayers([player]);
    const avail = getPlayerAvailability(
      state,
      asPlayerId("p1"),
      asTeamId("team_1"),
    );
    expect(avail.isLegacyUndisclosed).toBe(true);
    expect(avail.label).toContain("details unavailable");
  });
});
