import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { asFanVoteCategoryId } from "@/domain/ids";
import type {
  FanVoteCampaign,
  FanVoteCategory,
} from "@/domain/entities/season-events";
import { createInitialGameState } from "@/state/create-initial-state";
import type { GameState } from "@/state/game-state";
import {
  FAN_VOTE_LEADERS_PER_CONFERENCE,
  toFanVotingHubView,
} from "@/state/fan-voting-selectors";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { generateRosters } from "@/systems/roster-generation";
import { beginRegularSeasonFromPreseason } from "@/systems/simulation/season-lifecycle";

function bootRegularSeason(): GameState {
  let state = createInitialGameState({
    saveId: "fan_vote_view",
    rngSeed: 7,
    settings: CBL_GAME_SETTINGS,
  });
  const rng = createSeededRng(state.meta.rngState);
  state = bootstrapWorld(state, rng).state;
  state = generateRosters(state, rng).state;
  return beginRegularSeasonFromPreseason(state).state;
}

function campaignOf(state: GameState): FanVoteCampaign {
  return Object.values(state.competition.seasonEvents.fanVoting)[0]!;
}

function withCategories(
  state: GameState,
  categories: FanVoteCategory[],
): GameState {
  const campaign = campaignOf(state);
  return {
    ...state,
    competition: {
      ...state.competition,
      seasonEvents: {
        ...state.competition.seasonEvents,
        fanVoting: {
          [campaign.id]: {
            ...campaign,
            categories: Object.fromEntries(categories.map((c) => [c.id, c])),
          },
        },
      },
    },
  };
}

/** Give every candidate a distinct vote total and its matching rank. */
function voted(category: FanVoteCategory, offset = 0): FanVoteCategory {
  const ids = Object.keys(category.candidates).sort();
  return {
    ...category,
    candidates: Object.fromEntries(
      ids.map((id, index) => [
        id,
        {
          ...category.candidates[id]!,
          voteTotal: 10_000 + offset - index * 10,
          rank: index + 1,
          previousRank: index + 2,
        },
      ]),
    ),
  };
}

describe("toFanVotingHubView", () => {
  it("lists one column per conference, top 12 by votes", () => {
    const state = bootRegularSeason();
    const categories = Object.values(campaignOf(state).categories).map((c) =>
      voted(c),
    );
    const hub = toFanVotingHubView(withCategories(state, categories));

    expect(hub.conferences).toHaveLength(2);
    const labels = hub.conferences.map((c) => c.label);
    expect(labels).toEqual([...labels].sort());
    for (const conference of hub.conferences) {
      expect(conference.label).toMatch(/ Conference$/);
      expect(conference.leaders).toHaveLength(FAN_VOTE_LEADERS_PER_CONFERENCE);
      expect(conference.leaders.map((r) => r.rank)).toEqual(
        Array.from({ length: 12 }, (_, i) => i + 1),
      );
      const votes = conference.leaders.map((r) => r.voteTotal);
      expect(votes).toEqual([...votes].sort((a, b) => b - a));
      expect(conference.leaders[0]!.movement).toBe("up");
    }
  });

  it("merges legacy position ballots by votes without movement", () => {
    const state = bootRegularSeason();
    const [open] = Object.values(campaignOf(state).categories);
    const conferenceId = open!.conferenceId!;
    const ids = Object.keys(open!.candidates).sort();
    const legacy = (kind: "guards" | "centers", slice: string[], offset = 0) =>
      voted(
        {
          id: asFanVoteCategoryId(`${conferenceId}_${kind}`),
          label: kind,
          kind,
          conferenceId,
          candidates: Object.fromEntries(
            slice.map((id) => [id, open!.candidates[id]!]),
          ),
        },
        offset,
      );
    // Centers outpoll guards, so the merged column must interleave by votes.
    const guards = legacy("guards", ids.slice(0, 8));
    const centers = legacy("centers", ids.slice(8, 16), 5);

    const hub = toFanVotingHubView(withCategories(state, [guards, centers]));
    expect(hub.conferences).toHaveLength(1);
    const column = hub.conferences[0]!;
    const conference = state.world.conferences[conferenceId]!;
    expect(column.label).toBe(`${conference.name} Conference`);
    expect(column.leaders.slice(0, 2).map((r) => r.playerId)).toEqual([
      ids[8],
      ids[0],
    ]);
    expect(column.leaders.every((r) => r.movement === "new")).toBe(true);
    expect(column.leaders.every((r) => r.previousRank === null)).toBe(true);
  });
});
