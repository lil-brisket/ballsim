import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { bootstrapWorld, runWorldPipeline } from "@/systems/world-pipeline";
import { beginRegularSeasonFromPreseason } from "@/systems/simulation/season-lifecycle";
import { generateRosters, fillShortRosters } from "@/systems/roster-generation";
import {
  DEFAULT_ROSTER_SIZE,
  OPENING_FREE_AGENT_COUNT,
} from "@/systems/roster-generation-config";
import { generateSchedule } from "@/systems/schedule-generation";
import { resetDomainEventSequenceForTests } from "@/domain/events/domain-event";
import {
  isPlayerNationality,
  PLAYER_NATIONALITIES,
} from "@/domain/entities/player-nationality";

describe("roster and schedule generation", () => {
  it("fills players and contracts for every team", () => {
    const state = createInitialGameState({
      saveId: "save_roster",
      rngSeed: 11,
      nowIso: "2026-08-13T12:00:00.000Z",
      settings: CBL_GAME_SETTINGS,
    });
    const rng = createSeededRng(state.meta.rngState);
    const result = generateRosters(state, rng);

    const teamCount = Object.keys(state.world.teams).length;
    // Rostered players plus the unsigned opening free agents.
    expect(Object.keys(result.state.world.players)).toHaveLength(
      teamCount * DEFAULT_ROSTER_SIZE + OPENING_FREE_AGENT_COUNT,
    );
    expect(Object.keys(result.state.business.contracts)).toHaveLength(
      teamCount * DEFAULT_ROSTER_SIZE,
    );
  });

  it("assigns a valid nationality to every generated player", () => {
    const state = createInitialGameState({
      saveId: "save_roster_nationality",
      rngSeed: 19,
      nowIso: "2026-08-13T12:00:00.000Z",
      settings: CBL_GAME_SETTINGS,
    });
    const rng = createSeededRng(state.meta.rngState);
    const result = generateRosters(state, rng);

    const players = Object.values(result.state.world.players);
    expect(players.length).toBeGreaterThan(0);
    for (const player of players) {
      expect(isPlayerNationality(player.nationality)).toBe(true);
      expect(PLAYER_NATIONALITIES).toContain(player.nationality);
      expect(player.firstName.length).toBeGreaterThan(0);
      expect(player.lastName.length).toBeGreaterThan(0);
    }
  });

  it("is idempotent when players already exist", () => {
    const state = createInitialGameState({
      saveId: "save_roster_once",
      rngSeed: 12,
      settings: CBL_GAME_SETTINGS,
    });
    const rng = createSeededRng(state.meta.rngState);
    const first = generateRosters(state, rng);
    const second = generateRosters(first.state, rng);
    expect(second.state.world.players).toEqual(first.state.world.players);
  });

  it("writes Team.roster so player.teamId and roster membership stay consistent", () => {
    const state = createInitialGameState({
      saveId: "save_roster_dual",
      rngSeed: 21,
      nowIso: "2026-08-13T12:00:00.000Z",
      settings: CBL_GAME_SETTINGS,
    });
    const rng = createSeededRng(state.meta.rngState);
    const result = generateRosters(state, rng);

    for (const team of Object.values(result.state.world.teams)) {
      expect(team.roster).toHaveLength(DEFAULT_ROSTER_SIZE);
      for (const playerId of team.roster) {
        const player = result.state.world.players[playerId];
        expect(player).toBeDefined();
        expect(player!.teamId).toBe(team.id);
      }
    }

    const signed = Object.values(result.state.world.players).filter(
      (player) => player.teamId !== null,
    );
    expect(signed).toHaveLength(
      Object.keys(result.state.world.teams).length * DEFAULT_ROSTER_SIZE,
    );
    for (const player of signed) {
      const team = result.state.world.teams[player.teamId!];
      expect(team).toBeDefined();
      expect(team!.roster).toContain(player.id);
    }
  });

  it("replenishes short rosters up to DEFAULT_ROSTER_SIZE", () => {
    const state = createInitialGameState({
      saveId: "save_roster_fill",
      rngSeed: 22,
      nowIso: "2026-08-13T12:00:00.000Z",
      settings: CBL_GAME_SETTINGS,
    });
    const rng = createSeededRng(state.meta.rngState);
    const generated = generateRosters(state, rng).state;
    // An AI team: an owner's team is only filled up to the roster minimum.
    const teamId = Object.keys(generated.world.teams)
      .sort()
      .find((id) => id !== generated.user.activeOwnerTeamId)!;
    const team = generated.world.teams[teamId]!;
    const shortened = {
      ...generated,
      world: {
        ...generated.world,
        teams: {
          ...generated.world.teams,
          [teamId]: { ...team, roster: team.roster.slice(0, 4) },
        },
      },
    };
    const filled = fillShortRosters(shortened, rng);
    expect(filled.state.world.teams[teamId]!.roster).toHaveLength(
      DEFAULT_ROSTER_SIZE,
    );
    const again = fillShortRosters(filled.state, rng);
    expect(again.state.world.teams[teamId]!.roster).toEqual(
      filled.state.world.teams[teamId]!.roster,
    );
  });

  it("builds a double round-robin without changing season phase", () => {
    const state = createInitialGameState({
      saveId: "save_sched",
      rngSeed: 13,
      nowIso: "2026-08-13T12:00:00.000Z",
      settings: CBL_GAME_SETTINGS,
    });
    const result = generateSchedule(state);
    const teamCount = Object.keys(state.world.teams).length;
    const expectedGames = teamCount * (teamCount - 1);

    expect(result.state.competition.schedule.gameIds).toHaveLength(
      expectedGames,
    );
    expect(result.state.competition.season.phase).toBe("preseason");
    expect(
      Object.values(result.state.competition.games).every(
        (game) => game.status === "scheduled" && game.playerStats.length === 0,
      ),
    ).toBe(true);

    // Round 1 lands on the planned regular-season opener (not preseason currentDate).
    const firstDate = "2026-10-01";
    const firstRoundGames = Object.values(
      result.state.competition.games,
    ).filter((game) => game.date === firstDate);
    expect(firstRoundGames.length).toBe(teamCount / 2);
    expect(
      Object.values(result.state.competition.games).every(
        (game) => game.date >= firstDate,
      ),
    ).toBe(true);
  });

  it("throws when the empty schedule has fewer than two teams", () => {
    const state = createInitialGameState({
      saveId: "save_sched_empty",
      rngSeed: 14,
      nowIso: "2026-08-13T12:00:00.000Z",
      settings: CBL_GAME_SETTINGS,
    });
    const emptyTeams = {
      ...state,
      world: {
        ...state.world,
        teams: {},
      },
      competition: {
        ...state.competition,
        schedule: {
          seasonId: state.competition.season.id,
          gameIds: [],
        },
        games: {},
      },
    };
    expect(() => generateSchedule(emptyTeams)).toThrow(/at least 2 teams/);
  });
});

describe("world pipeline advanceDay", () => {
  it("materializes schedule during bootstrap without changing phase", () => {
    resetDomainEventSequenceForTests();
    const state = createInitialGameState({
      saveId: "save_bootstrap_sched",
      rngSeed: 40,
      nowIso: "2026-08-13T12:00:00.000Z",
      settings: CBL_GAME_SETTINGS,
    });
    const rng = createSeededRng(state.meta.rngState);
    const bootstrapped = bootstrapWorld(state, rng);

    expect(
      bootstrapped.state.competition.schedule.gameIds.length,
    ).toBeGreaterThan(0);
    expect(bootstrapped.state.competition.season.phase).toBe("preseason");
    expect(
      bootstrapped.state.competition.season.regularSeasonStartDate,
    ).toBeNull();
    expect(
      Object.values(bootstrapped.state.competition.games).every(
        (game) => game.status === "scheduled",
      ),
    ).toBe(true);
  });

  it("does not duplicate schedule when bootstrap runs on an existing regular-season save", () => {
    resetDomainEventSequenceForTests();
    const state = createInitialGameState({
      saveId: "save_bootstrap_idempotent",
      rngSeed: 41,
      nowIso: "2026-08-13T12:00:00.000Z",
      settings: CBL_GAME_SETTINGS,
    });
    const rng = createSeededRng(state.meta.rngState);
    let current = bootstrapWorld(state, rng).state;
    current = beginRegularSeasonFromPreseason(current).state;
    expect(current.competition.season.phase).toBe("regular");

    const gameIdsBefore = [...current.competition.schedule.gameIds];
    const gamesBefore = { ...current.competition.games };
    const phaseBefore = current.competition.season.phase;
    const dateBefore = current.world.calendar.currentDate;

    const again = bootstrapWorld(current, rng);
    expect(again.state.competition.schedule.gameIds).toEqual(gameIdsBefore);
    expect(Object.keys(again.state.competition.games).sort()).toEqual(
      Object.keys(gamesBefore).sort(),
    );
    expect(again.state.competition.season.phase).toBe(phaseBefore);
    expect(again.state.world.calendar.currentDate).toBe(dateBefore);
  });

  it("bootstraps, opens regular season without playing opener, then sims on next day", () => {
    resetDomainEventSequenceForTests();
    const state = createInitialGameState({
      saveId: "save_advance",
      rngSeed: 42,
      nowIso: "2026-08-13T12:00:00.000Z",
      settings: CBL_GAME_SETTINGS,
    });
    const rng = createSeededRng(state.meta.rngState);
    const bootstrapped = bootstrapWorld(state, rng);

    expect(
      bootstrapped.state.competition.schedule.gameIds.length,
    ).toBeGreaterThan(0);
    expect(bootstrapped.state.competition.season.phase).toBe("preseason");
    expect(bootstrapped.state.world.calendar.currentDate).toBe("2026-09-10");

    // Explicit open snaps to planned opener without playing games.
    const opened = beginRegularSeasonFromPreseason(bootstrapped.state);

    expect(opened.state.world.calendar.currentDate).toBe("2026-10-01");
    expect(opened.state.competition.season.phase).toBe("regular");
    expect(opened.state.competition.season.regularSeasonStartDate).toBe(
      "2026-10-01",
    );
    expect(opened.state.competition.schedule.gameIds).toEqual(
      bootstrapped.state.competition.schedule.gameIds,
    );

    const openerGames = Object.values(opened.state.competition.games).filter(
      (game) => game.date === "2026-10-01",
    );
    expect(openerGames.length).toBeGreaterThan(0);
    expect(openerGames.every((game) => game.status === "scheduled")).toBe(true);

    // Next day: play opener and advance calendar.
    const advanced = runWorldPipeline(opened.state, rng, {
      type: "advanceDay",
    });

    expect(advanced.state.world.calendar.currentDate).toBe("2026-10-02");
    expect(
      advanced.events.some((event) => event.type === "GameCompleted"),
    ).toBe(true);

    const finalOpeners = Object.values(advanced.state.competition.games).filter(
      (game) => game.date === "2026-10-01",
    );
    expect(finalOpeners.every((game) => game.status === "final")).toBe(true);

    const standing = Object.values(
      advanced.state.competition.standings.byTeamId,
    );
    const totalDecisions = standing.reduce(
      (acc, row) => acc + row.wins + row.losses,
      0,
    );
    // 12 teams → 6 games per round; opener contributes 12 decisions (6 wins + 6 losses).
    const teamCount = Object.keys(bootstrapped.state.world.teams).length;
    expect(totalDecisions).toBe(teamCount);
  });
});
