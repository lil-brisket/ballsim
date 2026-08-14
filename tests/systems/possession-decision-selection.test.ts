import { describe, expect, it } from "vitest";
import { asTeamId } from "@/domain/ids";
import { GAME_SIMULATION_CONFIG } from "@/systems/game-simulation-config";
import { choosePossessionDecision } from "@/systems/possession-decision-selection";
import { createPlayer } from "../factories/player";
import { createTestRng } from "../helpers/determinism";

const OFFENSE = asTeamId("team_offense");
const DEFENSE = asTeamId("team_defense");

function attrs(level: number) {
  return {
    finishing: level,
    midRange: level,
    threePoint: level,
    passing: level,
    ballHandling: level,
    offensiveIq: level,
  };
}

function fiveManPool() {
  return {
    offensivePlayers: [
      createPlayer({
        id: "star",
        teamId: OFFENSE,
        attributes: attrs(95),
      }),
      createPlayer({
        id: "second",
        teamId: OFFENSE,
        attributes: attrs(82),
      }),
      createPlayer({
        id: "role",
        teamId: OFFENSE,
        attributes: attrs(65),
      }),
      createPlayer({
        id: "benchish",
        teamId: OFFENSE,
        attributes: attrs(55),
      }),
      createPlayer({
        id: "twelfth",
        teamId: OFFENSE,
        attributes: attrs(40),
      }),
    ],
    defensivePlayers: [
      createPlayer({ id: "d1", teamId: DEFENSE, attributes: attrs(70) }),
      createPlayer({ id: "d2", teamId: DEFENSE, attributes: attrs(70) }),
      createPlayer({ id: "d3", teamId: DEFENSE, attributes: attrs(70) }),
      createPlayer({ id: "d4", teamId: DEFENSE, attributes: attrs(70) }),
      createPlayer({ id: "d5", teamId: DEFENSE, attributes: attrs(70) }),
    ],
  };
}

describe("choosePossessionDecision usage weighting", () => {
  it("gives the superstar substantially more shot involvement than the 12th man", () => {
    const pool = fiveManPool();
    const shotCounts = new Map<string, number>();
    const passCounts = new Map<string, number>();
    const samples = 8000;
    const rng = createTestRng(123);

    for (let index = 0; index < samples; index += 1) {
      const decision = choosePossessionDecision(
        {
          offensiveTeamId: OFFENSE,
          defensiveTeamId: DEFENSE,
          offensivePlayers: pool.offensivePlayers,
          defensivePlayers: pool.defensivePlayers,
          config: GAME_SIMULATION_CONFIG,
        },
        rng,
      );
      if (decision.action === "shot") {
        shotCounts.set(
          decision.shooterId,
          (shotCounts.get(decision.shooterId) ?? 0) + 1,
        );
      }
      if (decision.action === "pass") {
        passCounts.set(
          decision.passerId,
          (passCounts.get(decision.passerId) ?? 0) + 1,
        );
      }
    }

    expect(shotCounts.get("star")!).toBeGreaterThan(
      shotCounts.get("second")!,
    );
    expect(shotCounts.get("second")!).toBeGreaterThan(
      shotCounts.get("role")!,
    );
    expect(shotCounts.get("role")!).toBeGreaterThan(
      shotCounts.get("twelfth")!,
    );
    expect(shotCounts.get("twelfth")!).toBeGreaterThan(0);

    expect(passCounts.get("star")!).toBeGreaterThan(
      passCounts.get("twelfth")!,
    );
    expect(passCounts.get("twelfth")!).toBeGreaterThan(0);
  });

  it("biases defensive shooting-foul victims toward scoring threats", () => {
    const pool = fiveManPool();
    const fouledCounts = new Map<string, number>();
    const config = {
      ...GAME_SIMULATION_CONFIG,
      actionBaseWeights: {
        shot: 1,
        pass: 1,
        turnover: 1,
        foul: 120,
      },
      foulSubtypeWeights: {
        defensiveNonShooting: 1,
        defensiveShooting: 120,
        offensive: 1,
      },
    };
    const rng = createTestRng(7);
    const samples = 4000;
    for (let index = 0; index < samples; index += 1) {
      const decision = choosePossessionDecision(
        {
          offensiveTeamId: OFFENSE,
          defensiveTeamId: DEFENSE,
          offensivePlayers: pool.offensivePlayers,
          defensivePlayers: pool.defensivePlayers,
          config,
        },
        rng,
      );
      if (
        decision.action === "foul" &&
        decision.foul.foulType === "shooting"
      ) {
        const fouledId = decision.foul.fouledPlayerId;
        fouledCounts.set(fouledId, (fouledCounts.get(fouledId) ?? 0) + 1);
      }
    }
    expect(fouledCounts.get("star")!).toBeGreaterThan(
      fouledCounts.get("twelfth")!,
    );
    expect(fouledCounts.get("twelfth")!).toBeGreaterThan(0);
  });

  it("still returns a PossessionDecision union without resolving outcomes", () => {
    const pool = fiveManPool();
    const decision = choosePossessionDecision(
      {
        offensiveTeamId: OFFENSE,
        defensiveTeamId: DEFENSE,
        offensivePlayers: pool.offensivePlayers,
        defensivePlayers: pool.defensivePlayers,
        config: GAME_SIMULATION_CONFIG,
      },
      createTestRng(99),
    );
    expect(["shot", "pass", "turnover", "foul"]).toContain(decision.action);
  });
});
