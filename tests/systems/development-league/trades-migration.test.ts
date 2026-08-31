import { describe, expect, it } from "vitest";
import { createContract } from "@/domain/entities/contract";
import { createDefaultDevelopmentLeagueProfile } from "@/domain/entities/development-league";
import { createPlayer } from "@/domain/entities/player";
import type { TradeProposal } from "@/domain/entities/trade-proposal";
import { asContractId, asPlayerId, asTeamId } from "@/domain/ids";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";
import { GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";
import { createTestGameState } from "../../factories/game-state";
import {
  createPlayer as createTestPlayer,
  uniformPlayerAttributes,
} from "../../factories/player";
import { assignPlayerToDevelopmentLeague } from "@/systems/development-league/assignment";
import { isPlayerDlAssigned } from "@/systems/development-league/franchise-membership";
import { executeTrade } from "@/systems/trades/trade-execution";

function seedDraftedPlayer(
  state: ReturnType<typeof createTestGameState>,
  opts: {
    playerId: string;
    teamId: string;
    overall?: number;
    potential?: number;
    draftYear?: number;
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
      age: 21,
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
    salaryByYear: { [String(year)]: 1_200_000, [String(year + 1)]: 1_200_000 },
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

describe("Development League trades", () => {
  it("preserves DL history and keeps player off top-league roster after trade", () => {
    let state = createTestGameState();
    const teamA = state.user.activeOwnerTeamId;
    const teamB = (Object.keys(state.world.teams) as string[]).find(
      (id) => id !== teamA,
    )!;
    // Pad both top-league rosters to satisfy min roster size after trade
    for (let i = 0; i < 9; i += 1) {
      state = seedDraftedPlayer(state, {
        playerId: `pad_a_${i}`,
        teamId: teamA,
        overall: 70 + (i % 5),
        potential: 75,
      });
      state = seedDraftedPlayer(state, {
        playerId: `pad_b_${i}`,
        teamId: teamB,
        overall: 71 + (i % 5),
        potential: 74,
      });
    }
    state = seedDraftedPlayer(state, { playerId: "tr_dl1", teamId: teamA });
    state = seedDraftedPlayer(state, {
      playerId: "tr_tl1",
      teamId: teamB,
      overall: 70,
      potential: 72,
    });
    state = assignPlayerToDevelopmentLeague(
      state,
      asPlayerId("tr_dl1"),
      asTeamId(teamA),
    ).state;
    state = {
      ...state,
      world: {
        ...state.world,
        players: {
          ...state.world.players,
          tr_dl1: createPlayer({
            ...state.world.players["tr_dl1"]!,
            developmentLeague: {
              ...state.world.players["tr_dl1"]!.developmentLeague,
              seasonsUsed: 1,
              firstAssignedSeasonYear: state.competition.season.year,
            },
          }),
        },
      },
    };

    const proposal: TradeProposal = {
      sideA: {
        teamId: asTeamId(teamA),
        playerIds: [asPlayerId("tr_dl1")],
        draftPickIds: [],
      },
      sideB: {
        teamId: asTeamId(teamB),
        playerIds: [asPlayerId("tr_tl1")],
        draftPickIds: [],
      },
    };
    const traded = executeTrade(state, proposal);
    expect(traded.success).toBe(true);
    state = traded.state;
    const player = state.world.players["tr_dl1"]!;
    expect(player.teamId).toBe(teamB);
    expect(isPlayerDlAssigned(player)).toBe(true);
    expect(player.developmentLeague.seasonsUsed).toBe(1);
    expect(player.developmentLeague.parentTeamId).toBe(teamB);
    expect(state.world.teams[teamB]!.roster).not.toContain("tr_dl1");
  });
});

describe("Development League migration", () => {
  it("loads v55 payload into current schema with DL defaults", () => {
    let modern = createTestGameState({ saveId: "mig_dl_v56" });
    modern = seedDraftedPlayer(modern, {
      playerId: "mig_p1",
      teamId: modern.user.activeOwnerTeamId,
    });
    const parsed = JSON.parse(serializeGameState(modern)) as Record<
      string,
      unknown
    >;
    parsed.meta = {
      ...(parsed.meta as object),
      schemaVersion: 55,
    };
    const competition = parsed.competition as Record<string, unknown>;
    delete competition.developmentLeague;
    const world = parsed.world as {
      players: Record<string, Record<string, unknown>>;
    };
    for (const player of Object.values(world.players)) {
      delete player.developmentLeague;
    }
    const migrated = deserializeGameState(JSON.stringify(parsed));
    expect(migrated.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    expect(migrated.competition.developmentLeague).toBeDefined();
    expect(migrated.competition.developmentLeague.schedule.gameIds).toEqual(
      [],
    );
    const sample = migrated.world.players["mig_p1"]!;
    expect(sample.developmentLeague.status).toBe("none");
    expect(sample.developmentLeague.seasonsUsed).toBe(0);
  });
});
