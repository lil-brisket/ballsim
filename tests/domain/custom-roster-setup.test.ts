import { describe, expect, it } from "vitest";
import { applyCustomRosterTeamCount } from "@/domain/custom-roster-setup";
import { DEFAULT_GAME_SETTINGS } from "@/domain/game-settings";
import { validateGameSettings } from "@/domain/game-settings-validation";

describe("applyCustomRosterTeamCount", () => {
  it("sets a 12-team custom roster onto Standard defaults", () => {
    const next = applyCustomRosterTeamCount(DEFAULT_GAME_SETTINGS, 12);
    expect(next.league.teamCount).toBe(12);
    expect(next.playoffs.playoffTeams).toBe(12);
    expect(next.draft.mode).toBe("custom");
    expect(validateGameSettings(next).ok).toBe(true);
  });

  it("keeps a valid playoff size when it still fits", () => {
    const settings = {
      ...DEFAULT_GAME_SETTINGS,
      playoffs: { ...DEFAULT_GAME_SETTINGS.playoffs, playoffTeams: 8 },
    };
    const next = applyCustomRosterTeamCount(settings, 12);
    expect(next.playoffs.playoffTeams).toBe(8);
  });

  it("disables divisions when the roster size cannot support them", () => {
    const next = applyCustomRosterTeamCount(DEFAULT_GAME_SETTINGS, 10);
    expect(next.league.teamCount).toBe(10);
    expect(next.league.conferenceCount).toBe(2);
    expect(next.league.divisionsEnabled).toBe(false);
    expect(next.playoffs.playoffTeams).toBe(8);
    expect(validateGameSettings(next).ok).toBe(true);
  });
});
