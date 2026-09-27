import { describe, expect, it } from "vitest";
import {
  createEmptyPlayerSeasonStatLine,
  type PlayerSeasonRecord,
} from "@/domain/entities/player-history";
import { asPlayerId, asSeasonId } from "@/domain/ids";
import { changeFromHistory } from "@/state/player-overall-change";
import { createTestGameState } from "../factories/game-state";
import { createPlayer } from "../factories/player";

function seasonRecord(opts: {
  playerId: string;
  seasonYear: number;
  overall: number;
}): PlayerSeasonRecord {
  const player = createPlayer({ id: opts.playerId });
  return {
    seasonId: asSeasonId(`season_${opts.seasonYear}`),
    seasonYear: opts.seasonYear,
    age: 22,
    overall: opts.overall,
    attributes: player.attributes,
    developmentStage: "developing",
    injuryKind: "available",
    contractSnapshot: { contractId: null, salary: null, teamId: null },
    competition: {
      regular: createEmptyPlayerSeasonStatLine(),
      playoffs: createEmptyPlayerSeasonStatLine(),
      development: createEmptyPlayerSeasonStatLine(),
      combined: createEmptyPlayerSeasonStatLine(),
    },
  };
}

function withHistory(playerId: string, seasons: PlayerSeasonRecord[]) {
  const state = createTestGameState({ saveId: "ovr_change" });
  return {
    ...state,
    business: {
      ...state.business,
      playerHistory: {
        ...state.business.playerHistory,
        [playerId]: {
          playerId: asPlayerId(playerId),
          seasons,
          trackingStartedSeasonYear: seasons[0]?.seasonYear ?? null,
        },
      },
    },
  };
}

describe("changeFromHistory", () => {
  it("returns null delta when history is missing", () => {
    const state = createTestGameState({ saveId: "ovr_missing" });
    expect(changeFromHistory(state, "nobody", 74)).toEqual({
      delta: null,
      label: null,
    });
  });

  it("returns null delta when history has no seasons", () => {
    const state = withHistory("p1", []);
    expect(changeFromHistory(state, "p1", 74)).toEqual({
      delta: null,
      label: null,
    });
  });

  it("uses live overall vs last completed season when years differ", () => {
    const state = withHistory("p1", [
      seasonRecord({ playerId: "p1", seasonYear: 2025, overall: 70 }),
    ]);
    expect(state.competition.season.year).toBe(2026);
    expect(changeFromHistory(state, "p1", 74)).toEqual({
      delta: 4,
      label: "70 → 74",
    });
  });

  it("uses adjacent snapshots when the last record is the current year", () => {
    const state = withHistory("p1", [
      seasonRecord({ playerId: "p1", seasonYear: 2025, overall: 67 }),
      seasonRecord({ playerId: "p1", seasonYear: 2026, overall: 70 }),
    ]);
    expect(changeFromHistory(state, "p1", 72)).toEqual({
      delta: 3,
      label: "67 → 70",
    });
  });

  it("does not fabricate a prior when only one same-year snapshot exists", () => {
    const state = withHistory("p1", [
      seasonRecord({ playerId: "p1", seasonYear: 2026, overall: 71 }),
    ]);
    expect(changeFromHistory(state, "p1", 74)).toEqual({
      delta: null,
      label: "71",
    });
  });
});
