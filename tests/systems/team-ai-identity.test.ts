import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import {
  asDraftPickId,
  asPlayerId,
  asTeamId,
  type TeamId,
} from "@/domain/ids";
import {
  createPlayer,
  type PlayerAttributes,
} from "@/domain/entities/player";
import { createInitialGameState } from "@/state/create-initial-state";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { selectProspectForTeam } from "@/systems/ai-team-decisions";
import {
  organizationalPlayerValue,
  organizationalPickValue,
} from "@/systems/trades/trade-evaluation";
import { resolveFranchisePreferencesFromParts } from "@/systems/franchise-ai-preferences";
import type { FranchiseContext } from "@/systems/franchise-ai-context";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import { draftClassIdFor, type DraftClass } from "@/domain/entities/draft";
import { createDraftPick } from "@/domain/entities/draft-pick";

const BASE_ATTRS: PlayerAttributes = {
  speed: 70,
  strength: 70,
  athleticism: 70,
  stamina: 70,
  finishing: 70,
  midRange: 70,
  threePoint: 70,
  freeThrow: 70,
  ballHandling: 70,
  passing: 70,
  perimeterDefense: 70,
  interiorDefense: 70,
  steal: 70,
  block: 70,
  rebounding: 70,
  basketballIq: 70,
  offensiveIq: 70,
  defensiveIq: 70,
  consistency: 70,
};

function ctx(): FranchiseContext {
  return {
    teamId: asTeamId("team_a"),
    wins: 20,
    losses: 20,
    winPct: 0.5,
    rosterStrength: 55,
    rosterAge: 26,
    youngRosterSharePct: 40,
    cash: 50_000_000,
    financialHealth: "stable",
    capSpace: 20_000_000,
    marketSize: 50,
    reputation: 50,
    fanSentiment: 50,
    marketingAwareness: 40,
    draftAssetCount: 3,
    performancePressure: 0.4,
    calendarUrgency: 0,
    deadlineWindow: false,
    offseasonPlanning: false,
  };
}

function makePlayer(
  id: string,
  age: number,
  attributes: PlayerAttributes,
  potentialOverall: number,
) {
  return createPlayer({
    id: asPlayerId(id),
    teamId: null,
    firstName: "Test",
    lastName: id,
    nationality: "USA",
    age,
    heightInches: 78,
    weightPounds: 210,
    position: "SG",
    archetype: "three_and_d_wing",
    attributes,
    potential: { overall: potentialOverall },
    personality: {
      workEthic: 60,
      loyalty: 50,
      competitiveness: 50,
      leadership: 50,
      composure: 50,
    },
    contractId: null,
    injury: { kind: "healthy" },
    development: { stage: age <= 24 ? "developing" : "prime" },
  });
}

describe("team AI identity valuation", () => {
  it("rebuild values young players more than win_now relative to objective", () => {
    let state = createInitialGameState({
      saveId: "trade_val",
      rngSeed: 12,
      settings: CBL_GAME_SETTINGS,
    });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    const youngId = asPlayerId("p_young_val");
    const oldId = asPlayerId("p_old_val");
    state = {
      ...state,
      world: {
        ...state.world,
        players: {
          ...state.world.players,
          [youngId]: makePlayer("p_young_val", 22, BASE_ATTRS, 85),
          [oldId]: makePlayer("p_old_val", 32, BASE_ATTRS, 72),
        },
      },
    };

    const rebuild = resolveFranchisePreferencesFromParts(
      {
        aiProfile: "rebuild",
        spendingTolerance: 30,
        patience: 80,
        riskTolerance: 40,
        marketSize: 50,
      },
      ctx(),
    ).preferences;
    const winNow = resolveFranchisePreferencesFromParts(
      {
        aiProfile: "win_now",
        spendingTolerance: 75,
        patience: 25,
        riskTolerance: 65,
        marketSize: 50,
      },
      ctx(),
    ).preferences;

    const objective = calculatePlayerOverall("SG", BASE_ATTRS);
    const rebuildYoung = organizationalPlayerValue(state, youngId, rebuild);
    const winNowYoung = organizationalPlayerValue(state, youngId, winNow);
    const rebuildOld = organizationalPlayerValue(state, oldId, rebuild);
    const winNowOld = organizationalPlayerValue(state, oldId, winNow);

    expect(rebuildYoung / objective).toBeGreaterThan(winNowYoung / objective);
    expect(winNowOld / objective).toBeGreaterThan(rebuildOld / objective);
  });

  it("pick asset valuation rises with pickValue preference", () => {
    let state = createInitialGameState({
      saveId: "pick_val",
      rngSeed: 13,
      settings: CBL_GAME_SETTINGS,
    });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    const teamId = (Object.keys(state.world.teams) as TeamId[])[0]!;
    const pickId = asDraftPickId("pick_test_r1");
    state = {
      ...state,
      world: {
        ...state.world,
        draftPicks: {
          ...state.world.draftPicks,
          [pickId]: createDraftPick({
            id: pickId,
            originalTeamId: teamId,
            ownerTeamId: teamId,
            seasonYear: state.competition.season.year + 1,
            round: 1,
          }),
        },
      },
    };
    const high = resolveFranchisePreferencesFromParts(
      {
        aiProfile: "rebuild",
        spendingTolerance: 40,
        patience: 70,
        riskTolerance: 40,
        marketSize: 50,
      },
      ctx(),
    ).preferences;
    const low = resolveFranchisePreferencesFromParts(
      {
        aiProfile: "win_now",
        spendingTolerance: 70,
        patience: 30,
        riskTolerance: 60,
        marketSize: 50,
      },
      ctx(),
    ).preferences;
    expect(organizationalPickValue(state, pickId, high)).toBeGreaterThan(
      organizationalPickValue(state, pickId, low),
    );
  });

  it("draft selection prefers potential for development orgs", () => {
    let state = createInitialGameState({
      saveId: "draft_sel",
      rngSeed: 14,
      settings: CBL_GAME_SETTINGS,
    });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    const teamIds = Object.keys(state.world.teams) as TeamId[];
    const teamId = teamIds.find((id) => id !== state.user.activeOwnerTeamId)!;

    state = {
      ...state,
      business: {
        ...state.business,
        franchiseOps: {
          ...state.business.franchiseOps,
          [teamId]: {
            ...state.business.franchiseOps[teamId]!,
            aiProfile: "development",
            spendingTolerance: 55,
            patience: 75,
            riskTolerance: 40,
          },
        },
      },
    };

    const readyAttrs: PlayerAttributes = {
      ...BASE_ATTRS,
      finishing: 78,
      midRange: 78,
      threePoint: 78,
      ballHandling: 78,
      passing: 78,
    };
    const upsideAttrs: PlayerAttributes = {
      ...BASE_ATTRS,
      finishing: 55,
      midRange: 55,
      threePoint: 55,
      ballHandling: 55,
      passing: 55,
    };
    const readyPlayer = makePlayer("prospect_ready", 22, readyAttrs, 80);
    const upsidePlayer = makePlayer("prospect_upside", 19, upsideAttrs, 92);
    // Force PG so position counts match
    const readyPg = createPlayer({ ...readyPlayer, position: "PG", id: asPlayerId("prospect_ready") });
    const upsidePg = createPlayer({
      ...upsidePlayer,
      position: "PG",
      id: asPlayerId("prospect_upside"),
    });

    const draftYear = state.competition.season.year + 1;
    const draftClassId = draftClassIdFor(draftYear);
    const draft: DraftClass = {
      id: draftClassId,
      seasonYear: draftYear,
      status: "active",
      order: [],
      prospects: {
        [readyPg.id]: {
          playerId: readyPg.id,
          player: readyPg,
          ranking: 1,
          status: "eligible",
        },
        [upsidePg.id]: {
          playerId: upsidePg.id,
          player: upsidePg,
          ranking: 2,
          status: "eligible",
        },
      },
      scouting: [],
      selections: [],
    };
    state = {
      ...state,
      world: {
        ...state.world,
        drafts: { ...state.world.drafts, [draftClassId]: draft },
        players: {
          ...state.world.players,
          [readyPg.id]: readyPg,
          [upsidePg.id]: upsidePg,
        },
      },
    };

    const pick = selectProspectForTeam(state, draft, teamId);
    expect(pick).toBe(upsidePg.id);
  });
});
