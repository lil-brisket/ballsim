import { describe, expect, it } from "vitest";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import type { OffseasonStage } from "@/domain/entities/season";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import type { GameState } from "@/state/game-state";
import { getActiveOwnedFranchise } from "@/state/owner-context";
import { validateGameState } from "@/persistence/validate-game-state";
import {
  applyLeagueSettingsChanges,
  leagueSettingsAccessError,
  parseLeagueSettingsChanges,
  renameLeague,
  restrictedFreeAgencyLockReason,
  seasonFormatLockReason,
  setActiveFranchiseAiAssistance,
} from "@/systems/league-settings-edit";
import { bootstrapWorld } from "@/systems/world-pipeline";

function league(): GameState {
  const state = createInitialGameState({
    saveId: "league_settings_edit",
    rngSeed: 7,
    settings: CBL_GAME_SETTINGS,
  });
  return bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
}

/** Offseason after rollover: no schedule yet for the coming season. */
function offseason(stage: OffseasonStage = "none"): GameState {
  const state = league();
  return {
    ...state,
    competition: {
      ...state.competition,
      season: {
        ...state.competition.season,
        phase: "offseason",
        offseasonStage: stage,
      },
      schedule: {
        ...state.competition.schedule,
        gameIds: [],
        gameIdsByDate: {},
      },
      games: {},
    },
  };
}

function asOnlineMember(state: GameState, isHost: boolean): GameState {
  const teamId = state.user.activeOwnerTeamId;
  const participants = [
    {
      id: "p_host",
      displayName: "Host",
      teamIds: isHost ? [teamId] : ["other_team"],
      plannedTeamCount: 1,
      isHost: true,
      userId: "u_host",
    },
    {
      id: "p_guest",
      displayName: "Guest",
      teamIds: isHost ? ["other_team"] : [teamId],
      plannedTeamCount: 1,
      isHost: false,
      userId: "u_guest",
    },
  ];
  return {
    ...state,
    user: {
      ...state.user,
      participation: {
        mode: "online",
        participants,
        activeParticipantId: isHost ? "p_host" : "p_guest",
        readyParticipantIds: [],
        assignmentsConfirmed: true,
      },
    },
  } as GameState;
}

describe("applyLeagueSettingsChanges", () => {
  it("changes live rules at any point in the season", () => {
    const state = league();
    const next = applyLeagueSettingsChanges(state, {
      injuryFrequency: "high",
      financialRules: {
        salaryCapEnabled: false,
        salaryCap: 150_000_000,
        luxuryTaxEnabled: false,
        revenueSharingEnabled: false,
      },
      draftLotteryEnabled: false,
      restrictedFreeAgency: false,
    });
    expect(next.settings.injuryFrequency).toBe("high");
    expect(next.settings.financialRules.salaryCapEnabled).toBe(false);
    expect(next.settings.financialRules.salaryCap).toBe(150_000_000);
    expect(next.settings.financialRules.luxuryTaxEnabled).toBe(false);
    expect(next.settings.financialRules.revenueSharingEnabled).toBe(false);
    expect(next.settings.draftLottery.enabled).toBe(false);
    expect(next.settings.offseason.restrictedFreeAgency).toBe(false);
    // Untouched rules stay as they were.
    expect(next.settings.financialRules.staffBudget).toBe(
      state.settings.financialRules.staffBudget,
    );
    expect(() => validateGameState(next)).not.toThrow();
  });

  it("does not mutate the input state", () => {
    const state = league();
    const before = structuredClone(state.settings);
    applyLeagueSettingsChanges(state, { injuryFrequency: "low" });
    expect(state.settings).toEqual(before);
  });

  it("rejects amounts outside the setup ranges", () => {
    expect(() =>
      applyLeagueSettingsChanges(league(), {
        financialRules: { salaryCap: 1 },
      }),
    ).toThrow(/salaryCap/);
  });

  it("locks season format once the regular-season schedule exists", () => {
    const state = league();
    expect(seasonFormatLockReason(state)).not.toBeNull();
    expect(() =>
      applyLeagueSettingsChanges(state, {
        seasonFormat: { gamesPerTeam: 30, playoffTeams: 8, seriesLength: 7 },
      }),
    ).toThrow(/offseason/);
  });

  it("accepts an unchanged season format while locked", () => {
    const state = league();
    const { gamesPerTeam } = state.settings.regularSeason;
    const { playoffTeams, seriesLength } = state.settings.playoffs;
    expect(() =>
      applyLeagueSettingsChanges(state, {
        seasonFormat: { gamesPerTeam, playoffTeams, seriesLength },
        injuryFrequency: "low",
      }),
    ).not.toThrow();
  });

  it("changes season format in the offseason before the schedule is made", () => {
    const state = offseason();
    expect(seasonFormatLockReason(state)).toBeNull();
    const next = applyLeagueSettingsChanges(state, {
      seasonFormat: { gamesPerTeam: 30, playoffTeams: 6, seriesLength: 5 },
    });
    expect(next.settings.regularSeason.gamesPerTeam).toBe(30);
    expect(next.settings.playoffs.playoffTeams).toBe(6);
    expect(next.settings.playoffs.seriesLength).toBe(5);
  });

  it("rejects unsupported season formats", () => {
    const state = offseason();
    expect(() =>
      applyLeagueSettingsChanges(state, {
        seasonFormat: { gamesPerTeam: 31, playoffTeams: 8, seriesLength: 7 },
      }),
    ).toThrow(/games per team/);
    expect(() =>
      applyLeagueSettingsChanges(state, {
        seasonFormat: { gamesPerTeam: 22, playoffTeams: 16, seriesLength: 7 },
      }),
    ).toThrow(/cannot exceed the 12 teams/);
    expect(() =>
      applyLeagueSettingsChanges(state, {
        seasonFormat: { gamesPerTeam: 22, playoffTeams: 8, seriesLength: 4 },
      }),
    ).toThrow(/Series length/);
  });

  it("locks restricted free agency during the offseason RFA window", () => {
    for (const stage of [
      "contract_expiration",
      "roster_decisions",
      "draft_preparation",
      "free_agency",
    ] as const) {
      const state = offseason(stage);
      expect(restrictedFreeAgencyLockReason(state)).not.toBeNull();
      expect(() =>
        applyLeagueSettingsChanges(state, { restrictedFreeAgency: false }),
      ).toThrow(/after free agency/);
    }
    expect(restrictedFreeAgencyLockReason(offseason("draft"))).toBeNull();
    expect(restrictedFreeAgencyLockReason(offseason("none"))).toBeNull();
  });

  it("lets only the host change rules in an online league", () => {
    const guest = asOnlineMember(league(), false);
    expect(leagueSettingsAccessError(guest)).not.toBeNull();
    expect(() =>
      applyLeagueSettingsChanges(guest, { injuryFrequency: "low" }),
    ).toThrow(/host/);
    const host = asOnlineMember(league(), true);
    expect(leagueSettingsAccessError(host)).toBeNull();
    expect(
      applyLeagueSettingsChanges(host, { injuryFrequency: "low" }).settings
        .injuryFrequency,
    ).toBe("low");
  });
});

describe("parseLeagueSettingsChanges", () => {
  it("keeps known keys and drops unknown ones", () => {
    expect(
      parseLeagueSettingsChanges({
        injuryFrequency: "low",
        financialRules: { salaryCap: 120_000_000, luxuryTaxBaseRate: 9 },
        draftLotteryEnabled: true,
        ownership: { controlledTeamCount: 5 },
      }),
    ).toEqual({
      injuryFrequency: "low",
      financialRules: { salaryCap: 120_000_000 },
      draftLotteryEnabled: true,
    });
  });

  it("rejects wrongly typed values", () => {
    expect(() => parseLeagueSettingsChanges(null)).toThrow();
    expect(() =>
      parseLeagueSettingsChanges({ injuryFrequency: "extreme" }),
    ).toThrow();
    expect(() =>
      parseLeagueSettingsChanges({ financialRules: { salaryCap: "10" } }),
    ).toThrow();
    expect(() =>
      parseLeagueSettingsChanges({ seasonFormat: { gamesPerTeam: 82 } }),
    ).toThrow();
    expect(() =>
      parseLeagueSettingsChanges({ restrictedFreeAgency: "yes" }),
    ).toThrow();
  });
});

describe("renameLeague", () => {
  it("trims and collapses whitespace", () => {
    const next = renameLeague(league(), "  Pacific   Hoops League ");
    expect(next.world.league.name).toBe("Pacific Hoops League");
  });

  it("rejects empty and overlong names", () => {
    expect(() => renameLeague(league(), "   ")).toThrow(/empty/);
    expect(() => renameLeague(league(), "x".repeat(61))).toThrow(/60/);
  });

  it("is host-only in an online league", () => {
    expect(() =>
      renameLeague(asOnlineMember(league(), false), "Guest League"),
    ).toThrow(/host/);
  });
});

describe("setActiveFranchiseAiAssistance", () => {
  it("replaces the active franchise's delegation", () => {
    const state = league();
    const current = getActiveOwnedFranchise(state).aiAssistance;
    const assistance = { ...current, trades: "off" as const };
    const next = setActiveFranchiseAiAssistance(state, assistance);
    expect(getActiveOwnedFranchise(next).aiAssistance).toEqual(assistance);
    expect(getActiveOwnedFranchise(next).managementPreset).toBe("custom");
    expect(next.settings.ai).toEqual(state.settings.ai);
    expect(() => validateGameState(next)).not.toThrow();
  });

  it("is allowed for online guests on their own franchise", () => {
    const guest = asOnlineMember(league(), false);
    const current = getActiveOwnedFranchise(guest).aiAssistance;
    expect(() =>
      setActiveFranchiseAiAssistance(guest, { ...current }),
    ).not.toThrow();
  });

  it("rejects missing or invalid phase modes", () => {
    const state = league();
    const current = getActiveOwnedFranchise(state).aiAssistance;
    expect(() => setActiveFranchiseAiAssistance(state, null)).toThrow();
    expect(() =>
      setActiveFranchiseAiAssistance(state, { ...current, trades: "bogus" }),
    ).toThrow();
    const { trades: _trades, ...missing } = current;
    expect(() => setActiveFranchiseAiAssistance(state, missing)).toThrow();
  });
});
