import { describe, expect, it } from "vitest";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import type { PlayerId, TeamId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import { validateGameState } from "@/persistence/validate-game-state";
import { createInitialGameState } from "@/state/create-initial-state";
import type { GameState } from "@/state/game-state";
import {
  getPlayerMorale,
  MORALE_TRADE_REQUEST_WEEKS,
  moraleTarget,
  processWeeklyMorale,
} from "@/systems/player-morale";
import { setActivePhase } from "@/systems/phase-engine";
import { beginRegularSeasonFromPreseason } from "@/systems/simulation/season-lifecycle";
import { bootstrapWorld } from "@/systems/world-pipeline";

function inSeason(): GameState {
  const initial = createInitialGameState({
    saveId: "morale",
    rngSeed: 81,
    settings: CBL_GAME_SETTINGS,
  });
  const state = bootstrapWorld(
    initial,
    createSeededRng(initial.meta.rngState),
  ).state;
  return beginRegularSeasonFromPreseason(state).state;
}

function firstTeam(state: GameState): TeamId {
  return Object.keys(state.world.teams).sort()[0] as TeamId;
}

function setMinutes(
  state: GameState,
  teamId: TeamId,
  playerId: PlayerId,
  minutes: number,
): GameState {
  const team = state.world.teams[teamId]!;
  const rotation = team.rosterManagement.rotation.map((entry) =>
    entry.playerId === playerId ? { ...entry, targetMinutes: minutes } : entry,
  );
  return {
    ...state,
    world: {
      ...state.world,
      teams: {
        ...state.world.teams,
        [teamId]: {
          ...team,
          rosterManagement: { ...team.rosterManagement, rotation },
        },
      },
    },
  };
}

function withRecord(
  state: GameState,
  teamId: TeamId,
  wins: number,
  losses: number,
): GameState {
  return {
    ...state,
    competition: {
      ...state.competition,
      standings: {
        byTeamId: {
          ...state.competition.standings.byTeamId,
          [teamId]: {
            ...state.competition.standings.byTeamId[teamId]!,
            wins,
            losses,
          },
        },
      },
    },
  };
}

/** The team's best player by planned minutes (a starter). */
function starter(state: GameState, teamId: TeamId): PlayerId {
  const rotation = [...state.world.teams[teamId]!.rosterManagement.rotation];
  rotation.sort((a, b) => b.targetMinutes - a.targetMinutes);
  return rotation[0]!.playerId;
}

describe("morale drivers", () => {
  it("drop when a starter loses his minutes", () => {
    const state = inSeason();
    const teamId = firstTeam(state);
    const playerId = starter(state, teamId);
    const benched = setMinutes(state, teamId, playerId, 0);
    expect(moraleTarget(benched, playerId, teamId).target).toBeLessThan(
      moraleTarget(state, playerId, teamId).target,
    );
  });

  it("rise with winning and fall with losing", () => {
    const state = inSeason();
    const teamId = firstTeam(state);
    const playerId = starter(state, teamId);
    const winning = withRecord(state, teamId, 18, 2);
    const losing = withRecord(state, teamId, 2, 18);
    expect(moraleTarget(winning, playerId, teamId).target).toBeGreaterThan(
      moraleTarget(losing, playerId, teamId).target,
    );
  });
});

describe("processWeeklyMorale", () => {
  it("moves morale toward the target and stays valid", () => {
    const state = withRecord(inSeason(), firstTeam(inSeason()), 2, 18);
    const teamId = firstTeam(state);
    const playerId = starter(state, teamId);
    const next = processWeeklyMorale(state).state;
    const before = getPlayerMorale(state, playerId).value;
    const after = getPlayerMorale(next, playerId).value;
    const target = moraleTarget(state, playerId, teamId).target;
    expect(Math.abs(target - after)).toBeLessThan(Math.abs(target - before));
    expect(() => validateGameState(next)).not.toThrow();
  });

  it("asks for a trade after weeks of misery, once a season", () => {
    let state = inSeason();
    const teamId = firstTeam(state);
    const playerId = starter(state, teamId);
    state = withRecord(setMinutes(state, teamId, playerId, 0), teamId, 0, 20);
    const requests: number[] = [];
    for (let week = 0; week < MORALE_TRADE_REQUEST_WEEKS + 12; week += 1) {
      const result = processWeeklyMorale(state);
      state = result.state;
      if (
        result.events.some(
          (e) =>
            e.type === "PlayerTradeRequested" &&
            e.payload.playerId === playerId,
        )
      ) {
        requests.push(week);
      }
    }
    expect(requests).toHaveLength(1);
    expect(requests[0]!).toBeGreaterThanOrEqual(MORALE_TRADE_REQUEST_WEEKS - 1);
    expect(getPlayerMorale(state, playerId).tradeRequestSeason).toBe(
      state.competition.season.year,
    );
  });

  it("does nothing outside the season", () => {
    const state = setActivePhase(inSeason(), "offseason.draft");
    expect(processWeeklyMorale(state).state).toBe(state);
  });

  it("is deterministic", () => {
    const run = () =>
      JSON.stringify(
        processWeeklyMorale(inSeason()).state.business.playerMorale,
      );
    expect(run()).toBe(run());
  });
});
