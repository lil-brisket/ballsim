import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { createTestGameState } from "../factories/game-state";
import {
  approveExpansion,
  completeExpansion,
  proposeExpansion,
  runExpansionDraft,
} from "@/systems/expansion";
import { EXPANSION_STARTING_CASH } from "@/systems/expansion-config";
import { assessExpansion } from "@/state/expansion-assessment";
import type { GameState } from "@/state/game-state";
import { deserializeGameState, serializeGameState } from "@/persistence/mappers/game-state-mapper";

function withGrowthEconomy(state: GameState): GameState {
  return {
    ...state,
    competition: {
      ...state.competition,
      season: {
        ...state.competition.season,
        phase: "offseason",
        offseasonStage: "free_agency",
      },
    },
    business: {
      ...state.business,
      leagueEconomy: {
        ...state.business.leagueEconomy,
        cycle: "growth",
        popularity: 70,
        broadcastValue: 65,
        sponsorshipClimate: 60,
      },
    },
  };
}

function withRecessionEconomy(state: GameState): GameState {
  return {
    ...state,
    business: {
      ...state.business,
      leagueEconomy: {
        ...state.business.leagueEconomy,
        cycle: "recession",
        popularity: 30,
        broadcastValue: 30,
        sponsorshipClimate: 30,
      },
    },
  };
}

describe("expansion assessment", () => {
  it("blocks opportunity when league is in recession", () => {
    let state = createTestGameState({ saveId: "exp_recession" });
    state = withRecessionEconomy(state);
    const assessment = assessExpansion(state);
    expect(assessment.leagueReadiness.status).toBe("closed");
    expect(assessment.status).not.toBe("opportunity");
    expect(assessment.canPropose).toBe(false);
  });

  it("opens opportunity when all three gates pass", () => {
    let state = createTestGameState({ saveId: "exp_ready" });
    state = withGrowthEconomy(state);
    const assessment = assessExpansion(state);
    expect(assessment.leagueReadiness.status).toBe("open");
    expect(assessment.marketOpportunity.status).toBe("open");
    expect(assessment.structuralCapacity.status).toBe("open");
    expect(assessment.status).toBe("opportunity");
    expect(assessment.canPropose).toBe(true);
  });
});

describe("expansion complete", () => {
  it("shares fee to existing clubs and seeds starting cash separately", () => {
    let state = createTestGameState({ saveId: "exp_fee" });
    state = withGrowthEconomy(state);
    const preexisting = Object.keys(state.world.teams).sort();
    const cashBefore = preexisting.map(
      (id) => state.business.finances[id]!.cash,
    );

    const division = Object.values(state.world.divisions)[0]!;
    const candidates = assessExpansion(state).marketOpportunity.destinations
      .slice(0, 2)
      .map((d) => ({
        city: d.city,
        name: d.name,
        abbreviation: d.abbreviation,
        marketSize: d.marketSize,
        conferenceId: division.conferenceId,
        divisionId: division.id,
      }));

    state = proposeExpansion(state, candidates, 12_000_000).state;
    state = approveExpansion(state, 0).state;
    const rng = createSeededRng(99);
    state = completeExpansion(state, rng).state;

    expect(state.business.expansion.stage).toBe("none");
    const newTeams = Object.keys(state.world.teams).filter(
      (id) => !preexisting.includes(id),
    );
    expect(newTeams.length).toBe(1);
    const newTeamId = newTeams[0]!;
    expect(state.business.finances[newTeamId]!.cash).toBe(EXPANSION_STARTING_CASH);

    const divisionOfNew = Object.values(state.world.divisions).find((d) =>
      d.teamIds.includes(newTeamId as never),
    );
    expect(divisionOfNew).toBeTruthy();
    expect(divisionOfNew!.teamIds).toContain(newTeamId);

    for (let i = 0; i < preexisting.length; i += 1) {
      expect(state.business.finances[preexisting[i]!]!.cash).toBeGreaterThan(
        cashBefore[i]!,
      );
    }

    expect(state.business.franchiseHistory[newTeamId]!.seasons).toEqual([]);
  });

  it("runExpansionDraft requires the new team to exist", () => {
    let state = createTestGameState({ saveId: "exp_draft_order" });
    state = withGrowthEconomy(state);
    const division = Object.values(state.world.divisions)[0]!;
    const candidates = [
      {
        city: "Summit",
        name: "Skyhawks",
        abbreviation: "SUM",
        marketSize: 58,
        conferenceId: division.conferenceId,
        divisionId: division.id,
      },
    ];
    state = proposeExpansion(state, candidates).state;
    state = approveExpansion(state, 0).state;
    expect(() => runExpansionDraft(state, createSeededRng(1))).toThrow(
      /must exist/,
    );
  });
});

describe("expansion serialize", () => {
  it("round-trips expansion idle state", () => {
    const state = createTestGameState({ saveId: "exp_ser" });
    const loaded = deserializeGameState(serializeGameState(state));
    expect(loaded.business.expansion.stage).toBe("none");
    expect(loaded.business.expansion.fee).toBeGreaterThan(0);
  });
});
