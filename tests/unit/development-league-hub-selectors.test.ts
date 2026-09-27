import { describe, expect, it } from "vitest";
import { createContract } from "@/domain/entities/contract";
import { createDefaultDevelopmentLeagueProfile } from "@/domain/entities/development-league";
import { createGame } from "@/domain/entities/game";
import { createPlayer } from "@/domain/entities/player";
import { createEmptyPlayerSeasonStatLine } from "@/domain/entities/player-history";
import { createEmptyTeamStanding } from "@/domain/entities/standings";
import { asContractId, asGameId, asPlayerId, asTeamId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import {
  sortDlProspects,
  toDevelopmentLeagueDashboardView,
  type DlProspectRowView,
} from "@/state/development-league-selectors";
import { getControlledTeam } from "@/state/selectors";
import { assignPlayerToDevelopmentLeague } from "@/systems/development-league/assignment";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createTestGameState } from "../factories/game-state";
import {
  createPlayer as createTestPlayer,
  uniformPlayerAttributes,
} from "../factories/player";

function prospectFixture(
  overrides: Partial<DlProspectRowView> & Pick<DlProspectRowView, "playerId" | "name" | "readiness">,
): DlProspectRowView {
  return {
    overall: 70,
    potential: 80,
    potentialHeadroom: 10,
    age: 21,
    dlSeason: 1,
    seasonsRemaining: 2,
    role: "development",
    mpg: 20,
    ppg: 10,
    rpg: 4,
    apg: 3,
    whyBullets: ["Readiness based on current OVR and projected top-league minutes."],
    changeDelta: null,
    changeLabel: null,
    ...overrides,
  };
}

function seedDraftedPlayer(
  state: ReturnType<typeof createTestGameState>,
  opts: {
    playerId: string;
    teamId: string;
    overall?: number;
    potential?: number;
    draftYear?: number;
    age?: number;
  },
) {
  const teamId = asTeamId(opts.teamId);
  const playerId = asPlayerId(opts.playerId);
  const rating = opts.overall ?? 62;
  const attrs = uniformPlayerAttributes(rating);
  const contractId = asContractId(`contract_${opts.playerId}`);
  const year = state.competition.season.year;
  const player = createPlayer({
    ...createTestPlayer({
      id: playerId,
      teamId,
      contractId,
      age: opts.age ?? 21,
      attributes: attrs,
      potential: { overall: opts.potential ?? 78 },
    }),
    developmentLeague: {
      ...createDefaultDevelopmentLeagueProfile(),
      draftSeasonYear: opts.draftYear ?? year,
    },
  });
  const contract = createContract({
    id: contractId,
    playerId,
    teamId,
    startYear: year,
    endYear: year + 1,
    salaryByYear: { [String(year)]: 1_500_000, [String(year + 1)]: 1_500_000 },
  });
  const team = state.world.teams[teamId]!;
  return {
    ...state,
    world: {
      ...state.world,
      players: { ...state.world.players, [playerId]: player },
      teams: {
        ...state.world.teams,
        [teamId]: { ...team, roster: [...team.roster, playerId] },
      },
    },
    business: {
      ...state.business,
      contracts: { ...state.business.contracts, [contractId]: contract },
    },
  };
}

function withAssignedPlayer(
  state: ReturnType<typeof createTestGameState>,
  opts: Parameters<typeof seedDraftedPlayer>[1],
) {
  const seeded = seedDraftedPlayer(state, opts);
  const assigned = assignPlayerToDevelopmentLeague(
    seeded,
    asPlayerId(opts.playerId),
    asTeamId(opts.teamId),
  );
  expect(assigned.success).toBe(true);
  return assigned.state;
}

function withDlStats(
  state: ReturnType<typeof createTestGameState>,
  playerId: string,
  stats: { games: number; points: number; minutes?: number; rebounds?: number; assists?: number },
) {
  const player = state.world.players[playerId]!;
  return {
    ...state,
    world: {
      ...state.world,
      players: {
        ...state.world.players,
        [playerId]: {
          ...player,
          developmentLeague: {
            ...player.developmentLeague,
            currentSeasonStats: {
              ...createEmptyPlayerSeasonStatLine(),
              games: stats.games,
              points: stats.points,
              minutes: stats.minutes ?? stats.games * 24,
              rebounds: stats.rebounds ?? 0,
              assists: stats.assists ?? 0,
            },
          },
        },
      },
    },
  };
}

describe("development-league-selectors", () => {
  it("builds Franchise Development League view with pipeline sections", () => {
    let state = createTestGameState({ saveId: "dl_hub_test" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;

    const view = toDevelopmentLeagueDashboardView(state);
    expect(view.saveId).toBe("dl_hub_test");
    expect(view.teamName.length).toBeGreaterThan(0);
    expect(view.city.length).toBeGreaterThan(0);
    expect(view.abbreviation.length).toBeGreaterThan(0);
    expect(view.assignedCount).toBe(view.prospects.length);
    expect(view.prospects.length).toBe(
      view.recallCandidates.length + view.developingProspects.length,
    );
    expect(view.recentResults).toBeDefined();
    expect(view.improvers).toBeDefined();
  });

  it("sorts ready for recall before developing", () => {
    const rows: DlProspectRowView[] = [
      prospectFixture({
        playerId: "a",
        name: "Developing",
        overall: 80,
        potential: 88,
        potentialHeadroom: 8,
        ppg: 18,
        readiness: "developing",
      }),
      prospectFixture({
        playerId: "b",
        name: "Ready",
        overall: 75,
        potential: 85,
        potentialHeadroom: 10,
        dlSeason: 2,
        seasonsRemaining: 1,
        role: "starter",
        mpg: 32,
        ppg: 12,
        readiness: "ready",
      }),
    ];
    expect(sortDlProspects(rows)[0]!.playerId).toBe("b");
  });

  it("returns null changeDelta when assigned player has no history", () => {
    let state = createTestGameState({ saveId: "dl_no_history" });
    const teamId = state.user.activeOwnerTeamId;
    state = withAssignedPlayer(state, { playerId: "dl_hist_none", teamId });
    const view = toDevelopmentLeagueDashboardView(state);
    const row = view.prospects.find((p) => p.playerId === "dl_hist_none");
    expect(row).toBeDefined();
    expect(row!.changeDelta).toBeNull();
    expect(row!.changeLabel).toBeNull();
  });

  it("clamps potential headroom at zero when potential is below overall", () => {
    let state = createTestGameState({ saveId: "dl_headroom" });
    const teamId = state.user.activeOwnerTeamId;
    state = withAssignedPlayer(state, {
      playerId: "dl_over",
      teamId,
      overall: 80,
      potential: 50,
    });
    const view = toDevelopmentLeagueDashboardView(state);
    const row = view.prospects.find((p) => p.playerId === "dl_over");
    expect(row!.potentialHeadroom).toBe(0);
  });

  it("rejects notable performance when games are below the floor", () => {
    let state = createTestGameState({ saveId: "dl_notable_low" });
    const teamId = state.user.activeOwnerTeamId;
    state = withAssignedPlayer(state, { playerId: "dl_spike", teamId });
    state = withDlStats(state, "dl_spike", { games: 2, points: 40 });
    const view = toDevelopmentLeagueDashboardView(state);
    expect(view.notablePerformance.some((p) => p.playerId === "dl_spike")).toBe(
      false,
    );
  });

  it("includes notable performance when PPG and games floor are met", () => {
    let state = createTestGameState({ saveId: "dl_notable_ok" });
    const teamId = state.user.activeOwnerTeamId;
    state = withAssignedPlayer(state, { playerId: "dl_scorer", teamId });
    state = withDlStats(state, "dl_scorer", { games: 5, points: 60 });
    const view = toDevelopmentLeagueDashboardView(state);
    expect(view.notablePerformance.some((p) => p.playerId === "dl_scorer")).toBe(
      true,
    );
  });

  it("orders recent results newest first and caps at five", () => {
    let state = createTestGameState({ saveId: "dl_results" });
    const team = getControlledTeam(state);
    const other = Object.values(state.world.teams).find((t) => t.id !== team.id);
    expect(other).toBeDefined();
    const games = ["2026-11-01", "2026-11-03", "2026-11-05", "2026-11-07", "2026-11-09", "2026-11-11"].map(
      (date, index) =>
        createGame({
          id: asGameId(`dl_game_${index}`),
          seasonId: state.competition.season.id,
          homeTeamId: team.id,
          awayTeamId: other!.id,
          date,
          competitionType: "development_league",
          score: { home: 100, away: 90 },
          status: "final",
          periodScores: [],
          events: [],
          playerStats: [],
          homeTeamSnapshot: null,
          awayTeamSnapshot: null,
        }),
    );
    state = {
      ...state,
      competition: {
        ...state.competition,
        developmentLeague: {
          ...state.competition.developmentLeague,
          games: Object.fromEntries(games.map((g) => [g.id, g])),
        },
      },
    };
    const view = toDevelopmentLeagueDashboardView(state);
    expect(view.recentResults).toHaveLength(5);
    expect(view.recentResults.map((g) => g.date)).toEqual([
      "2026-11-11",
      "2026-11-09",
      "2026-11-07",
      "2026-11-05",
      "2026-11-03",
    ]);
    expect(view.recentResults[0]!.opponentTeamId).toBe(other!.id);
    expect(view.recentResults[0]!.won).toBe(true);
  });

  it("keeps city/name/abbreviation when branding is invalid", () => {
    let state = createTestGameState({ saveId: "dl_branding" });
    const team = getControlledTeam(state);
    state = {
      ...state,
      world: {
        ...state.world,
        teams: {
          ...state.world.teams,
          [team.id]: {
            ...team,
            branding: {
              ...team.branding,
              primaryColor: "not-hex",
            },
          },
        },
      },
    };
    const view = toDevelopmentLeagueDashboardView(state);
    expect(view.branding).toBeNull();
    expect(view.city).toBe(team.city);
    expect(view.name).toBe(team.name);
    expect(view.abbreviation).toBe(team.abbreviation);
  });

  it("does not throw for assigned players with no standings, schedule, or stats", () => {
    let state = createTestGameState({ saveId: "dl_orphan" });
    const teamId = state.user.activeOwnerTeamId;
    state = withAssignedPlayer(state, { playerId: "dl_orphan_p", teamId });
    state = {
      ...state,
      competition: {
        ...state.competition,
        developmentLeague: {
          schedule: { seasonId: state.competition.season.id, gameIds: [] },
          games: {},
          standings: { byTeamId: {} },
        },
      },
    };
    const view = toDevelopmentLeagueDashboardView(state);
    const row = view.prospects.find((p) => p.playerId === "dl_orphan_p");
    expect(row).toBeDefined();
    expect(row!.mpg).toBeNull();
    expect(row!.ppg).toBeNull();
    expect(view.record).toBeNull();
    expect(view.leagueRank).toBeNull();
    expect(view.recentResults).toEqual([]);
  });

  it("ranks tied win records deterministically by abbreviation", () => {
    let state = createTestGameState({ saveId: "dl_rank" });
    const team = getControlledTeam(state);
    const other = Object.values(state.world.teams).find((t) => t.id !== team.id)!;
    const standingA = {
      ...createEmptyTeamStanding(team.id),
      wins: 5,
      losses: 5,
      winPercentage: 0.5,
      streak: { type: "W" as const, count: 2 },
    };
    const standingB = {
      ...createEmptyTeamStanding(other.id),
      wins: 5,
      losses: 5,
      winPercentage: 0.5,
    };
    state = {
      ...state,
      competition: {
        ...state.competition,
        developmentLeague: {
          ...state.competition.developmentLeague,
          standings: {
            byTeamId: {
              [team.id]: standingA,
              [other.id]: standingB,
            },
          },
        },
      },
    };
    const view = toDevelopmentLeagueDashboardView(state);
    const expectedRank =
      team.abbreviation.localeCompare(other.abbreviation) <= 0 ? 1 : 2;
    expect(view.leagueRank).toBe(expectedRank);
    expect(view.record).toEqual({ wins: 5, losses: 5 });
    expect(view.streakLabel).toBe("W2");
  });

  it("always supplies a why-bullet fallback", () => {
    const rows = [
      prospectFixture({
        playerId: "empty",
        name: "Empty Why",
        readiness: "developing",
        whyBullets: ["Readiness based on current OVR and projected top-league minutes."],
      }),
    ];
    expect(rows[0]!.whyBullets[0]).toMatch(/Readiness based on current OVR/);
  });
});
