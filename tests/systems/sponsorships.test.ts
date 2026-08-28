import { describe, expect, it } from "vitest";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { asSponsorshipId, asTeamId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import {
  processMonthlySponsorshipRevenue,
  signSponsorship,
} from "@/systems/sponsorships";
import { bootstrapWorld } from "@/systems/world-pipeline";

describe("sponsorships media/climate scaling", () => {
  it("higher media attention increases monthly sponsorship payout", () => {
    let state = createInitialGameState({
      saveId: "sponsor_media",
      rngSeed: 9,
      settings: CBL_GAME_SETTINGS,
    });
    state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
    const teamId = asTeamId(state.user.activeOwnerTeamId);
    const year = state.competition.season.year;

    state = signSponsorship(state, teamId, {
      id: asSponsorshipId("sp_media_1"),
      sponsorName: "Test Co",
      annualValue: 1_200_000,
      startYear: year,
      endYear: year + 1,
      reputationFloor: 1,
      playoffBonus: 0,
    }).state;

    const lowMedia = {
      ...state,
      business: {
        ...state.business,
        franchiseOps: {
          ...state.business.franchiseOps,
          [teamId]: {
            ...state.business.franchiseOps[teamId]!,
            mediaAttention: 10,
          },
        },
        leagueEconomy: {
          ...state.business.leagueEconomy,
          sponsorshipClimate: 50,
        },
      },
    };
    const highMedia = {
      ...lowMedia,
      business: {
        ...lowMedia.business,
        franchiseOps: {
          ...lowMedia.business.franchiseOps,
          [teamId]: {
            ...lowMedia.business.franchiseOps[teamId]!,
            mediaAttention: 90,
          },
        },
      },
    };

    const cashBase = state.business.finances[teamId]!.cash;
    const lowResult = processMonthlySponsorshipRevenue(lowMedia);
    const highResult = processMonthlySponsorshipRevenue(highMedia);
    const lowGain = lowResult.state.business.finances[teamId]!.cash - cashBase;
    const highGain = highResult.state.business.finances[teamId]!.cash - cashBase;
    expect(highGain).toBeGreaterThan(lowGain);
    expect(lowGain).toBeGreaterThan(0);
  });

  it("pays playoff bonus once per deal per season", () => {
    let state = createInitialGameState({
      saveId: "sponsor_playoff_once",
      rngSeed: 19,
      settings: CBL_GAME_SETTINGS,
    });
    state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
    const teamId = asTeamId(state.user.activeOwnerTeamId);
    const year = state.competition.season.year;
    state = signSponsorship(state, teamId, {
      id: asSponsorshipId("sp_po_1"),
      sponsorName: "Playoff Co",
      annualValue: 1_200_000,
      startYear: year,
      endYear: year + 1,
      reputationFloor: 1,
      playoffBonus: 5_000_000,
    }).state;
    state = {
      ...state,
      competition: {
        ...state.competition,
        playoffs: {
          ...state.competition.playoffs,
          qualifiedTeams: [{ teamId, seed: 1 }],
          status: "in_progress",
        },
      },
    };
    const cash0 = state.business.finances[teamId]!.cash;
    state = processMonthlySponsorshipRevenue(state).state;
    const afterFirst = state.business.finances[teamId]!.cash - cash0;
    state = processMonthlySponsorshipRevenue(state).state;
    const afterSecond = state.business.finances[teamId]!.cash - cash0;
    expect(afterFirst).toBeGreaterThan(5_000_000);
    expect(afterSecond - afterFirst).toBeLessThan(5_000_000);
    expect(afterSecond - afterFirst).toBeGreaterThan(0);
  });
});
