import { describe, expect, it } from "vitest";
import { addCalendarDays } from "@/domain/calendar-date";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import type { TeamId } from "@/domain/ids";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import type { GameState } from "@/state/game-state";
import { isUserControlledTeam } from "@/state/owner-context";
import {
  cpuOfferClosedReason,
  resolvePendingOwnerDecision,
  tryEnqueueCpuToUserTradeOffer,
} from "@/systems/owner-decisions";
import {
  USER_TRADE_OFFER_MIN_DAYS_BETWEEN,
  USER_TRADE_OFFER_MIN_FAIRNESS,
  USER_TRADE_OFFER_SEASON_GRACE_DAYS,
  USER_TRADE_OFFER_TARGET_MIN_OVERALL,
} from "@/systems/owner-decisions/owner-decision-config";
import { beginRegularSeasonFromPreseason } from "@/systems/simulation/season-lifecycle";
import { getTeamAssetValue } from "@/systems/trades/asset-valuation/team-asset-value";
import { bootstrapWorld } from "@/systems/world-pipeline";

function preseasonState(): GameState {
  const state = createInitialGameState({
    saveId: "targeted_offer",
    rngSeed: 52,
    settings: CBL_GAME_SETTINGS,
  });
  return bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
}

function openingNightState(): GameState {
  return beginRegularSeasonFromPreseason(preseasonState()).state;
}

/** Regular season, past the opening grace period, so offers may be made. */
function leagueState(): GameState {
  const state = openingNightState();
  return withDate(
    state,
    addCalendarDays(
      state.competition.season.regularSeasonStartDate!,
      USER_TRADE_OFFER_SEASON_GRACE_DAYS,
    ),
  );
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

/** First CPU team (id order) that queues an offer, with the resulting state. */
function firstQueuedOffer(state: GameState) {
  for (const teamId of cpuTeamIds(state)) {
    const result = tryEnqueueCpuToUserTradeOffer(state, teamId);
    if (result.outcome === "queued") {
      return { teamId, result };
    }
  }
  return null;
}

describe("CPU → owner trade offers", () => {
  it("makes no offers in preseason or the opening grace period", () => {
    const expectClosed = (state: GameState) => {
      for (const teamId of cpuTeamIds(state)) {
        const result = tryEnqueueCpuToUserTradeOffer(state, teamId);
        expect(result.outcome).toBe("skipped");
        expect(result.reason).toBe("offer_season_window");
      }
    };
    expectClosed(preseasonState());
    const opener = openingNightState();
    expectClosed(opener);
    expectClosed(
      withDate(
        opener,
        addCalendarDays(
          opener.competition.season.regularSeasonStartDate!,
          USER_TRADE_OFFER_SEASON_GRACE_DAYS - 1,
        ),
      ),
    );
  });

  it("offers the owner a fair swap for a rotation player", () => {
    const state = leagueState();
    const userId = state.user.activeOwnerTeamId;
    const found = firstQueuedOffer(state);
    expect(found).not.toBeNull();

    const decision = found!.result.decision!;
    expect(decision.type).toBe("trade_offer");
    const proposal = (
      decision.payload as {
        proposal: {
          sideA: { teamId: TeamId; playerIds: string[] };
          sideB: { teamId: TeamId; playerIds: string[] };
        };
      }
    ).proposal;
    const userSide =
      proposal.sideA.teamId === userId ? proposal.sideA : proposal.sideB;
    const cpuSide =
      proposal.sideA.teamId === userId ? proposal.sideB : proposal.sideA;
    expect(userSide.playerIds.length).toBeGreaterThan(0);

    for (const playerId of userSide.playerIds) {
      const player = state.world.players[playerId]!;
      expect(
        calculatePlayerOverall(player.position, player.attributes),
      ).toBeGreaterThanOrEqual(USER_TRADE_OFFER_TARGET_MIN_OVERALL);
    }
    const value = (ids: string[]) =>
      ids.reduce(
        (sum, playerId) =>
          sum +
          getTeamAssetValue(state, userId, {
            kind: "player",
            playerId: playerId as never,
          }).value,
        0,
      );
    expect(value(cpuSide.playerIds)).toBeGreaterThanOrEqual(
      value(userSide.playerIds) * USER_TRADE_OFFER_MIN_FAIRNESS,
    );
  });

  it(`spaces offers at least ${USER_TRADE_OFFER_MIN_DAYS_BETWEEN} days apart`, () => {
    const state = leagueState();
    const found = firstQueuedOffer(state)!;
    const declined = resolvePendingOwnerDecision(found.result.state, {
      decisionId: found.result.decision!.id,
      status: "declined",
      decisionSource: "owner",
    }).state;
    const today = state.world.calendar.currentDate;

    const tooSoon = withDate(
      declined,
      addCalendarDays(today, USER_TRADE_OFFER_MIN_DAYS_BETWEEN - 1),
    );
    for (const teamId of cpuTeamIds(tooSoon)) {
      const result = tryEnqueueCpuToUserTradeOffer(tooSoon, teamId);
      expect(result.outcome).toBe("skipped");
      expect(result.reason).toBe("offer_spacing");
    }

    // The window reopens on day N. (This short CBL season's deadline has
    // passed by then, so check the window itself rather than a new offer.)
    const reopened = withDate(
      declined,
      addCalendarDays(today, USER_TRADE_OFFER_MIN_DAYS_BETWEEN),
    );
    expect(cpuOfferClosedReason(reopened)).toBeNull();
  });
});
