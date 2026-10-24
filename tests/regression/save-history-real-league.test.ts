import { beforeAll, describe, expect, it } from "vitest";
import type { PlayerId } from "@/domain/ids";
import { validateGameState } from "@/persistence/validate-game-state";
import {
  mergeSaveHistory,
  splitColdHistory,
  withSaveHistory,
} from "@/persistence/save-history";
import type { GameState } from "@/state/game-state";
import { toRecordBookView } from "@/state/legacy-selectors";
import {
  deriveCareerHighs,
  derivePlayerTeamStints,
  toPlayerCareerStatsView,
  toPlayerGameLogView,
  toPlayerSeasonStatsViews,
} from "@/state/player-profile-selectors";
import { getActivePhaseId } from "@/systems/phase-engine";
import {
  advanceThroughPhase,
  createOffseasonLeague,
} from "../offseason/driver";
import { stateForComparison } from "../offseason/snapshot";

/**
 * Finished-season history leaves the per-action snapshot (save-history.ts).
 * On a real league three seasons in: the views that show past seasons are
 * unchanged once the history is loaded back, and the simulation never needs
 * it — a full offseason run from the snapshot alone matches the run from
 * the whole league.
 */
let league: GameState;

beforeAll(() => {
  let state = createOffseasonLeague(17, "delegated");
  const firstYear = state.competition.season.year;
  // Into the third season's offseason: at least one season is cold.
  while (!(
    state.competition.season.year === firstYear + 2 &&
    getActivePhaseId(state) === "offseason.season_transition"
  )) {
    state = advanceThroughPhase(state, getActivePhaseId(state)).state;
  }
  league = state;
}, 600_000);

function restored(state: GameState): GameState {
  const { hot, chunks } = splitColdHistory(state);
  return withSaveHistory(hot, mergeSaveHistory(chunks.map((c) => c.history)));
}

describe("save history on a real league", () => {
  it("moves old seasons out, validates, and restores exactly", () => {
    const { hot, chunks } = splitColdHistory(league);
    expect(chunks.some((chunk) => chunk.chunkId.startsWith("games:"))).toBe(
      true,
    );
    expect(chunks.some((chunk) => chunk.chunkId.startsWith("draft:"))).toBe(
      true,
    );
    validateGameState(hot);
    expect(Object.keys(hot.business.gameArchive).length).toBeLessThan(
      Object.keys(league.business.gameArchive).length,
    );
    expect(restored(league)).toEqual(league);
  });

  it("shows the same careers and record book once the history is loaded", () => {
    const back = restored(league);
    expect(toRecordBookView(back)).toEqual(toRecordBookView(league));
    for (const playerId of Object.keys(league.world.players) as PlayerId[]) {
      const player = league.world.players[playerId]!;
      const current = { age: player.age, overall: 0 };
      const seasonsOf = (state: GameState) =>
        toPlayerSeasonStatsViews(
          state,
          playerId,
          state.business.playerHistory[playerId],
          current,
        );
      expect(seasonsOf(back)).toEqual(seasonsOf(league));
      expect(toPlayerCareerStatsView(seasonsOf(back))).toEqual(
        toPlayerCareerStatsView(seasonsOf(league)),
      );
      expect(deriveCareerHighs(back, playerId)).toEqual(
        deriveCareerHighs(league, playerId),
      );
      expect(derivePlayerTeamStints(back, playerId)).toEqual(
        derivePlayerTeamStints(league, playerId),
      );
      expect(toPlayerGameLogView(back, playerId)).toEqual(
        toPlayerGameLogView(league, playerId),
      );
    }
  });

  it("simulates a full offseason the same from the snapshot alone", () => {
    let whole = league;
    let snapshot = splitColdHistory(league).hot;
    for (let step = 0; step < 9; step += 1) {
      const phaseId = getActivePhaseId(whole);
      expect(getActivePhaseId(snapshot)).toBe(phaseId);
      whole = advanceThroughPhase(whole, phaseId).state;
      snapshot = splitColdHistory(
        advanceThroughPhase(snapshot, phaseId).state,
      ).hot;
      expect(stateForComparison(snapshot), `after ${phaseId}`).toEqual(
        stateForComparison(splitColdHistory(whole).hot),
      );
      if (getActivePhaseId(whole) === "regular") break;
    }
    expect(getActivePhaseId(whole)).toBe("regular");
  }, 600_000);
});
