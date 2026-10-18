import { describe, expect, it } from "vitest";
import { addCalendarDays } from "@/domain/calendar-date";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import type { TeamId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import type { GameState } from "@/state/game-state";
import { isUserControlledTeam } from "@/state/owner-context";
import { runAiTeamDecisions } from "@/systems/ai-team-decisions";
import { checkTradeWindow } from "@/systems/league-rules/trade-rules";
import {
  isTradeSearchDue,
  teamTradeSearchKey,
  tradeMarketKey,
  withTradeSearchesRecorded,
} from "@/systems/trades/ai-trade-search-gate";
import { AI_TRADE_SEARCH_MAX_STALE_DAYS } from "@/systems/trades-config";
import { bootstrapWorld } from "@/systems/world-pipeline";

function leagueState(seed = 31): GameState {
  const state = createInitialGameState({
    saveId: "ai_trade_gate",
    rngSeed: seed,
    settings: CBL_GAME_SETTINGS,
  });
  return bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
}

function cpuTeamIds(state: GameState): TeamId[] {
  return (Object.keys(state.world.teams) as TeamId[])
    .filter((teamId) => !isUserControlledTeam(state, teamId))
    .sort();
}

function withDate(state: GameState, date: string): GameState {
  return {
    ...state,
    world: {
      ...state.world,
      calendar: { ...state.world.calendar, currentDate: date },
    },
  };
}

function keyFor(state: GameState, teamId: TeamId): string {
  return teamTradeSearchKey(state, teamId, tradeMarketKey(state));
}

function recorded(state: GameState, teamId: TeamId): GameState {
  return withTradeSearchesRecorded(
    state,
    new Map([[teamId, keyFor(state, teamId)]]),
  );
}

describe("AI trade search gate", () => {
  it("searches a team that has never searched", () => {
    const state = leagueState();
    const teamId = cpuTeamIds(state)[0]!;
    expect(isTradeSearchDue(state, teamId, keyFor(state, teamId))).toBe(true);
  });

  it("skips unchanged inputs until the stale cap, then searches again", () => {
    const state = leagueState();
    const teamId = cpuTeamIds(state)[0]!;
    const searched = recorded(state, teamId);
    const today = state.world.calendar.currentDate;

    for (let days = 0; days < AI_TRADE_SEARCH_MAX_STALE_DAYS; days += 1) {
      const later = withDate(searched, addCalendarDays(today, days));
      expect(isTradeSearchDue(later, teamId, keyFor(later, teamId))).toBe(
        false,
      );
    }
    const stale = withDate(
      searched,
      addCalendarDays(today, AI_TRADE_SEARCH_MAX_STALE_DAYS),
    );
    expect(isTradeSearchDue(stale, teamId, keyFor(stale, teamId))).toBe(true);
  });

  it("searches again when a roster changes anywhere in the league", () => {
    const state = leagueState();
    const [teamId, otherId] = cpuTeamIds(state);
    const searched = recorded(state, teamId!);
    const other = searched.world.teams[otherId!]!;
    const moved: GameState = {
      ...searched,
      world: {
        ...searched.world,
        teams: {
          ...searched.world.teams,
          [otherId!]: { ...other, roster: other.roster.slice(1) },
        },
      },
    };
    expect(isTradeSearchDue(moved, teamId!, keyFor(moved, teamId!))).toBe(true);
  });

  it("leaves day-to-day availability changes to the stale cap", () => {
    const state = leagueState();
    const [teamId, otherId] = cpuTeamIds(state);
    const searched = recorded(state, teamId!);
    const playerId = searched.world.teams[otherId!]!.roster[0]!;
    const player = searched.world.players[playerId]!;
    const injured: GameState = {
      ...searched,
      world: {
        ...searched.world,
        players: {
          ...searched.world.players,
          [playerId]: { ...player, availability: "out" },
        },
      },
    };
    expect(isTradeSearchDue(injured, teamId!, keyFor(injured, teamId!))).toBe(
      false,
    );
  });

  it("searches again when draft pick ownership changes", () => {
    const state = leagueState();
    const [teamId, otherId] = cpuTeamIds(state);
    const searched = recorded(state, teamId!);
    const pick = Object.values(searched.world.draftPicks).find(
      (candidate) => candidate.ownerTeamId !== otherId,
    )!;
    const traded: GameState = {
      ...searched,
      world: {
        ...searched.world,
        draftPicks: {
          ...searched.world.draftPicks,
          [pick.id]: { ...pick, ownerTeamId: otherId! },
        },
      },
    };
    expect(isTradeSearchDue(traded, teamId!, keyFor(traded, teamId!))).toBe(
      true,
    );
  });

  it("runs no CPU trade search when every team's inputs match its record", () => {
    const state = leagueState();
    expect(checkTradeWindow(state).allowed).toBe(true);
    // Without memory, CPU teams search: they either trade or record searches.
    const unguarded = runAiTeamDecisions(state, createSeededRng(7));
    const searched =
      unguarded.events.some((event) => event.type === "PlayerTraded") ||
      Object.keys(unguarded.state.competition.aiTradeSearch.byTeamId).length >
        0;
    expect(searched).toBe(true);

    const marketKey = tradeMarketKey(state);
    const remembered = withTradeSearchesRecorded(
      state,
      new Map(
        cpuTeamIds(state).map((teamId) => [
          teamId,
          teamTradeSearchKey(state, teamId, marketKey),
        ]),
      ),
    );
    const day = runAiTeamDecisions(remembered, createSeededRng(7));
    expect(day.events.some((event) => event.type === "PlayerTraded")).toBe(
      false,
    );
    expect(day.state.competition.aiTradeSearch).toEqual(
      remembered.competition.aiTradeSearch,
    );
  });
});
