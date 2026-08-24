import { describe, expect, it } from "vitest";
import { createTestGameState } from "../factories/game-state";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";
import { validateGameState } from "@/persistence/validate-game-state";
import { GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";

describe("v31 → v32 migration", () => {
  it("migrates ownerStartSeasonYear and attendance, then validates", () => {
    const modern = createTestGameState({ saveId: "mig_v31" });
    const parsed = JSON.parse(serializeGameState(modern)) as Record<
      string,
      unknown
    >;
    const meta = parsed.meta as Record<string, unknown>;
    meta.schemaVersion = 31;

    const user = parsed.user as Record<string, unknown>;
    const preservedCash = (
      (parsed.business as Record<string, unknown>).finances as Record<
        string,
        { cash: number }
      >
    )[modern.user.controlledTeamId]!.cash;
    delete user.ownerStartSeasonYear;

    const business = parsed.business as Record<string, unknown>;
    const finances = business.finances as Record<
      string,
      Record<string, unknown>
    >;
    for (const teamId of Object.keys(finances)) {
      delete finances[teamId]!.attendanceByYear;
    }

    const franchiseHistory = business.franchiseHistory as Record<
      string,
      { teamId: string; seasons: Array<Record<string, unknown>> }
    >;
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
          city: "Legacy City",
          name: "Legacy",
          notableEventIds: [],
          franchiseValue: 100,
        },
      ],
    };

    const loaded = deserializeGameState(JSON.stringify(parsed));
    expect(loaded.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    expect(GAME_STATE_SCHEMA_VERSION).toBe(33);
    expect(loaded.user.ownerStartSeasonYear).toBe(
      loaded.competition.season.year,
    );
    expect(
      loaded.business.franchiseHistory[firstTeam]!.seasons[0]!.attendance,
    ).toBeNull();
    expect(
      loaded.business.franchiseHistory[firstTeam]!.seasons[0]!.city,
    ).toBe("Legacy City");
    for (const teamId of Object.keys(loaded.world.teams)) {
      expect(loaded.business.finances[teamId]!.attendanceByYear).toEqual({});
    }
    expect(
      loaded.business.finances[modern.user.controlledTeamId]!.cash,
    ).toBe(preservedCash);

    expect(() => validateGameState(loaded)).not.toThrow();

    const roundTrip = deserializeGameState(serializeGameState(loaded));
    expect(roundTrip.user.ownerStartSeasonYear).toBe(
      loaded.user.ownerStartSeasonYear,
    );
    expect(
      roundTrip.business.franchiseHistory[firstTeam]!.seasons[0]!.attendance,
    ).toBeNull();
    expect(() => validateGameState(roundTrip)).not.toThrow();
  });
});
