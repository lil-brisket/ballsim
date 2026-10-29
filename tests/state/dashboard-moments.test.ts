import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { bootstrapWorld } from "@/systems/world-pipeline";
import type { GameState } from "@/state/game-state";
import { toDashboardMomentsView } from "@/state/dashboard-moments";
import { toAwardsNightView } from "@/state/awards-night-selectors";
import { toChampionMomentView } from "@/state/champion-moment-selectors";
import { toProgressionRevealView } from "@/state/progression-reveal-selectors";
import { toSeasonRecapView } from "@/state/season-recap-selectors";
import { createTestGameState } from "../factories/game-state";
import { seasonRecord, withFranchiseHistory } from "./history-fixtures";

vi.mock("@/state/awards-night-selectors", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/state/awards-night-selectors")>();
  return { ...actual, toAwardsNightView: vi.fn(actual.toAwardsNightView) };
});
vi.mock("@/state/champion-moment-selectors", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/state/champion-moment-selectors")>();
  return {
    ...actual,
    toChampionMomentView: vi.fn(actual.toChampionMomentView),
  };
});
vi.mock("@/state/progression-reveal-selectors", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/state/progression-reveal-selectors")
    >();
  return {
    ...actual,
    toProgressionRevealView: vi.fn(actual.toProgressionRevealView),
  };
});
vi.mock("@/state/season-recap-selectors", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/state/season-recap-selectors")>();
  return { ...actual, toSeasonRecapView: vi.fn(actual.toSeasonRecapView) };
});

const base = bootstrapWorld(
  createTestGameState({ saveId: "dashboard_moments" }),
  createSeededRng("dashboard-moments"),
).state;
const teamId = base.user.activeOwnerTeamId as string;

function inPhase(
  phase: GameState["competition"]["season"]["phase"],
): GameState {
  const state: GameState = {
    ...base,
    competition: {
      ...base.competition,
      season: { ...base.competition.season, phase },
    },
  };
  // A finalized season, so only the phase decides eligibility.
  return withFranchiseHistory(state, {
    [teamId]: [
      {
        ...seasonRecord({ year: state.competition.season.year }),
        seasonId: state.competition.season.id,
      },
    ],
  });
}

beforeEach(() => {
  vi.mocked(toAwardsNightView).mockClear();
  vi.mocked(toChampionMomentView).mockClear();
  vi.mocked(toProgressionRevealView).mockClear();
  vi.mocked(toSeasonRecapView).mockClear();
});

describe("toDashboardMomentsView eligibility", () => {
  it.each(["preseason", "regular", "playoffs"] as const)(
    "builds no view in the %s phase",
    (phase) => {
      const moments = toDashboardMomentsView(inPhase(phase));
      expect(moments).toEqual({
        teamId,
        awards: null,
        champion: null,
        progression: null,
        recap: null,
      });
      expect(toAwardsNightView).not.toHaveBeenCalled();
      expect(toChampionMomentView).not.toHaveBeenCalled();
      expect(toProgressionRevealView).not.toHaveBeenCalled();
      expect(toSeasonRecapView).not.toHaveBeenCalled();
    },
  );

  it("runs the progression selector in a finalized offseason", () => {
    toDashboardMomentsView(inPhase("offseason"));
    expect(toProgressionRevealView).toHaveBeenCalledTimes(1);
  });

  it("skips the progression selector when the season is not finalized", () => {
    const state = withFranchiseHistory(inPhase("offseason"), {});
    expect(toDashboardMomentsView(state).progression).toBeNull();
    expect(toProgressionRevealView).not.toHaveBeenCalled();
  });

  it("skips awards and champion without awards or a complete playoff run", () => {
    toDashboardMomentsView(inPhase("offseason"));
    expect(toAwardsNightView).not.toHaveBeenCalled();
    expect(toChampionMomentView).not.toHaveBeenCalled();
  });
});
