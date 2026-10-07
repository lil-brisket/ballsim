import { describe, expect, it } from "vitest";
import type { TradeProposal, TradeSide } from "@/domain/entities/trade-proposal";
import { DEFAULT_GAME_SETTINGS } from "@/domain/game-settings";
import type { DraftPickId, TeamId } from "@/domain/ids";
import { createSeededRng, type Rng } from "@/domain/rng";
import type { GameState } from "@/state/game-state";
import { canPerformAction } from "@/systems/league-rules";
import { getLeagueSalaryCap } from "@/systems/league-salary-cap";
import { getTeamPayroll } from "@/systems/salary-cap";
import { executeTrade } from "@/systems/trades";
import { TRADE_ROSTER_RULES } from "@/systems/trades-config";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createTestGameState } from "../../factories/game-state";
import { createTestRng, TEST_RNG_SEED } from "../../helpers/determinism";

const ITERATION_COUNT = 100;
const TIMEOUT_MS = 30_000;
const MAX_PLAYERS_PER_SIDE = 3;
const MAX_PICKS_PER_SIDE = 2;

function sampleUnique<T>(items: readonly T[], count: number, rng: Rng): T[] {
  if (count <= 0 || items.length === 0) {
    return [];
  }
  const remaining = [...items];
  const picked: T[] = [];
  const n = Math.min(count, remaining.length);
  for (let i = 0; i < n; i += 1) {
    const index = rng.nextInt(0, remaining.length - 1);
    picked.push(remaining.splice(index, 1)[0]!);
  }
  return picked;
}

function pickTwoDistinctTeams(teamIds: readonly TeamId[], rng: Rng): [TeamId, TeamId] {
  const indexA = rng.nextInt(0, teamIds.length - 1);
  let indexB = rng.nextInt(0, teamIds.length - 2);
  if (indexB >= indexA) {
    indexB += 1;
  }
  return [teamIds[indexA]!, teamIds[indexB]!];
}

function ownedPickIds(state: GameState, teamId: TeamId): DraftPickId[] {
  const ids: DraftPickId[] = [];
  for (const pick of Object.values(state.world.draftPicks)) {
    if (pick.ownerTeamId === teamId) {
      ids.push(pick.id);
    }
  }
  return ids;
}

function randomTradeSide(
  state: GameState,
  teamId: TeamId,
  rng: Rng,
): TradeSide {
  const roster = state.world.teams[teamId]!.roster;
  const picks = ownedPickIds(state, teamId);
  let playerIds = sampleUnique(
    roster,
    rng.nextInt(0, Math.min(MAX_PLAYERS_PER_SIDE, roster.length)),
    rng,
  );
  let draftPickIds = sampleUnique(
    picks,
    rng.nextInt(0, Math.min(MAX_PICKS_PER_SIDE, picks.length)),
    rng,
  );
  if (playerIds.length === 0 && draftPickIds.length === 0) {
    if (roster.length > 0 && picks.length > 0) {
      if (rng.chance(0.5)) {
        playerIds = [rng.pick(roster)];
      } else {
        draftPickIds = [rng.pick(picks)];
      }
    } else if (roster.length > 0) {
      playerIds = [rng.pick(roster)];
    } else if (picks.length > 0) {
      draftPickIds = [rng.pick(picks)];
    }
  }
  return { teamId, playerIds, draftPickIds };
}

function randomTradeProposal(
  state: GameState,
  teamIds: readonly TeamId[],
  rng: Rng,
): TradeProposal {
  const [teamA, teamB] = pickTwoDistinctTeams(teamIds, rng);
  return {
    sideA: randomTradeSide(state, teamA, rng),
    sideB: randomTradeSide(state, teamB, rng),
  };
}

function scaleContractsToLeagueCap(state: GameState): GameState {
  const year = state.competition.season.year;
  const cap = getLeagueSalaryCap(state);
  const scaleByTeamId = new Map<TeamId, number>();
  for (const team of Object.values(state.world.teams)) {
    const payroll = getTeamPayroll(team.id, year, state);
    if (payroll > cap) {
      scaleByTeamId.set(team.id, cap / payroll);
    }
  }
  if (scaleByTeamId.size === 0) {
    return state;
  }
  const contracts = { ...state.business.contracts };
  for (const contract of Object.values(contracts)) {
    const scale = scaleByTeamId.get(contract.teamId);
    if (scale === undefined) {
      continue;
    }
    const salaryByYear: Record<string, number> = {};
    for (const [yearKey, salary] of Object.entries(contract.salaryByYear)) {
      salaryByYear[yearKey] = Math.floor(salary * scale);
    }
    contracts[contract.id] = { ...contract, salaryByYear };
  }
  return {
    ...state,
    business: {
      ...state.business,
      contracts,
    },
  };
}

describe("thirty-team random trade invariants", () => {
  it(
    "keeps every roster between 8 and 15 and payroll at or under the salary cap after 100 random trades",
    () => {
      let state = createTestGameState({
        saveId: "save_thirty_team_trades",
        rngSeed: TEST_RNG_SEED,
        settings: DEFAULT_GAME_SETTINGS,
      });
      state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
      state = scaleContractsToLeagueCap(state);

      const teamIds = Object.keys(state.world.teams) as TeamId[];
      expect(teamIds).toHaveLength(DEFAULT_GAME_SETTINGS.league.teamCount);

      const loopRng = createTestRng(TEST_RNG_SEED);
      let executedCount = 0;

      for (let i = 0; i < ITERATION_COUNT; i += 1) {
        const proposal = randomTradeProposal(state, teamIds, loopRng);
        const guard = canPerformAction(state, { kind: "trade", proposal });
        if (!guard.allowed) {
          continue;
        }
        const result = executeTrade(state, proposal);
        if (result.success) {
          state = result.state;
          executedCount += 1;
        }
      }

      expect(executedCount).toBeGreaterThan(0);

      const year = state.competition.season.year;
      const hardCap = getLeagueSalaryCap(state);
      const minRoster = TRADE_ROSTER_RULES.minRosterSize;
      const maxRoster = TRADE_ROSTER_RULES.maxRosterSize;

      for (const team of Object.values(state.world.teams)) {
        expect(
          team.roster.length,
          `${team.id} roster size`,
        ).toBeGreaterThanOrEqual(minRoster);
        expect(team.roster.length, `${team.id} roster size`).toBeLessThanOrEqual(
          maxRoster,
        );
        expect(
          getTeamPayroll(team.id, year, state),
          `${team.id} payroll`,
        ).toBeLessThanOrEqual(hardCap);
      }
    },
    TIMEOUT_MS,
  );
});
