import { describe, expect, it } from "vitest";
import { createTestGameState } from "../factories/game-state";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";
import { GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";

describe("v30 → v31 migration", () => {
  it("defaults relocation tenure and history city/name from a v30 payload", () => {
    const modern = createTestGameState({ saveId: "mig_v30" });
    const parsed = JSON.parse(serializeGameState(modern)) as Record<
      string,
      unknown
    >;
    const meta = parsed.meta as Record<string, unknown>;
    meta.schemaVersion = 30;

    const business = parsed.business as Record<string, unknown>;
    const relocationByTeamId = business.relocationByTeamId as Record<
      string,
      Record<string, unknown>
    >;
    for (const teamId of Object.keys(relocationByTeamId)) {
      const process = { ...relocationByTeamId[teamId]! };
      delete process.cityStartSeasonYear;
      delete process.lastCompletedRelocationSeasonYear;
      delete process.failedAttemptCooldownSeasonsRemaining;
      relocationByTeamId[teamId] = process;
    }

    const franchiseHistory = business.franchiseHistory as Record<
      string,
      { teamId: string; seasons: Array<Record<string, unknown>> }
    >;
    // Inject one legacy season without city/name.
    const firstTeam = Object.keys(franchiseHistory)[0]!;
    franchiseHistory[firstTeam] = {
      teamId: firstTeam,
      seasons: [
        {
          seasonId: "season_legacy",
          seasonYear: 2025,
          wins: 20,
          losses: 40,
          playoffResult: "missed",
          championship: false,
          revenue: 10,
          cash: 10,
          fanSentiment: 50,
          reputation: 50,
          facilityLevels: {
            arena: 1,
            practice: 1,
            training: 1,
            medical: 1,
            youth: 1,
            fan: 1,
          },
          relocated: false,
          notableEventIds: [],
          franchiseValue: 100,
        },
      ],
    };

    const loaded = deserializeGameState(JSON.stringify(parsed));
    expect(loaded.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    expect(GAME_STATE_SCHEMA_VERSION).toBe(40);

    for (const teamId of Object.keys(loaded.world.teams)) {
      const process = loaded.business.relocationByTeamId[teamId]!;
      expect(process.cityStartSeasonYear).toBeGreaterThan(0);
      expect(process.lastCompletedRelocationSeasonYear).toBeNull();
      expect(process.failedAttemptCooldownSeasonsRemaining).toBe(0);
    }

    const migratedSeason =
      loaded.business.franchiseHistory[firstTeam]!.seasons[0]!;
    expect(migratedSeason.city).toBeTruthy();
    expect(migratedSeason.name).toBeTruthy();
    expect(migratedSeason.city).toBe(loaded.world.teams[firstTeam]!.city);
  });

  it("preserves relocated franchise identity across round-trip", () => {
    let state = createTestGameState({ saveId: "mig_relocated" });
    const teamId = state.user.controlledTeamId;
    state = {
      ...state,
      world: {
        ...state.world,
        teams: {
          ...state.world.teams,
          [teamId]: {
            ...state.world.teams[teamId]!,
            city: "Harbor",
            name: "Waves",
            abbreviation: "HAR",
          },
        },
      },
      business: {
        ...state.business,
        franchiseOps: {
          ...state.business.franchiseOps,
          [teamId]: {
            ...state.business.franchiseOps[teamId]!,
            marketSize: 62,
          },
        },
        relocationByTeamId: {
          ...state.business.relocationByTeamId,
          [teamId]: {
            ...state.business.relocationByTeamId[teamId]!,
            stage: "none",
            cityStartSeasonYear: state.competition.season.year,
            lastCompletedRelocationSeasonYear: state.competition.season.year - 1,
            cooldownSeasonsRemaining: 5,
            failedAttemptCooldownSeasonsRemaining: 0,
            fee: 0,
            target: null,
          },
        },
        franchiseHistory: {
          ...state.business.franchiseHistory,
          [teamId]: {
            teamId,
            seasons: [
              {
                seasonId: state.competition.season.id,
                seasonYear: state.competition.season.year - 1,
                wins: 40,
                losses: 42,
                playoffResult: "missed",
                championship: false,
                revenue: 1,
                attendance: null,
                cash: 1,
                fanSentiment: 40,
                reputation: 55,
                facilityLevels: {
                  arena: 1,
                  practice: 1,
                  training: 1,
                  medical: 1,
                  youth: 1,
                  fan: 1,
                },
                relocated: true,
                city: "Oldtown",
                name: "Originals",
                notableEventIds: [],
                franchiseValue: 200,
              },
            ],
          },
        },
      },
    };

    const loaded = deserializeGameState(serializeGameState(state));
    expect(loaded.world.teams[teamId]!.city).toBe("Harbor");
    expect(
      loaded.business.franchiseHistory[teamId]!.seasons[0]!.city,
    ).toBe("Oldtown");
    expect(
      loaded.business.relocationByTeamId[teamId]!
        .lastCompletedRelocationSeasonYear,
    ).toBe(state.competition.season.year - 1);
  });
});
