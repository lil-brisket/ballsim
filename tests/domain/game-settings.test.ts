import { describe, expect, it } from "vitest";
import {
  CBL_GAME_SETTINGS,
  DEFAULT_GAME_SETTINGS,
  isInjuryFrequency,
  seriesWinsToClinch,
} from "@/domain/game-settings";
import { settingsForPreset } from "@/domain/game-settings-presets";
import { validateGameSettings } from "@/domain/game-settings-validation";
import { tryResolveLeagueShape } from "@/domain/league-shape";

describe("GameSettings defaults", () => {
  it("DEFAULT_GAME_SETTINGS is Standard 30/82/16", () => {
    expect(DEFAULT_GAME_SETTINGS.league.teamCount).toBe(30);
    expect(DEFAULT_GAME_SETTINGS.regularSeason.gamesPerTeam).toBe(82);
    expect(DEFAULT_GAME_SETTINGS.playoffs.playoffTeams).toBe(16);
    expect(DEFAULT_GAME_SETTINGS.playoffs.seriesLength).toBe(7);
    expect(DEFAULT_GAME_SETTINGS.injuryFrequency).toBe("medium");
  });

  it("CBL_GAME_SETTINGS is 12/22/8", () => {
    expect(CBL_GAME_SETTINGS.league.teamCount).toBe(12);
    expect(CBL_GAME_SETTINGS.regularSeason.gamesPerTeam).toBe(22);
    expect(CBL_GAME_SETTINGS.playoffs.playoffTeams).toBe(8);
    expect(CBL_GAME_SETTINGS.injuryFrequency).toBe("medium");
  });

  it("seriesWinsToClinch maps best-of-N", () => {
    expect(seriesWinsToClinch(1)).toBe(1);
    expect(seriesWinsToClinch(3)).toBe(2);
    expect(seriesWinsToClinch(5)).toBe(3);
    expect(seriesWinsToClinch(7)).toBe(4);
  });

  it("presets produce expected settings", () => {
    expect(settingsForPreset("standard").league.teamCount).toBe(30);
    expect(settingsForPreset("cbl").regularSeason.gamesPerTeam).toBe(22);
    expect(settingsForPreset("custom").league.teamCount).toBe(30);
  });

  it("every built-in preset satisfies canonical invariants", () => {
    const presets = [
      DEFAULT_GAME_SETTINGS,
      CBL_GAME_SETTINGS,
      settingsForPreset("standard"),
      settingsForPreset("cbl"),
      settingsForPreset("custom"),
    ];
    for (const preset of presets) {
      const result = validateGameSettings(preset);
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(isInjuryFrequency(result.settings.injuryFrequency)).toBe(true);
      expect(result.settings.offseason.freeAgency.durationDays).toBe(30);
      expect(result.settings.playoffs.playInEnabled).toBe(false);
      expect(result.settings.ai.difficulty).toBe("normal");
      expect(result.settings.simulation.frequency).toBe("daily");
    }
  });
});

describe("validateGameSettings", () => {
  it("accepts DEFAULT_GAME_SETTINGS", () => {
    const result = validateGameSettings(DEFAULT_GAME_SETTINGS);
    expect(result.ok).toBe(true);
  });

  it("accepts CBL_GAME_SETTINGS including 22 games", () => {
    const result = validateGameSettings(CBL_GAME_SETTINGS);
    expect(result.ok).toBe(true);
  });

  it("rejects unsupported team count", () => {
    const result = validateGameSettings({
      ...DEFAULT_GAME_SETTINGS,
      league: { ...DEFAULT_GAME_SETTINGS.league, teamCount: 15 },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("teamCount"))).toBe(true);
    }
  });

  it("rejects playoff teams greater than league size", () => {
    const result = validateGameSettings({
      ...CBL_GAME_SETTINGS,
      playoffs: { ...CBL_GAME_SETTINGS.playoffs, playoffTeams: 16 },
    });
    expect(result.ok).toBe(false);
  });

  it("rejects invalid series length", () => {
    const result = validateGameSettings({
      ...DEFAULT_GAME_SETTINGS,
      playoffs: { ...DEFAULT_GAME_SETTINGS.playoffs, seriesLength: 9 },
    });
    expect(result.ok).toBe(false);
  });

  it("forces play-in off even when requested", () => {
    const result = validateGameSettings({
      ...DEFAULT_GAME_SETTINGS,
      playoffs: {
        ...DEFAULT_GAME_SETTINGS.playoffs,
        playInEnabled: true,
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.settings.playoffs.playInEnabled).toBe(false);
    }
  });

  it("rejects 10 teams with 2 conferences and divisions enabled", () => {
    const result = validateGameSettings({
      ...DEFAULT_GAME_SETTINGS,
      league: {
        teamCount: 10,
        conferenceCount: 2,
        divisionsEnabled: true,
      },
      playoffs: { ...DEFAULT_GAME_SETTINGS.playoffs, playoffTeams: 8 },
      regularSeason: {
        gamesPerTeam: 22,
        tradeDeadlineRule: DEFAULT_GAME_SETTINGS.regularSeason.tradeDeadlineRule,
      },
    });
    expect(result.ok).toBe(false);
  });
});

describe("canonical settings migration matrix", () => {
  function expectCanonical(
    input: unknown,
    expected: {
      injuryFrequency: string;
      durationDays?: number;
      playInEnabled?: boolean;
      difficulty?: string;
      frequency?: string;
    },
  ) {
    const result = validateGameSettings(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.settings.injuryFrequency).toBe(expected.injuryFrequency);
    if (expected.durationDays !== undefined) {
      expect(result.settings.offseason.freeAgency.durationDays).toBe(
        expected.durationDays,
      );
    }
    if (expected.playInEnabled !== undefined) {
      expect(result.settings.playoffs.playInEnabled).toBe(
        expected.playInEnabled,
      );
    }
    if (expected.difficulty !== undefined) {
      expect(result.settings.ai.difficulty).toBe(expected.difficulty);
    }
    if (expected.frequency !== undefined) {
      expect(result.settings.simulation.frequency).toBe(expected.frequency);
    }
  }

  it("injuriesEnabled: false → injuryFrequency low", () => {
    const { injuryFrequency: _, ...rest } = DEFAULT_GAME_SETTINGS;
    expectCanonical(
      { ...rest, injuriesEnabled: false },
      { injuryFrequency: "low" },
    );
  });

  it("injuriesEnabled: true → injuryFrequency medium", () => {
    const { injuryFrequency: _, ...rest } = DEFAULT_GAME_SETTINGS;
    expectCanonical(
      { ...rest, injuriesEnabled: true },
      { injuryFrequency: "medium" },
    );
  });

  it("no injury field → medium", () => {
    const { injuryFrequency: _, ...rest } = DEFAULT_GAME_SETTINGS;
    expectCanonical(rest, { injuryFrequency: "medium" });
  });

  it("preserves valid injuryFrequency values", () => {
    for (const frequency of ["low", "medium", "high"] as const) {
      expectCanonical(
        { ...DEFAULT_GAME_SETTINGS, injuryFrequency: frequency },
        { injuryFrequency: frequency },
      );
    }
  });

  it("invalid injury frequency → medium", () => {
    expectCanonical(
      { ...DEFAULT_GAME_SETTINGS, injuryFrequency: "extreme" },
      { injuryFrequency: "medium" },
    );
  });

  it("forces durationDays to 30", () => {
    for (const days of [7, 90]) {
      expectCanonical(
        {
          ...DEFAULT_GAME_SETTINGS,
          offseason: {
            freeAgency: { durationDays: days, allowExtension: true },
          },
        },
        { injuryFrequency: "medium", durationDays: 30 },
      );
    }
  });

  it("forces playInEnabled false, difficulty normal, frequency daily", () => {
    expectCanonical(
      {
        ...DEFAULT_GAME_SETTINGS,
        offseason: {
          freeAgency: { durationDays: 90, allowExtension: true },
        },
        playoffs: {
          ...DEFAULT_GAME_SETTINGS.playoffs,
          playInEnabled: true,
        },
        ai: { ...DEFAULT_GAME_SETTINGS.ai, difficulty: "hard" },
        simulation: { frequency: "weekly" },
      },
      {
        injuryFrequency: "medium",
        durationDays: 30,
        playInEnabled: false,
        difficulty: "normal",
        frequency: "daily",
      },
    );
  });
});

describe("resolveLeagueShape matrix", () => {
  it("8 teams, 2 conferences, divisions off → 1×4", () => {
    const result = tryResolveLeagueShape({
      teamCount: 8,
      conferenceCount: 2,
      divisionsEnabled: false,
    });
    expect(result).toEqual({
      ok: true,
      shape: {
        conferenceCount: 2,
        divisionsPerConference: 1,
        teamsPerDivision: 4,
        teamsPerConference: 4,
      },
    });
  });

  it("8 teams, 2 conferences, divisions on → 2×2", () => {
    const result = tryResolveLeagueShape({
      teamCount: 8,
      conferenceCount: 2,
      divisionsEnabled: true,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.shape.divisionsPerConference).toBe(2);
      expect(result.shape.teamsPerDivision).toBe(2);
    }
  });

  it("8 teams, 4 conferences, divisions off → valid engine shape", () => {
    const result = tryResolveLeagueShape({
      teamCount: 8,
      conferenceCount: 4,
      divisionsEnabled: false,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.shape.teamsPerDivision).toBe(2);
      expect(result.shape.divisionsPerConference).toBe(1);
    }
  });

  it("8 teams, 4 conferences, divisions on → invalid", () => {
    const result = tryResolveLeagueShape({
      teamCount: 8,
      conferenceCount: 4,
      divisionsEnabled: true,
    });
    expect(result.ok).toBe(false);
  });

  it("10 teams, 2 conferences, divisions on → invalid", () => {
    const result = tryResolveLeagueShape({
      teamCount: 10,
      conferenceCount: 2,
      divisionsEnabled: true,
    });
    expect(result.ok).toBe(false);
  });

  it("12 teams, 2 conferences, divisions on → 2×3", () => {
    const result = tryResolveLeagueShape({
      teamCount: 12,
      conferenceCount: 2,
      divisionsEnabled: true,
    });
    expect(result).toEqual({
      ok: true,
      shape: {
        conferenceCount: 2,
        divisionsPerConference: 2,
        teamsPerDivision: 3,
        teamsPerConference: 6,
      },
    });
  });

  it("30 teams, 2 conferences, divisions on → 3×5", () => {
    const result = tryResolveLeagueShape({
      teamCount: 30,
      conferenceCount: 2,
      divisionsEnabled: true,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.shape.divisionsPerConference).toBe(3);
      expect(result.shape.teamsPerDivision).toBe(5);
    }
  });
});
