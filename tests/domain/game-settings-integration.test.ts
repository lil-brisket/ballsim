import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/persistence/save-game-repository", () => ({
  prismaSaveGameStore: {
    list: vi.fn(),
    create: vi.fn(),
    load: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  },
}));

import {
  asContractId,
  asOfferId,
  asPlayerId,
  asTeamId,
} from "@/domain/ids";
import {
  CBL_GAME_SETTINGS,
  DEFAULT_GAME_SETTINGS,
  cloneGameSettings,
} from "@/domain/game-settings";
import { validateGameSettings } from "@/domain/game-settings-validation";
import { createMemorySaveGameStore } from "@/persistence/memory-save-game-store";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";
import { GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";
import { createInitialGameState } from "@/state/create-initial-state";
import { reconstructGameSettingsFromState } from "@/state/reconstruct-game-settings";
import { generateBracket } from "@/systems/playoff-bracket";
import {
  applyPlayInResults,
  playInMatchups,
  qualifyAndSeed,
} from "@/systems/playoff-qualification";
import { generateSeasonSchedule } from "@/systems/schedule-generation";
import { processMonthlyBroadcastRevenue } from "@/systems/league-economy";
import { createEmptyTeamStanding } from "@/domain/entities/standings";
import { createNewOwnerSave } from "@/application/game-service";
import { acceptOffer, makeOffer } from "@/systems/free-agency";
import { DEFAULT_SALARY_CAP } from "@/systems/salary-cap-config";
import { validateGameState } from "@/persistence/validate-game-state";
import { createPlayer } from "../factories/player";

describe("settings persistence and isolation", () => {
  it("createInitialGameState defaults to Standard 30/82/16", () => {
    const state = createInitialGameState({ saveId: "std_default" });
    expect(state.settings).toEqual(DEFAULT_GAME_SETTINGS);
    expect(Object.keys(state.world.teams)).toHaveLength(30);
  });

  it("canonicalizes legacy injury and fixed fields on validateGameState", () => {
    const state = createInitialGameState({ saveId: "legacy_settings" });
    const { injuryFrequency: _removed, ...settingsWithoutInjury } =
      state.settings;
    const legacyPayload = {
      ...state,
      settings: {
        ...settingsWithoutInjury,
        injuriesEnabled: false,
        playoffs: {
          ...state.settings.playoffs,
          playInEnabled: true,
        },
        offseason: {
          freeAgency: {
            durationDays: 60,
            allowExtension: true,
          },
        },
        ai: {
          ...state.settings.ai,
          difficulty: "hard" as const,
        },
        simulation: { frequency: "weekly" as const },
      },
    };
    validateGameState(legacyPayload);
    expect(legacyPayload.settings.injuryFrequency).toBe("low");
    expect(legacyPayload.settings.offseason.freeAgency.durationDays).toBe(30);
    expect(legacyPayload.settings.playoffs.playInEnabled).toBe(false);
    expect(legacyPayload.settings.ai.difficulty).toBe("normal");
    expect(legacyPayload.settings.simulation.frequency).toBe("daily");
    expect(
      "injuriesEnabled" in (legacyPayload.settings as object),
    ).toBe(false);
  });

  it("CBL preset creates 12/22/8 via createNewOwnerSave", async () => {
    const store = createMemorySaveGameStore();
    const created = await createNewOwnerSave(
      { name: "CBL Save", rngSeed: 2, settings: CBL_GAME_SETTINGS },
      store,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const loaded = await store.load(created.save.id);
    expect(loaded!.state.settings.league.teamCount).toBe(12);
    expect(loaded!.state.settings.regularSeason.gamesPerTeam).toBe(22);
    expect(loaded!.state.settings.playoffs.playoffTeams).toBe(8);
  });

  it("settings survive save/load round-trip", () => {
    const custom = cloneGameSettings(DEFAULT_GAME_SETTINGS);
    custom.league.teamCount = 20;
    custom.regularSeason.gamesPerTeam = 60;
    custom.playoffs.playoffTeams = 8;
    custom.playoffs.seriesLength = 5;
    const state = createInitialGameState({
      saveId: "rt_settings",
      settings: custom,
    });
    const restored = deserializeGameState(serializeGameState(state));
    expect(restored.settings).toEqual(custom);
    expect(restored.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
  });

  it("two saves keep isolated settings", async () => {
    const store = createMemorySaveGameStore();
    const settingsA = cloneGameSettings(CBL_GAME_SETTINGS);
    settingsA.playoffs.seriesLength = 7;
    const settingsB = cloneGameSettings(CBL_GAME_SETTINGS);
    settingsB.league.teamCount = 20;
    settingsB.regularSeason.gamesPerTeam = 60;
    settingsB.playoffs = {
      playoffTeams: 8,
      seriesLength: 5,
      playInEnabled: false,
    };
    const a = await createNewOwnerSave(
      { name: "A", rngSeed: 3, settings: settingsA },
      store,
    );
    const b = await createNewOwnerSave(
      { name: "B", rngSeed: 4, settings: settingsB },
      store,
    );
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    const loadedA = await store.load(a.save.id);
    const loadedB = await store.load(b.save.id);
    expect(loadedA!.state.settings.playoffs.seriesLength).toBe(7);
    expect(loadedB!.state.settings.playoffs.seriesLength).toBe(5);
    expect(loadedA!.state.settings.league.teamCount).toBe(12);
    expect(loadedB!.state.settings.league.teamCount).toBe(20);
  });

  it("v24 reconstruction yields 22 games for 12-team CBL and validates", () => {
    const state = createInitialGameState({
      saveId: "recon_cbl",
      settings: CBL_GAME_SETTINGS,
    });
    const reconstructed = reconstructGameSettingsFromState({
      world: {
        conferences: state.world.conferences,
        divisions: state.world.divisions,
        teams: state.world.teams,
      },
      competition: {
        schedule: { gameIds: [] },
        games: {},
      },
    });
    expect(reconstructed.regularSeason.gamesPerTeam).toBe(22);
    expect(reconstructed.league.teamCount).toBe(12);
    expect(reconstructed.playoffs.playoffTeams).toBe(8);
    const validated = validateGameSettings(reconstructed, { mode: "persisted" });
    expect(validated.ok).toBe(true);
  });
});

describe("schedule gamesPerTeam", () => {
  it("12 teams / 14 games → every team has exactly 14", () => {
    const teamIds = Array.from({ length: 12 }, (_, i) =>
      asTeamId(`team_${i}`),
    );
    const assignments = generateSeasonSchedule({
      teamIds,
      seasonLength: 14,
    });
    const counts = new Map(teamIds.map((id) => [id, 0]));
    for (const a of assignments) {
      counts.set(a.homeTeamId, (counts.get(a.homeTeamId) ?? 0) + 1);
      counts.set(a.awayTeamId, (counts.get(a.awayTeamId) ?? 0) + 1);
    }
    for (const teamId of teamIds) {
      expect(counts.get(teamId)).toBe(14);
    }
  });

  it("12 teams / 22 games → every team has exactly 22", () => {
    const teamIds = Array.from({ length: 12 }, (_, i) =>
      asTeamId(`team_${i}`),
    );
    const assignments = generateSeasonSchedule({
      teamIds,
      seasonLength: 22,
    });
    const counts = new Map(teamIds.map((id) => [id, 0]));
    for (const a of assignments) {
      counts.set(a.homeTeamId, (counts.get(a.homeTeamId) ?? 0) + 1);
      counts.set(a.awayTeamId, (counts.get(a.awayTeamId) ?? 0) + 1);
    }
    for (const teamId of teamIds) {
      expect(counts.get(teamId)).toBe(22);
    }
  });

  it("30 teams / 82 games → every team has exactly 82", () => {
    const teamIds = Array.from({ length: 30 }, (_, i) =>
      asTeamId(`team_${i}`),
    );
    const assignments = generateSeasonSchedule({
      teamIds,
      seasonLength: 82,
    });
    const counts = new Map(teamIds.map((id) => [id, 0]));
    for (const a of assignments) {
      counts.set(a.homeTeamId, (counts.get(a.homeTeamId) ?? 0) + 1);
      counts.set(a.awayTeamId, (counts.get(a.awayTeamId) ?? 0) + 1);
    }
    for (const teamId of teamIds) {
      expect(counts.get(teamId)).toBe(82);
    }
  });
});

describe("playoff brackets and play-in", () => {
  it("6-team bracket has byes without fake series", () => {
    const seeds = Array.from({ length: 6 }, (_, i) => ({
      teamId: asTeamId(`t${i + 1}`),
      seed: i + 1,
    }));
    const bracket = generateBracket(seeds);
    expect(bracket.fieldSize).toBe(6);
    expect(bracket.series).toHaveLength(5);
    const opening = bracket.series.filter((s) => s.round === 0);
    expect(opening).toHaveLength(2);
    expect(opening.every((s) => !s.byeParticipant)).toBe(true);
    const semis = bracket.series.filter((s) => s.round === 1);
    expect(semis).toHaveLength(2);
    expect(semis.every((s) => s.byeParticipant != null)).toBe(true);
    expect(semis.every((s) => s.feederSeriesIds?.length === 1)).toBe(true);
  });

  it("12-team bracket matches bye layout", () => {
    const seeds = Array.from({ length: 12 }, (_, i) => ({
      teamId: asTeamId(`t${i + 1}`),
      seed: i + 1,
    }));
    const bracket = generateBracket(seeds);
    expect(bracket.fieldSize).toBe(12);
    expect(bracket.series).toHaveLength(11);
    expect(bracket.series.filter((s) => s.round === 0)).toHaveLength(4);
    const qf = bracket.series.filter((s) => s.round === 1);
    expect(qf).toHaveLength(4);
    expect(qf.every((s) => s.byeParticipant != null)).toBe(true);
  });

  it("play-in assigns seed N-1 and N to winners", () => {
    const standings = Array.from({ length: 14 }, (_, i) => {
      const wins = 14 - i;
      const losses = i;
      return {
        ...createEmptyTeamStanding(asTeamId(`team_${i}`)),
        wins,
        losses,
        winPercentage: wins / (wins + losses || 1),
      };
    });
    const matchups = playInMatchups(standings, 8);
    expect(matchups.gameA.homeTeamId).toBe(asTeamId("team_6"));
    expect(matchups.gameA.awayTeamId).toBe(asTeamId("team_9"));
    const qualified = applyPlayInResults(
      standings,
      8,
      matchups.gameA.awayTeamId,
      matchups.gameB.homeTeamId,
    );
    expect(qualified).toHaveLength(8);
    expect(qualified[6]!.seed).toBe(7);
    expect(qualified[6]!.teamId).toBe(matchups.gameA.awayTeamId);
    expect(qualified[7]!.seed).toBe(8);
    expect(qualified[7]!.teamId).toBe(matchups.gameB.homeTeamId);
    expect(qualifyAndSeed(standings, 8)[0]!.teamId).toBe(asTeamId("team_0"));
  });
});

describe("financial toggles", () => {
  it("revenue sharing disabled still pays market-weighted broadcast (no equal slice)", () => {
    const state = createInitialGameState({
      saveId: "rev_off",
      settings: {
        ...CBL_GAME_SETTINGS,
        financialRules: {
          ...CBL_GAME_SETTINGS.financialRules,
          revenueSharingEnabled: false,
        },
      },
    });
    const teamId = Object.keys(state.world.teams)[0]!;
    const before = state.business.finances[teamId]!.cash;
    const result = processMonthlyBroadcastRevenue(state);
    // Pool still pays; sharing off means 100% market-weighted remainder.
    expect(result.state.business.finances[teamId]!.cash).toBeGreaterThan(before);
    const year = state.competition.season.year;
    expect(
      result.state.business.finances[teamId]!.booksByYear[String(year)]!
        .revenue.broadcast,
    ).toBeGreaterThan(0);
  });

  it("revenue sharing enabled distributes cash", () => {
    const state = createInitialGameState({
      saveId: "rev_on",
      settings: CBL_GAME_SETTINGS,
    });
    const teamId = Object.keys(state.world.teams)[0]!;
    const before = state.business.finances[teamId]!.cash;
    const result = processMonthlyBroadcastRevenue(state);
    expect(result.state.business.finances[teamId]!.cash).toBeGreaterThan(before);
  });

  it("salary cap disabled allows a signing that exceeds the cap", () => {
    let state = createInitialGameState({
      saveId: "cap_off",
      settings: {
        ...CBL_GAME_SETTINGS,
        financialRules: {
          ...CBL_GAME_SETTINGS.financialRules,
          salaryCapEnabled: false,
        },
      },
    });
    const teamId = state.user.activeOwnerTeamId;
    const year = state.competition.season.year;
    const freeAgentId = asPlayerId("fa_over_cap");
    const offerId = asOfferId("offer_over_cap");
    const contractId = asContractId("contract_over_cap");
    state = {
      ...state,
      world: {
        ...state.world,
        players: {
          ...state.world.players,
          [freeAgentId]: createPlayer({
            id: freeAgentId,
            teamId: null,
            contractId: null,
          }),
        },
      },
    };

    const offered = makeOffer(state, {
      id: offerId,
      teamId,
      playerId: freeAgentId,
      terms: {
        id: contractId,
        playerId: freeAgentId,
        teamId,
        startYear: year,
        endYear: year,
        salaryByYear: { [String(year)]: DEFAULT_SALARY_CAP + 1 },
      },
    });
    const accepted = acceptOffer(offered.state, offerId);
    expect(accepted.state.business.contracts[contractId]).toBeDefined();
  });
});

describe("salary cap toggle settings", () => {
  it("validateGameSettings accepts cap disabled", () => {
    const settings = cloneGameSettings(CBL_GAME_SETTINGS);
    settings.financialRules.salaryCapEnabled = false;
    expect(validateGameSettings(settings).ok).toBe(true);
  });
});
