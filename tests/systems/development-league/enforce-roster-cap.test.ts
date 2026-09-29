import { describe, expect, it } from "vitest";
import { createContract } from "@/domain/entities/contract";
import { createDefaultDevelopmentLeagueProfile } from "@/domain/entities/development-league";
import { createPlayer } from "@/domain/entities/player";
import { asContractId, asPlayerId, asTeamId } from "@/domain/ids";
import {
  createRosterRulesConfig,
  validateRosterSize,
} from "@/systems/roster-rules";
import { enforceMaxRosterViaDevelopmentLeague } from "@/systems/development-league/enforce-roster-cap";
import {
  getDevelopmentLeagueRosterPlayerIds,
  getTopLeagueRosterSize,
  isPlayerDlAssigned,
} from "@/systems/development-league/franchise-membership";
import { TRADE_ROSTER_RULES } from "@/systems/trades-config";
import { createTestGameState } from "../../factories/game-state";
import {
  createPlayer as createTestPlayer,
  uniformPlayerAttributes,
} from "../../factories/player";

function seedDraftedPlayer(
  state: ReturnType<typeof createTestGameState>,
  opts: {
    playerId: string;
    teamId: string;
    overall: number;
  },
) {
  const teamId = asTeamId(opts.teamId);
  const playerId = asPlayerId(opts.playerId);
  const year = state.competition.season.year;
  const contractId = asContractId(`contract_${opts.playerId}`);
  const player = createPlayer({
    ...createTestPlayer({
      id: playerId,
      teamId,
      contractId,
      age: 21,
      attributes: uniformPlayerAttributes(opts.overall),
      potential: { overall: opts.overall + 8 },
    }),
    developmentLeague: {
      ...createDefaultDevelopmentLeagueProfile(),
      draftSeasonYear: year,
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

function seedOverflowRoster(
  state: ReturnType<typeof createTestGameState>,
  teamId: string,
  count: number,
) {
  let current = state;
  for (let i = 0; i < count; i += 1) {
    current = seedDraftedPlayer(current, {
      playerId: `overflow_${teamId}_${i}`,
      teamId,
      overall: 50 + i,
    });
  }
  return current;
}

describe("enforceMaxRosterViaDevelopmentLeague", () => {
  it("assigns the weakest draft-eligible extras until the roster cap", () => {
    const base = createTestGameState();
    const teamId = base.user.activeOwnerTeamId;
    const overflow = TRADE_ROSTER_RULES.maxRosterSize + 2;
    const state = seedOverflowRoster(base, teamId, overflow);

    expect(getTopLeagueRosterSize(teamId, state)).toBe(overflow);

    const result = enforceMaxRosterViaDevelopmentLeague(state);
    expect(getTopLeagueRosterSize(teamId, result.state)).toBe(
      TRADE_ROSTER_RULES.maxRosterSize,
    );
    expect(
      getDevelopmentLeagueRosterPlayerIds(teamId, result.state),
    ).toHaveLength(2);
    expect(
      isPlayerDlAssigned(result.state.world.players[`overflow_${teamId}_0`]!),
    ).toBe(true);
    expect(
      isPlayerDlAssigned(result.state.world.players[`overflow_${teamId}_1`]!),
    ).toBe(true);
    expect(() =>
      validateRosterSize(
        getTopLeagueRosterSize(teamId, result.state),
        createRosterRulesConfig(TRADE_ROSTER_RULES),
      ),
    ).not.toThrow();
  });

  it("is a no-op when every roster is already at the cap", () => {
    const base = createTestGameState();
    const teamId = base.user.activeOwnerTeamId;
    const state = seedOverflowRoster(
      base,
      teamId,
      TRADE_ROSTER_RULES.maxRosterSize,
    );
    const result = enforceMaxRosterViaDevelopmentLeague(state);
    expect(result.state.world.teams[teamId]!.roster).toEqual(
      state.world.teams[teamId]!.roster,
    );
    expect(result.events).toHaveLength(0);
  });

  it("only trims the requested teamIds", () => {
    const base = createTestGameState();
    const userTeamId = base.user.activeOwnerTeamId;
    const otherTeamId = (Object.keys(base.world.teams) as string[]).find(
      (id) => id !== userTeamId,
    )!;
    const overflow = TRADE_ROSTER_RULES.maxRosterSize + 2;
    let state = seedOverflowRoster(base, userTeamId, overflow);
    state = seedOverflowRoster(state, otherTeamId, overflow);

    const result = enforceMaxRosterViaDevelopmentLeague(state, {
      teamIds: [userTeamId],
    });
    expect(getTopLeagueRosterSize(userTeamId, result.state)).toBe(
      TRADE_ROSTER_RULES.maxRosterSize,
    );
    expect(getTopLeagueRosterSize(otherTeamId, result.state)).toBe(overflow);
  });
});
