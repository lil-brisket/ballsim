import { describe, expect, it } from "vitest";
import { asTeamId } from "@/domain/ids";
import { emptyTeamRosterManagement } from "@/domain/entities/team-roster-management";
import type { GameState } from "@/state/game-state";
import {
  createPlayer,
  createTestInjury,
  uniformPlayerAttributes,
} from "../factories/player";
import { toDepthChartView } from "@/state/roster-page-selectors";

function buildState(
  players: ReturnType<typeof createPlayer>[],
  startingLineup: Array<{ playerId: string; slot: "PG" | "SG" | "SF" | "PF" | "C" }> = [],
  teamId = asTeamId("team_depth"),
): GameState {
  const worldPlayers: GameState["world"]["players"] = {};
  for (const player of players) {
    worldPlayers[player.id] = player;
  }
  return {
    user: { activeOwnerTeamId: teamId },
    world: {
      players: worldPlayers,
      teams: {
        [teamId]: {
          id: teamId,
          roster: players.map((player) => player.id),
          rosterManagement: {
            ...emptyTeamRosterManagement(),
            startingLineup: startingLineup.map((slot) => ({
              playerId: slot.playerId as ReturnType<typeof createPlayer>["id"],
              slot: slot.slot,
            })),
          },
        },
      },
    },
  } as unknown as GameState;
}

describe("toDepthChartView", () => {
  const teamId = asTeamId("team_depth");

  it("ranks eligible players by effective OVR at the depth position", () => {
    const high = createPlayer({
      id: "pg_high",
      teamId,
      position: "PG",
      attributes: uniformPlayerAttributes(88),
    });
    const low = createPlayer({
      id: "pg_low",
      teamId,
      position: "PG",
      attributes: uniformPlayerAttributes(72),
    });
    const chart = toDepthChartView(buildState([low, high]), teamId);
    expect(chart.PG.map((entry) => entry.playerId)).toEqual([
      "pg_high",
      "pg_low",
    ]);
  });

  it("does not place a PG at C", () => {
    const pg = createPlayer({
      id: "pg1",
      teamId,
      position: "PG",
      attributes: uniformPlayerAttributes(90),
    });
    const chart = toDepthChartView(buildState([pg]), teamId);
    expect(chart.C).toHaveLength(0);
    expect(chart.PG.some((entry) => entry.playerId === "pg1")).toBe(true);
  });

  it("allows SF secondary coverage at PF with SECONDARY label", () => {
    const sf = createPlayer({
      id: "sf1",
      teamId,
      position: "SF",
      attributes: uniformPlayerAttributes(84),
    });
    const chart = toDepthChartView(buildState([sf]), teamId);
    const pfEntry = chart.PF.find((entry) => entry.playerId === "sf1");
    expect(pfEntry).toBeDefined();
    expect(pfEntry?.label).toBe("SECONDARY");
    expect(pfEntry?.fit).toBe("secondary");
  });

  it("labels persisted starter at slot as STARTER", () => {
    const pg = createPlayer({
      id: "pg1",
      teamId,
      position: "PG",
      attributes: uniformPlayerAttributes(80),
    });
    const chart = toDepthChartView(
      buildState([pg], [{ playerId: "pg1", slot: "PG" }]),
      teamId,
    );
    expect(chart.PG[0]?.label).toBe("STARTER");
  });

  it("flags unavailable players but still lists them", () => {
    const injured = {
      ...createPlayer({
        id: "pg1",
        teamId,
        position: "PG",
        attributes: uniformPlayerAttributes(85),
      }),
      availability: "out" as const,
      injury: createTestInjury({
        type: "Knee",
        severity: "severe",
        maximumWorkloadMpg: 0,
      }),
      activeInjuries: [
        createTestInjury({
          type: "Knee",
          severity: "severe",
          maximumWorkloadMpg: 0,
        }),
      ],
    };
    const chart = toDepthChartView(buildState([injured]), teamId);
    expect(chart.PG[0]?.canPlay).toBe(false);
    expect(chart.PG[0]?.available).toBe(false);
  });
});
