/**
 * Multi-franchise calendar scoping: "Your Team" views must follow
 * activeOwnerTeamId, not ownedTeamIds[0] or any other owned franchise.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/persistence/save-game-repository", () => ({
  prismaSaveGameStore: {
    list: vi.fn(),
    create: vi.fn(),
    load: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  },
}));

import { loadCalendarPageView, switchActiveOwnerTeam } from "@/application/game-service";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createSeededRng } from "@/domain/rng";
import { createMemorySaveGameStore } from "@/persistence/memory-save-game-store";
import { createInitialGameState } from "@/state/create-initial-state";
import { withActiveOwnerTeam } from "@/state/owner-context";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { beginRegularSeasonFromPreseason } from "@/systems/simulation/season-lifecycle";
import { resetDomainEventSequenceForTests } from "@/domain/events/domain-event";
import {
  buildCalendarDateInspectorView,
  getCalendarMonthGrid,
  getNextTeamGameDate,
} from "@/systems/calendar";
import { parseCalendarDate } from "@/domain/calendar-date";
import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";

function withTwoOwnedTeams(state: GameState): {
  state: GameState;
  teamA: TeamId;
  teamB: TeamId;
} {
  const teamA = state.user.activeOwnerTeamId;
  const teamB = Object.keys(state.world.teams).find(
    (id) => id !== teamA,
  ) as TeamId;
  const franchiseA = state.user.ownedFranchises[teamA]!;
  return {
    teamA,
    teamB,
    state: {
      ...state,
      user: {
        ...state.user,
        ownedTeamIds: [teamA, teamB],
        activeOwnerTeamId: teamA,
        ownedFranchises: {
          ...state.user.ownedFranchises,
          [teamB]: { ...franchiseA },
        },
      },
    },
  };
}

async function seedMultiTeamSave(id: string, seed: number) {
  resetDomainEventSequenceForTests();
  const store = createMemorySaveGameStore();
  let state = createInitialGameState({
    saveId: id,
    rngSeed: seed,
    settings: CBL_GAME_SETTINGS,
  });
  const rng = createSeededRng(state.meta.rngState);
  state = bootstrapWorld(state, rng).state;
  state = beginRegularSeasonFromPreseason(state).state;
  const dual = withTwoOwnedTeams(state);
  state = {
    ...dual.state,
    meta: {
      ...dual.state.meta,
      rngState: rng.getState(),
    },
  };
  await store.create({ id, name: id, state });
  return { store, teamA: dual.teamA, teamB: dual.teamB, state };
}

describe("active owner calendar scope", () => {
  it("scopes month grid / inspector / next game to activeOwnerTeamId only", async () => {
    const saveId = "active_owner_cal";
    const { store, teamA, teamB } = await seedMultiTeamSave(saveId, 88);

    const viewA = await loadCalendarPageView(saveId, {}, store);
    expect(viewA).not.toBeNull();
    expect(viewA!.userTeamId).toBe(teamA);
    expect(viewA!.dashboard.controlledTeam.id).toBe(teamA);

    const nextA = viewA!.nextTeamGameDate;
    expect(nextA).not.toBeNull();
    if (nextA) {
      const loadedA = await store.load(saveId);
      const { year, month } = parseCalendarDate(nextA);
      const grid = getCalendarMonthGrid(loadedA!.state, year, month, {
        teamId: teamA,
      });
      const flagged = grid.weeks.flat().filter((c) => c.isNextTeamGame);
      expect(flagged).toHaveLength(1);
      expect(flagged[0]!.teamGame).not.toBeNull();

      for (const cell of grid.weeks.flat()) {
        if (cell.teamGame) {
          expect(cell.teamGame.opponentTeamId).not.toBe(teamA);
        }
        for (const event of cell.events) {
          if (event.category === "game") {
            expect(event.teamIds?.includes(teamA)).toBe(true);
            if (
              event.teamIds?.includes(teamB) &&
              !event.teamIds.includes(teamA)
            ) {
              expect.fail("Team B-only game appeared while Team A is active");
            }
          }
        }
      }
    }

    const switched = await switchActiveOwnerTeam(saveId, teamB, store);
    expect(switched.ok).toBe(true);

    const viewB = await loadCalendarPageView(saveId, {}, store);
    expect(viewB).not.toBeNull();
    expect(viewB!.userTeamId).toBe(teamB);
    expect(viewB!.dashboard.controlledTeam.id).toBe(teamB);

    const loadedB = await store.load(saveId);
    expect(loadedB!.state.user.activeOwnerTeamId).toBe(teamB);
    const nextB = getNextTeamGameDate(loadedB!.state, teamB);
    const nextAStill = getNextTeamGameDate(loadedB!.state, teamA);
    expect(nextB).not.toBeNull();

    const inspectorB = buildCalendarDateInspectorView(
      loadedB!.state,
      nextB!,
      { saveId },
    );
    if (inspectorB.teamGame) {
      expect(inspectorB.teamGame.opponentTeamId).not.toBe(teamB);
    }

    // Switching back isolates A again
    const back = withActiveOwnerTeam(loadedB!.state, teamA);
    expect(getNextTeamGameDate(back, teamA)).toBe(nextAStill);
    expect(back.user.activeOwnerTeamId).toBe(teamA);
  });

  it("month grid only shows games for the active controlled team", async () => {
    const saveId = "active_owner_density";
    const { store, teamA, state } = await seedMultiTeamSave(saveId, 91);
    const opener =
      state.competition.season.regularSeasonStartDate ??
      state.world.calendar.currentDate;
    const { year, month } = parseCalendarDate(opener);
    const grid = getCalendarMonthGrid(state, year, month, { teamId: teamA });
    const teamGameDays = grid.weeks.flat().filter((c) => c.teamGame != null);
    // CBL 22-game season: not a game every day of the opener month.
    expect(teamGameDays.length).toBeGreaterThan(0);
    expect(teamGameDays.length).toBeLessThan(28);
    for (const cell of teamGameDays) {
      expect(cell.teamGame!.opponentTeamId).not.toBe(teamA);
      const dayGames = Object.values(state.competition.games).filter(
        (g) =>
          g.date === cell.date &&
          (g.homeTeamId === teamA || g.awayTeamId === teamA),
      );
      expect(dayGames.length).toBeGreaterThanOrEqual(1);
    }
  });
});
