import { describe, expect, it } from "vitest";
import { createTestGameState } from "../factories/game-state";
import {
  advanceRelocationStage,
  cancelRelocation,
  completeRelocationTransition,
  tickRelocationCooldowns,
} from "@/systems/relocation";
import { assessRelocation } from "@/state/relocation-assessment";
import {
  RELOCATION_COOLDOWN_SEASONS,
  RELOCATION_MIN_SEASONS_IN_CITY,
} from "@/systems/relocation-config";
import type { GameState } from "@/state/game-state";
import { serializeGameState, deserializeGameState } from "@/persistence/mappers/game-state-mapper";

function withTenure(state: GameState, seasonsInCity: number): GameState {
  const teamId = state.user.controlledTeamId;
  const year = state.competition.season.year;
  const process = state.business.relocationByTeamId[teamId]!;
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
      relocationByTeamId: {
        ...state.business.relocationByTeamId,
        [teamId]: {
          ...process,
          cityStartSeasonYear: year - seasonsInCity + 1,
          cooldownSeasonsRemaining: 0,
          failedAttemptCooldownSeasonsRemaining: 0,
        },
      },
    },
  };
}

function withMarketAndOps(
  state: GameState,
  input: {
    marketSize: number;
    cash?: number;
    fanSentiment?: number;
    wins?: number;
    losses?: number;
  },
): GameState {
  const teamId = state.user.controlledTeamId;
  const ops = state.business.franchiseOps[teamId]!;
  const finances = state.business.finances[teamId]!;
  const standing = state.competition.standings.byTeamId[teamId]!;
  return {
    ...state,
    competition: {
      ...state.competition,
      standings: {
        ...state.competition.standings,
        byTeamId: {
          ...state.competition.standings.byTeamId,
          [teamId]: {
            ...standing,
            wins: input.wins ?? standing.wins,
            losses: input.losses ?? standing.losses,
          },
        },
      },
    },
    business: {
      ...state.business,
      franchiseOps: {
        ...state.business.franchiseOps,
        [teamId]: {
          ...ops,
          marketSize: input.marketSize,
          fanSentiment: input.fanSentiment ?? ops.fanSentiment,
        },
      },
      finances: {
        ...state.business.finances,
        [teamId]: {
          ...finances,
          cash: input.cash ?? finances.cash,
        },
      },
    },
  };
}

const TARGET = {
  city: "Harbor",
  name: "Waves",
  abbreviation: "HAR",
  marketSize: 72,
};

describe("relocation assessment", () => {
  it("does not treat weak team in strong market as a relocation start case", () => {
    let state = createTestGameState({ saveId: "reloc_weak_strong" });
    state = withTenure(state, RELOCATION_MIN_SEASONS_IN_CITY + 2);
    state = withMarketAndOps(state, {
      marketSize: 75,
      wins: 10,
      losses: 50,
      cash: 80_000_000,
    });
    const assessment = assessRelocation(state);
    expect(assessment.canStart).toBe(false);
    expect(["not_relevant", "watch"]).toContain(assessment.status);
  });

  it("flags weak market + weak business as strong_case when tenure allows", () => {
    let state = createTestGameState({ saveId: "reloc_weak_weak" });
    state = withTenure(state, RELOCATION_MIN_SEASONS_IN_CITY + 2);
    state = withMarketAndOps(state, {
      marketSize: 35,
      wins: 12,
      losses: 50,
      cash: 500_000,
      fanSentiment: 30,
    });
    const assessment = assessRelocation(state);
    expect(assessment.marketConstraint.weakMarket).toBe(true);
    expect(["consider", "strong_case"]).toContain(assessment.status);
    expect(assessment.canStart).toBe(true);
  });

  it("blocks start when tenure is too short even if economics qualify", () => {
    let state = createTestGameState({ saveId: "reloc_tenure" });
    state = withTenure(state, 2);
    state = withMarketAndOps(state, {
      marketSize: 35,
      wins: 12,
      losses: 50,
      cash: 500_000,
    });
    const assessment = assessRelocation(state);
    expect(assessment.tenure.blocked).toBe(true);
    expect(assessment.canStart).toBe(false);
    expect(assessment.status).toBe("blocked_tenure");
  });

  it("never auto-completes from assessment alone", () => {
    let state = createTestGameState({ saveId: "reloc_no_auto" });
    state = withTenure(state, RELOCATION_MIN_SEASONS_IN_CITY + 2);
    state = withMarketAndOps(state, {
      marketSize: 35,
      cash: 500_000,
    });
    const before = state.world.teams[state.user.controlledTeamId]!.city;
    assessRelocation(state);
    expect(state.world.teams[state.user.controlledTeamId]!.city).toBe(before);
    expect(state.business.relocationByTeamId[state.user.controlledTeamId]!.stage).toBe(
      "none",
    );
  });
});

describe("relocation stages and completion", () => {
  it("applies identity, fee, and fan sentiment on transition advance", () => {
    let state = createTestGameState({ saveId: "reloc_complete" });
    const teamId = state.user.controlledTeamId;
    state = withTenure(state, RELOCATION_MIN_SEASONS_IN_CITY + 3);
    state = withMarketAndOps(state, {
      marketSize: 40,
      cash: 100_000_000,
      fanSentiment: 70,
    });

    const stages = [
      "evaluate",
      "explore",
      "negotiate",
      "league_review",
      "approved",
      "transition",
      "complete",
    ] as const;
    for (const _ of stages) {
      const result = advanceRelocationStage(state, teamId, TARGET);
      state = result.state;
    }

    expect(state.business.relocationByTeamId[teamId]!.stage).toBe("complete");
    expect(state.world.teams[teamId]!.city).toBe("Harbor");
    expect(state.world.teams[teamId]!.name).toBe("Waves");
    expect(state.business.franchiseOps[teamId]!.marketSize).toBe(72);
    expect(state.business.franchiseOps[teamId]!.fanSentiment).toBeLessThan(70);
    expect(state.business.finances[teamId]!.cash).toBeLessThan(100_000_000);
    expect(
      state.business.relocationByTeamId[teamId]!.cooldownSeasonsRemaining,
    ).toBe(RELOCATION_COOLDOWN_SEASONS);
    expect(
      state.business.relocationByTeamId[teamId]!
        .lastCompletedRelocationSeasonYear,
    ).toBe(state.competition.season.year);
  });

  it("rejects occupied destination at league review", () => {
    let state = createTestGameState({ saveId: "reloc_occupied" });
    const teamId = state.user.controlledTeamId;
    state = withTenure(state, RELOCATION_MIN_SEASONS_IN_CITY + 2);
    const other = Object.values(state.world.teams).find((t) => t.id !== teamId)!;
    const occupiedTarget = {
      city: other.city,
      name: "Intruders",
      abbreviation: "INT",
      marketSize: 80,
    };

    for (let i = 0; i < 5; i += 1) {
      state = advanceRelocationStage(state, teamId, occupiedTarget).state;
    }
    expect(state.business.relocationByTeamId[teamId]!.stage).toBe("rejected");
  });

  it("cancel sets failed-attempt cooldown", () => {
    let state = createTestGameState({ saveId: "reloc_cancel" });
    const teamId = state.user.controlledTeamId;
    state = withTenure(state, RELOCATION_MIN_SEASONS_IN_CITY + 2);
    state = advanceRelocationStage(state, teamId, TARGET).state;
    state = advanceRelocationStage(state, teamId, TARGET).state;
    expect(state.business.relocationByTeamId[teamId]!.stage).toBe("explore");
    state = cancelRelocation(state, teamId).state;
    expect(state.business.relocationByTeamId[teamId]!.stage).toBe("none");
    expect(
      state.business.relocationByTeamId[teamId]!
        .failedAttemptCooldownSeasonsRemaining,
    ).toBeGreaterThan(0);
  });

  it("completeRelocationTransition requires transition stage", () => {
    const state = createTestGameState({ saveId: "reloc_bad_complete" });
    expect(() =>
      completeRelocationTransition(state, state.user.controlledTeamId),
    ).toThrow(/transition/);
  });

  it("tickRelocationCooldowns clears complete after cooldown", () => {
    let state = createTestGameState({ saveId: "reloc_tick" });
    const teamId = state.user.controlledTeamId;
    state = {
      ...state,
      business: {
        ...state.business,
        relocationByTeamId: {
          ...state.business.relocationByTeamId,
          [teamId]: {
            ...state.business.relocationByTeamId[teamId]!,
            stage: "complete",
            target: TARGET,
            cooldownSeasonsRemaining: 1,
            cityStartSeasonYear: state.competition.season.year,
            lastCompletedRelocationSeasonYear: state.competition.season.year,
            failedAttemptCooldownSeasonsRemaining: 0,
            fee: 0,
          },
        },
      },
    };
    state = tickRelocationCooldowns(state).state;
    expect(state.business.relocationByTeamId[teamId]!.stage).toBe("none");
    expect(
      state.business.relocationByTeamId[teamId]!.cooldownSeasonsRemaining,
    ).toBe(0);
  });
});

describe("relocation destination ranking", () => {
  it("exposes opportunity and risk without assuming default realization as fact", () => {
    let state = createTestGameState({ saveId: "reloc_dest" });
    state = withTenure(state, RELOCATION_MIN_SEASONS_IN_CITY + 2);
    state = withMarketAndOps(state, { marketSize: 40 });
    const assessment = assessRelocation(state);
    expect(assessment.destinationOpportunity.length).toBeGreaterThan(0);
    const top = assessment.destinationOpportunity[0]!;
    expect(top.opportunity).toBeTruthy();
    expect(top.risk).toBeTruthy();
    expect(top.uncertainty).toBeTruthy();
    expect(Array.isArray(top.reasons)).toBe(true);
  });
});

describe("relocation save migration fields", () => {
  it("round-trips tenure fields through serialize/deserialize", () => {
    let state = createTestGameState({ saveId: "reloc_ser" });
    const teamId = state.user.controlledTeamId;
    state = withTenure(state, 10);
    const json = serializeGameState(state);
    const loaded = deserializeGameState(json);
    expect(loaded.meta.schemaVersion).toBe(36);
    expect(
      loaded.business.relocationByTeamId[teamId]!.cityStartSeasonYear,
    ).toBeGreaterThan(0);
    expect(
      loaded.business.relocationByTeamId[teamId]!
        .failedAttemptCooldownSeasonsRemaining,
    ).toBe(0);
  });
});
