import { describe, expect, it } from "vitest";
import { cloneGameSettings, CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { type TeamId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import { toFantasyDraftSummaryView, toFantasyDraftView } from "@/state/selectors";
import {
  advanceFantasyDraftClock,
  analyzeFantasyDraft,
  confirmFantasyDraftOrder,
  FANTASY_DRAFT_PICKS_PER_TEAM,
  setDefaultDraftOrder,
  setFantasyDraftAutoPickAll,
} from "@/systems/fantasy-draft";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { TEST_NOW_ISO, TEST_RNG_SEED } from "../../helpers/determinism";
import { resetDomainEventSequenceForTests } from "@/domain/events/domain-event";

function fantasySettings(teamCount = 8) {
  const settings = cloneGameSettings(CBL_GAME_SETTINGS);
  settings.league.teamCount = teamCount;
  settings.playoffs.playoffTeams = Math.min(8, teamCount);
  settings.draft.mode = "fantasy";
  settings.draft.type = "snake";
  settings.draft.orderMode = "random";
  settings.draft.timerSeconds = null;
  return settings;
}

function createFantasyState(teamCount = 8) {
  resetDomainEventSequenceForTests();
  let state = createInitialGameState({
    saveId: "save_fantasy_analysis",
    rngSeed: TEST_RNG_SEED,
    nowIso: TEST_NOW_ISO,
    settings: fantasySettings(teamCount),
  });
  const rng = createSeededRng(state.meta.rngState);
  const boot = bootstrapWorld(state, rng);
  state = {
    ...boot.state,
    meta: { ...boot.state.meta, rngState: rng.getState() },
  };
  return state;
}

describe("fantasy draft analysis", () => {
  it(
    "persists pick analyses, team summaries, and league recap on completion",
    () => {
      let state = createFantasyState(8);
      const teamIds = Object.keys(state.world.teams) as TeamId[];
      state = {
        ...state,
        user: {
          ...state.user,
          ownedTeamIds: [teamIds[0]!, teamIds[1]!],
          activeOwnerTeamId: teamIds[0]!,
          ownedFranchises: {
            [teamIds[0]!]:
              state.user.ownedFranchises[state.user.activeOwnerTeamId]!,
            [teamIds[1]!]: {
              ...state.user.ownedFranchises[state.user.activeOwnerTeamId]!,
            },
          },
        },
      };
      state = setDefaultDraftOrder(state);
      state = confirmFantasyDraftOrder(state, TEST_NOW_ISO);
      state = setFantasyDraftAutoPickAll(state, true);
      state = advanceFantasyDraftClock(state, TEST_NOW_ISO).state;

      expect(state.world.fantasyDraft!.status).toBe("complete");
      expect(state.world.fantasyDraft!.pickAnalyses.length).toBe(
        state.world.fantasyDraft!.totalPicks,
      );
      expect(
        Object.keys(state.world.fantasyDraft!.teamSummaries).length,
      ).toBe(8);
      expect(state.world.fantasyDraft!.leagueRecap).not.toBeNull();
      expect(state.world.fantasyDraft!.leagueRecap!.bestDraft).not.toBeNull();

      const ownedSummary =
        state.world.fantasyDraft!.teamSummaries[teamIds[0]!];
      expect(ownedSummary).toBeDefined();
      expect(ownedSummary!.playerCount).toBe(FANTASY_DRAFT_PICKS_PER_TEAM);
      expect(ownedSummary!.draftGrade.length).toBeGreaterThan(0);
      expect(ownedSummary!.pickBreakdown.length).toBe(
        FANTASY_DRAFT_PICKS_PER_TEAM,
      );
      expect(ownedSummary!.draftVerdict.length).toBeGreaterThan(0);
      expect(ownedSummary!.recommendedNextSteps.length).toBeGreaterThan(0);

      const summaryView = toFantasyDraftSummaryView(state);
      expect(summaryView).not.toBeNull();
      expect(summaryView!.controlledTeamIds).toEqual([
        teamIds[0],
        teamIds[1],
      ]);
      expect(summaryView!.teamSummaries[teamIds[0]!]?.draftGrade).toBe(
        ownedSummary!.draftGrade,
      );
    },
    60_000,
  );

  it("activeOwnerTeamId drives live view roster/queue context", () => {
    let state = createFantasyState(8);
    const teamIds = Object.keys(state.world.teams) as TeamId[];
    state = {
      ...state,
      user: {
        ...state.user,
        ownedTeamIds: [teamIds[0]!, teamIds[1]!],
        activeOwnerTeamId: teamIds[1]!,
        ownedFranchises: {
          [teamIds[0]!]:
            state.user.ownedFranchises[state.user.activeOwnerTeamId]!,
          [teamIds[1]!]: {
            ...state.user.ownedFranchises[state.user.activeOwnerTeamId]!,
          },
        },
      },
    };
    state = setDefaultDraftOrder(state);
    state = confirmFantasyDraftOrder(state, TEST_NOW_ISO);

    const view = toFantasyDraftView(state);
    expect(view).not.toBeNull();
    expect(view!.activeOwnerTeamId).toBe(teamIds[1]);
    expect(
      view!.controlledFranchises.find((t) => t.teamId === teamIds[1])!
        .isActive,
    ).toBe(true);
    expect(view!.poolPlayers.length).toBeGreaterThan(0);
    expect(view!.teamNeeds).toHaveLength(5);
    expect(view!.settings.confirmPicks).toBe(true);
  });

  it(
    "analyzeFantasyDraft produces reach and steal candidates",
    () => {
      let state = createFantasyState(8);
      state = setDefaultDraftOrder(state);
      state = confirmFantasyDraftOrder(state, TEST_NOW_ISO);
      state = setFantasyDraftAutoPickAll(state, true);
      state = advanceFantasyDraftClock(state, TEST_NOW_ISO).state;

      const analysis = analyzeFantasyDraft(state);
      expect(analysis.pickAnalyses.length).toBe(
        state.world.fantasyDraft!.totalPicks,
      );
      for (const pick of analysis.pickAnalyses) {
        expect(pick.talentRankAtPick).toBeGreaterThanOrEqual(1);
        expect(pick.valueStars).toBeGreaterThanOrEqual(1);
        expect(pick.valueStars).toBeLessThanOrEqual(5);
      }
      expect(analysis.leagueRecap.biggestSteal).not.toBeNull();
    },
    60_000,
  );
});
