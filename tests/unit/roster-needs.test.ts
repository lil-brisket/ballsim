import { describe, expect, it } from "vitest";
import { asTeamId } from "@/domain/ids";
import { emptyTeamRosterManagement } from "@/domain/entities/team-roster-management";
import type { GameState } from "@/state/game-state";
import {
  createPlayer,
  createTestInjury,
  uniformPlayerAttributes,
} from "../factories/player";
import {
  effectiveOverallAtPosition,
  evaluateRosterNeeds,
} from "@/state/roster-page-selectors";
import { positionFitsForPlayer } from "@/systems/roster-management";

function buildState(
  players: ReturnType<typeof createPlayer>[],
  teamId = asTeamId("team_needs"),
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
          rosterManagement: emptyTeamRosterManagement(),
        },
      },
    },
  } as unknown as GameState;
}

describe("positionFitsForPlayer", () => {
  it("marks primary and adjacent secondary positions", () => {
    const sf = createPlayer({ position: "SF" });
    const fits = positionFitsForPlayer(sf);
    expect(fits).toEqual([
      { position: "SF", fit: "primary" },
      { position: "SG", fit: "secondary" },
      { position: "PF", fit: "secondary" },
    ]);
  });

  it("applies 0.65 secondary effective OVR", () => {
    expect(effectiveOverallAtPosition(82, "primary")).toBe(82);
    expect(effectiveOverallAtPosition(82, "secondary")).toBe(
      Math.round(82 * 0.65),
    );
  });
});

describe("evaluateRosterNeeds", () => {
  const teamId = asTeamId("team_needs");

  it("marks critical when a position has zero healthy coverage", () => {
    const players = [
      createPlayer({
        id: "pg1",
        teamId,
        position: "PG",
        attributes: uniformPlayerAttributes(80),
      }),
    ];
    const needs = evaluateRosterNeeds(buildState(players), teamId);
    const center = needs.find((need) => need.position === "C");
    expect(center?.level).toBe("critical");
    expect(center?.score).toBe(0);
  });

  it("marks critical for a single healthy player under 75 OVR", () => {
    const players = [
      createPlayer({
        id: "c1",
        teamId,
        position: "C",
        attributes: uniformPlayerAttributes(70),
      }),
    ];
    const needs = evaluateRosterNeeds(buildState(players), teamId);
    expect(needs.find((need) => need.position === "C")?.level).toBe("critical");
  });

  it("marks weak for a single healthy starter-quality player", () => {
    const players = [
      createPlayer({
        id: "c1",
        teamId,
        position: "C",
        attributes: uniformPlayerAttributes(80),
      }),
    ];
    const needs = evaluateRosterNeeds(buildState(players), teamId);
    expect(needs.find((need) => need.position === "C")?.level).toBe("weak");
  });

  it("marks adequate when score is high but depth is only two healthy", () => {
    const players = [0, 1].map((index) =>
      createPlayer({
        id: `pg${index}`,
        teamId,
        position: "PG",
        attributes: uniformPlayerAttributes(99),
      }),
    );
    const needs = evaluateRosterNeeds(buildState(players), teamId);
    const pg = needs.find((need) => need.position === "PG");
    // Quality without 3+ healthy depth cannot be Strong — Adeqate or Strong only with 3+.
    expect(pg!.score).toBeGreaterThanOrEqual(75);
    expect(["adequate", "strong"]).toContain(pg?.level);
    expect(pg?.level).toBe("adequate");
  });

  it("marks strong with three healthy quality players at a position", () => {
    const players = [0, 1, 2].map((index) =>
      createPlayer({
        id: `pg${index}`,
        teamId,
        position: "PG",
        attributes: uniformPlayerAttributes(99),
      }),
    );
    const needs = evaluateRosterNeeds(buildState(players), teamId);
    const pg = needs.find((need) => need.position === "PG");
    expect(pg?.level).toBe("strong");
    expect(pg!.score).toBeGreaterThanOrEqual(80);
  });

  it("excludes injured players from healthy need classification", () => {
    const healthy = createPlayer({
      id: "c1",
      teamId,
      position: "C",
      attributes: uniformPlayerAttributes(88),
    });
    const injured = {
      ...createPlayer({
        id: "c2",
        teamId,
        position: "C",
        attributes: uniformPlayerAttributes(86),
      }),
      availability: "out" as const,
      injury: createTestInjury({
        type: "Ankle",
        severity: "moderate",
        maximumWorkloadMpg: 0,
      }),
      activeInjuries: [
        createTestInjury({
          type: "Ankle",
          severity: "moderate",
          maximumWorkloadMpg: 0,
        }),
      ],
    };
    const needs = evaluateRosterNeeds(
      buildState([healthy, injured]),
      teamId,
    );
    // Only one healthy → weak (not strong despite two on roster)
    expect(needs.find((need) => need.position === "C")?.level).toBe("weak");
  });

  it("does not let secondary SF coverage fully prop up PF strength", () => {
    // One 82 SF (secondary at PF = ~53 effective) + one weak PF should not be Strong at PF
    const players = [
      createPlayer({
        id: "sf1",
        teamId,
        position: "SF",
        attributes: uniformPlayerAttributes(82),
      }),
      createPlayer({
        id: "pf1",
        teamId,
        position: "PF",
        attributes: uniformPlayerAttributes(70),
      }),
    ];
    const needs = evaluateRosterNeeds(buildState(players), teamId);
    const pf = needs.find((need) => need.position === "PF");
    expect(pf?.level).not.toBe("strong");
    // Secondary 82 → 53; primary 70 → depthScore < 75 with two players → weak
    expect(pf?.level).toBe("weak");
  });
});
