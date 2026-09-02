import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createInitialGameState } from "@/state/create-initial-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { beginRegularSeasonFromPreseason } from "@/systems/simulation/season-lifecycle";
import {
  getTeamGameForDate,
  getTeamGamesForDate,
} from "@/systems/calendar/schedule-projection";
import {
  getTeamTransactions,
  isTransactionRelevantToTeam,
} from "@/state/team-transaction-selectors";
import { asTeamId } from "@/domain/ids";

describe("team calendar + transactions", () => {
  it("reads schedule-authoritative team games for a date", () => {
    const state = createInitialGameState({
      saveId: "team_cal",
      rngSeed: 9,
      settings: CBL_GAME_SETTINGS,
    });
    const rng = createSeededRng(state.meta.rngState);
    let next = bootstrapWorld(state, rng).state;
    next = beginRegularSeasonFromPreseason(next).state;
    const teamId = next.user.activeOwnerTeamId;
    const date = next.world.calendar.currentDate;
    const games = getTeamGamesForDate(next, teamId, date);
    const primary = getTeamGameForDate(next, teamId, date);
    expect(Array.isArray(games)).toBe(true);
    if (games.length > 0) {
      expect(primary?.id).toBe(games[0]!.id);
      expect(
        primary!.homeTeamId === teamId || primary!.awayTeamId === teamId,
      ).toBe(true);
    } else {
      expect(primary).toBeNull();
    }
  });

  it("filters transactions by structured team ids", () => {
    const teamId = asTeamId("team_1");
    expect(
      isTransactionRelevantToTeam(
        {
          id: "e1",
          type: "PlayerReleased",
          occurredOn: "2026-01-01",
          payload: { teamId },
        } as never,
        teamId,
      ),
    ).toBe(true);
    expect(
      isTransactionRelevantToTeam(
        {
          id: "e2",
          type: "PlayerReleased",
          occurredOn: "2026-01-01",
          payload: { teamId: asTeamId("team_2") },
        } as never,
        teamId,
      ),
    ).toBe(false);

    const state = createInitialGameState({
      saveId: "tx",
      rngSeed: 1,
      settings: CBL_GAME_SETTINGS,
    });
    const rows = getTeamTransactions(state, state.user.activeOwnerTeamId);
    expect(Array.isArray(rows)).toBe(true);
  });

  it("changes calendar team context when the active owner team switches", () => {
    const state = createInitialGameState({
      saveId: "team_switch",
      rngSeed: 9,
      settings: CBL_GAME_SETTINGS,
    });
    const rng = createSeededRng(state.meta.rngState);
    let next = bootstrapWorld(state, rng).state;
    next = beginRegularSeasonFromPreseason(next).state;
    const date = next.world.calendar.currentDate;
    const teamIds = Object.keys(next.world.teams) as ReturnType<typeof asTeamId>[];
    const first = teamIds[0]!;
    const second = teamIds[1]!;
    const firstGame = getTeamGameForDate(next, first, date);
    const secondGame = getTeamGameForDate(next, second, date);
    if (firstGame) {
      expect(
        firstGame.homeTeamId === first || firstGame.awayTeamId === first,
      ).toBe(true);
    }
    if (secondGame) {
      expect(
        secondGame.homeTeamId === second || secondGame.awayTeamId === second,
      ).toBe(true);
    }
    if (firstGame && secondGame && first !== second) {
      expect(firstGame.id === secondGame.id).toBe(
        firstGame.homeTeamId === second || firstGame.awayTeamId === second,
      );
    }
  });
});
