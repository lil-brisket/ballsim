import { createContract } from "@/domain/entities/contract";
import { createDraftPick, draftPickIdFor } from "@/domain/entities/draft-pick";
import type { TradeProposal } from "@/domain/entities/trade-proposal";
import {
  asContractId,
  asPlayerId,
  asTeamId,
  type PlayerId,
  type TeamId,
} from "@/domain/ids";
import { createInitialGameState } from "@/state/create-initial-state";
import type { GameState } from "@/state/game-state";
import { generateDraftPicksForSeason } from "@/domain/draft-picks/generate-draft-picks";
import { createPlayer } from "../../factories/player";
import { TEST_NOW_ISO, TEST_RNG_SEED } from "../../helpers/determinism";

export type TradeFixtureOptions = {
  /** Players per team (default 10 — within 8–12 roster bounds). */
  rosterSize?: number;
  /** Salary for each contracted player in the current season year. */
  salary?: number;
  /** Override individual player salaries: teamId -> playerIndex -> salary */
  salaries?: Partial<Record<string, number[]>>;
};

/**
 * Minimal two-team trade world with contracts, rosters, payroll, and draft picks.
 */
export function createTradeFixture(
  options: TradeFixtureOptions = {},
): GameState {
  const rosterSize = options.rosterSize ?? 10;
  const defaultSalary = options.salary ?? 5_000_000;
  const base = createInitialGameState({
    saveId: "save_trade",
    rngSeed: TEST_RNG_SEED,
    nowIso: TEST_NOW_ISO,
  });

  // Reuse two existing teams from bootstrap for conference/division consistency.
  const existingTeamIds = Object.keys(base.world.teams).sort() as TeamId[];
  const teamAId = existingTeamIds[0]!;
  const teamBId = existingTeamIds[1]!;
  const year = base.competition.season.year;

  const players = { ...base.world.players };
  const contracts = { ...base.business.contracts };
  const teams = { ...base.world.teams };

  const teamARoster: PlayerId[] = [];
  const teamBRoster: PlayerId[] = [];

  for (let i = 0; i < rosterSize; i += 1) {
    const playerAId = asPlayerId(`player_a_${i}`);
    const contractAId = asContractId(`contract_a_${i}`);
    const salaryA =
      options.salaries?.[String(teamAId)]?.[i] ??
      options.salaries?.a?.[i] ??
      defaultSalary;
    players[playerAId] = createPlayer({
      id: playerAId,
      teamId: teamAId,
      contractId: contractAId,
    });
    contracts[contractAId] = createContract({
      id: contractAId,
      playerId: playerAId,
      teamId: teamAId,
      startYear: year,
      endYear: year + 1,
      salaryByYear: {
        [String(year)]: salaryA,
        [String(year + 1)]: salaryA,
      },
    });
    teamARoster.push(playerAId);

    const playerBId = asPlayerId(`player_b_${i}`);
    const contractBId = asContractId(`contract_b_${i}`);
    const salaryB =
      options.salaries?.[String(teamBId)]?.[i] ??
      options.salaries?.b?.[i] ??
      defaultSalary;
    players[playerBId] = createPlayer({
      id: playerBId,
      teamId: teamBId,
      contractId: contractBId,
    });
    contracts[contractBId] = createContract({
      id: contractBId,
      playerId: playerBId,
      teamId: teamBId,
      startYear: year,
      endYear: year + 1,
      salaryByYear: {
        [String(year)]: salaryB,
        [String(year + 1)]: salaryB,
      },
    });
    teamBRoster.push(playerBId);
  }

  teams[teamAId] = { ...teams[teamAId]!, roster: teamARoster };
  teams[teamBId] = { ...teams[teamBId]!, roster: teamBRoster };

  const draftPicks = generateDraftPicksForSeason(
    Object.values(teams),
    year,
  );

  const finances = { ...base.business.finances };
  const payrollA = teamARoster.length * defaultSalary;
  const payrollB = teamBRoster.length * defaultSalary;
  if (finances[teamAId]) {
    finances[teamAId] = { ...finances[teamAId]!, payroll: payrollA };
  }
  if (finances[teamBId]) {
    finances[teamBId] = { ...finances[teamBId]!, payroll: payrollB };
  }

  return {
    ...base,
    world: {
      ...base.world,
      teams,
      players,
      draftPicks,
    },
    business: {
      ...base.business,
      contracts,
      finances,
      tradeBlocks: {},
    },
    user: {
      ...base.user,
      controlledTeamId: teamAId,
    },
  };
}

export function teamIds(state: GameState): { teamA: TeamId; teamB: TeamId } {
  const ids = Object.keys(state.world.teams).sort() as TeamId[];
  return { teamA: ids[0]!, teamB: ids[1]! };
}

export function playerOnTeam(
  state: GameState,
  teamId: TeamId,
  index: number,
): PlayerId {
  return state.world.teams[teamId]!.roster[index]!;
}

export function pickForTeam(
  state: GameState,
  teamId: TeamId,
  yearOffset: number,
  round: 1 | 2,
): ReturnType<typeof draftPickIdFor> {
  const year = state.competition.season.year + yearOffset;
  return draftPickIdFor(teamId, year, round);
}

export function playerForPlayerProposal(
  state: GameState,
  indexA = 0,
  indexB = 0,
): TradeProposal {
  const { teamA, teamB } = teamIds(state);
  return {
    sideA: {
      teamId: teamA,
      playerIds: [playerOnTeam(state, teamA, indexA)],
      draftPickIds: [],
    },
    sideB: {
      teamId: teamB,
      playerIds: [playerOnTeam(state, teamB, indexB)],
      draftPickIds: [],
    },
  };
}

/** Expose createDraftPick for tests that need custom picks. */
export { createDraftPick, draftPickIdFor };
