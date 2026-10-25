import { describe, expect, it } from "vitest";
import type { GameState } from "@/state/game-state";
import { getOwnedTeamIds, withOwnedFranchise } from "@/state/owner-context";
import { pruneExpiredGameplayConsequenceKeys } from "@/systems/gameplay-financial-consequences";
import { createTestGameState } from "../factories/game-state";

function withKeys(keys: string[]): GameState {
  const state = createTestGameState({ saveId: "consequence_pruning" });
  const teamId = getOwnedTeamIds(state)[0]!;
  return withOwnedFranchise(state, teamId, (franchise) => ({
    ...franchise,
    appliedGameplayConsequenceKeys: Object.fromEntries(
      keys.map((key) => [key, true as const]),
    ),
  }));
}

function keysOf(state: GameState): string[] {
  const teamId = getOwnedTeamIds(state)[0]!;
  return Object.keys(
    state.user.ownedFranchises[teamId]!.appliedGameplayConsequenceKeys,
  ).sort();
}

describe("pruneExpiredGameplayConsequenceKeys", () => {
  it("drops AI keys for past days and completed weeks only", () => {
    const state = withKeys([
      "ai_trade:2027-03-01",
      "ai_trade:2027-03-08",
      "ai_fa:team_a:2027-03-07",
      "ai_continuity:team_a:free_agency:2027-03-08",
      "ai_continuity:team_a:date_sync_draft:2027-03-01:2027-03-01",
      "ai_franchise:team_b:2027-W08",
      "ai_franchise:team_b:2027-W09",
      "ai_franchise:team_b:pre",
      "ai_game_day_promo:team_b:2027-W08",
    ]);
    const pruned = pruneExpiredGameplayConsequenceKeys(
      state,
      "2027-03-08",
      "2027-W09",
    );
    expect(keysOf(pruned)).toEqual([
      "ai_continuity:team_a:free_agency:2027-03-08",
      "ai_franchise:team_b:2027-W09",
      "ai_franchise:team_b:pre",
      "ai_trade:2027-03-08",
    ]);
  });

  it("drops ticket keys from seasons before the current one", () => {
    const base = withKeys([
      "tickets:team_a:2026:game_season_2026_4",
      "tickets:team_a:2027:playoff_season_2027_playoff_r1_s0_g1",
      "tickets:team_a:2028:game_season_2028_1",
    ]);
    const state: GameState = {
      ...base,
      competition: {
        ...base.competition,
        season: { ...base.competition.season, year: 2028 },
      },
    };
    const pruned = pruneExpiredGameplayConsequenceKeys(
      state,
      "2028-11-01",
      "2028-W44",
    );
    expect(keysOf(pruned)).toEqual(["tickets:team_a:2028:game_season_2028_1"]);
  });

  it("keeps keys that can be checked again in a later season", () => {
    const keys = [
      "ai_draft:pick_team_a_2027_r1",
      "ai_continuity_draft:pick_team_a_2027_r1",
      "tickets:team_a:game_season_2026_4",
      "game_result:team_a:game_season_2026_4",
      "objective_reward:obj_milestone_first_playoffs",
      "playoff_series_win:team_a:2026:0",
      "player_retired:player_x:2026",
    ];
    const state = withKeys(keys);
    const pruned = pruneExpiredGameplayConsequenceKeys(
      state,
      "2030-01-01",
      "2030-W01",
    );
    expect(keysOf(pruned)).toEqual([...keys].sort());
    expect(pruned).toBe(state);
  });
});
