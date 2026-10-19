import { describe, expect, it } from "vitest";
import { teamFoulsAt } from "@/state/watch-game-selectors";
import { FOUL_RESOLUTION_CONFIG } from "@/systems/foul-resolution-config";
import type { WatchSide } from "@/state/watch-game-view";
import { fixtureView, type FixturePlay } from "../helpers/watch-view";

const THRESHOLD = FOUL_RESOLUTION_CONFIG.bonusThreshold;

let poss = 0;
const foul = (
  side: WatchSide,
  kind: "shooting_foul" | "personal_foul" | "offensive_foul" = "personal_foul",
  period = 1,
): FixturePlay => {
  poss += 1;
  return {
    period,
    poss,
    kind,
    side,
    playerId: `${side === 0 ? "h" : "a"}1`,
    player2Id: `${side === 0 ? "a" : "h"}2`,
  };
};

const make = (side: WatchSide, period = 1): FixturePlay => {
  poss += 1;
  return {
    period,
    poss,
    kind: "two_made",
    side,
    playerId: `${side === 0 ? "h" : "a"}3`,
    points: 2,
  };
};

describe("teamFoulsAt", () => {
  it("is zero before tip-off", () => {
    const view = fixtureView("g_tf", [foul(1)]);
    expect(teamFoulsAt(view, 0)).toEqual({
      fouls: [0, 0],
      bonus: [false, false],
    });
  });

  it("counts shooting and personal fouls by the team that committed them", () => {
    const view = fixtureView("g_tf", [
      foul(1, "shooting_foul"),
      foul(1, "personal_foul"),
      foul(0, "personal_foul"),
      make(0),
    ]);
    expect(teamFoulsAt(view, 1).fouls).toEqual([0, 1]);
    expect(teamFoulsAt(view, 2).fouls).toEqual([0, 2]);
    expect(teamFoulsAt(view, 4).fouls).toEqual([1, 2]);
  });

  it("does not count offensive fouls", () => {
    const view = fixtureView("g_tf", [
      foul(0, "offensive_foul"),
      foul(0, "offensive_foul"),
      foul(0, "personal_foul"),
    ]);
    expect(teamFoulsAt(view, 3).fouls).toEqual([1, 0]);
    const many = fixtureView(
      "g_tf",
      Array.from({ length: THRESHOLD + 2 }, () => foul(1, "offensive_foul")),
    );
    expect(teamFoulsAt(many, many.plays.length)).toEqual({
      fouls: [0, 0],
      bonus: [false, false],
    });
  });

  it("puts the other team in the bonus one foul short of the configured threshold", () => {
    const fouls = Array.from({ length: THRESHOLD }, () => foul(1));
    const view = fixtureView("g_tf", fouls);
    expect(teamFoulsAt(view, THRESHOLD - 2).bonus).toEqual([false, false]);
    // One short: the next foul on away is the one that shoots.
    expect(teamFoulsAt(view, THRESHOLD - 1)).toEqual({
      fouls: [0, THRESHOLD - 1],
      bonus: [true, false],
    });
    expect(teamFoulsAt(view, THRESHOLD).bonus).toEqual([true, false]);
  });

  it("puts the away team in the bonus on home fouls", () => {
    const view = fixtureView(
      "g_tf",
      Array.from({ length: THRESHOLD - 1 }, () => foul(0, "shooting_foul")),
    );
    expect(teamFoulsAt(view, view.plays.length).bonus).toEqual([false, true]);
  });

  it("restarts the count every period, overtime included", () => {
    const view = fixtureView("g_tf", [
      ...Array.from({ length: THRESHOLD }, () => foul(1)),
      foul(0, "personal_foul", 2),
      foul(1, "personal_foul", 5),
    ]);
    // Q1 is all the fouls so far.
    expect(teamFoulsAt(view, THRESHOLD).fouls).toEqual([0, THRESHOLD]);
    // The first Q2 play starts a fresh count and a fresh bonus.
    expect(teamFoulsAt(view, THRESHOLD + 1)).toEqual({
      fouls: [1, 0],
      bonus: [false, false],
    });
    // Overtime too.
    expect(teamFoulsAt(view, THRESHOLD + 2)).toEqual({
      fouls: [0, 1],
      bonus: [false, false],
    });
  });
});
