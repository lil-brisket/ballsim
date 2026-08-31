import type { Contract } from "@/domain/entities/contract";
import type { DraftPick } from "@/domain/entities/draft-pick";
import type { Player } from "@/domain/entities/player";
import type { Team } from "@/domain/entities/team";
import type { TradeBlock } from "@/domain/entities/trade-block";
import type { TradeProposal } from "@/domain/entities/trade-proposal";
import { createDomainEvent, type DomainEvent } from "@/domain/events/domain-event";
import type { DraftPickId, PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { getTeamPayroll } from "@/systems/salary-cap";
import { reconcileRosterManagement } from "@/systems/roster-management";
import { appendSeasonEventLog } from "@/state/game-state";
import { stripTradedAssetsFromTradeBlocks } from "@/systems/trades/trade-block";
import {
  validateTrade,
  type TradeValidationResult,
} from "@/systems/trades/trade-validation";

export type TradeExecutionResult = {
  success: boolean;
  proposal: TradeProposal;
  validation: TradeValidationResult;
  state: GameState;
  events: DomainEvent[];
  teamsInvolved: [TeamId, TeamId];
  playersExchanged: {
    toSideA: PlayerId[];
    toSideB: PlayerId[];
  };
  picksExchanged: {
    toSideA: DraftPickId[];
    toSideB: DraftPickId[];
  };
};

/**
 * Canonical trade execution. Validates first; refuses to mutate on failure.
 * On success, clones affected slices and applies atomically.
 */
export function executeTrade(
  state: GameState,
  proposal: TradeProposal,
): TradeExecutionResult {
  const validation = validateTrade(state, proposal);
  const teamsInvolved: [TeamId, TeamId] = [
    proposal.sideA.teamId,
    proposal.sideB.teamId,
  ];
  const playersExchanged = {
    toSideA: [...proposal.sideB.playerIds],
    toSideB: [...proposal.sideA.playerIds],
  };
  const picksExchanged = {
    toSideA: [...proposal.sideB.draftPickIds],
    toSideB: [...proposal.sideA.draftPickIds],
  };

  if (!validation.valid) {
    return {
      success: false,
      proposal,
      validation,
      state,
      events: [],
      teamsInvolved,
      playersExchanged,
      picksExchanged,
    };
  }

  const teamIdA = proposal.sideA.teamId;
  const teamIdB = proposal.sideB.teamId;
  const seasonYear = state.competition.season.year;

  const players: Record<string, Player> = { ...state.world.players };
  const teams: Record<string, Team> = { ...state.world.teams };
  const draftPicks: Record<string, DraftPick> = { ...state.world.draftPicks };
  const contracts: Record<string, Contract> = { ...state.business.contracts };
  let tradeBlocks: Record<string, TradeBlock> = {
    ...state.business.tradeBlocks,
  };
  const finances = { ...state.business.finances };

  const teamA = { ...teams[teamIdA]!, roster: [...teams[teamIdA]!.roster] };
  const teamB = { ...teams[teamIdB]!, roster: [...teams[teamIdB]!.roster] };

  // Remove outgoing players from rosters (DL-assigned players are already off roster)
  teamA.roster = teamA.roster.filter(
    (id) => !proposal.sideA.playerIds.includes(id),
  );
  teamB.roster = teamB.roster.filter(
    (id) => !proposal.sideB.playerIds.includes(id),
  );

  // Move players A → B
  for (const playerId of proposal.sideA.playerIds) {
    const player = players[playerId]!;
    const wasDlAssigned = player.developmentLeague?.status === "assigned";
    const nextDl =
      player.developmentLeague != null
        ? {
            ...player.developmentLeague,
            parentTeamId: wasDlAssigned ? teamIdB : player.developmentLeague.parentTeamId,
          }
        : undefined;
    players[playerId] = {
      ...player,
      teamId: teamIdB,
      developmentLeague: nextDl,
    };
    // DL-assigned players stay off top-league roster; transfer ownership only
    if (!wasDlAssigned && !teamB.roster.includes(playerId)) {
      teamB.roster = [...teamB.roster, playerId];
    }
    if (player.contractId !== null) {
      const contract = contracts[player.contractId];
      if (contract !== undefined) {
        contracts[player.contractId] = { ...contract, teamId: teamIdB };
      }
    }
  }

  // Move players B → A
  for (const playerId of proposal.sideB.playerIds) {
    const player = players[playerId]!;
    const wasDlAssigned = player.developmentLeague?.status === "assigned";
    const nextDl =
      player.developmentLeague != null
        ? {
            ...player.developmentLeague,
            parentTeamId: wasDlAssigned ? teamIdA : player.developmentLeague.parentTeamId,
          }
        : undefined;
    players[playerId] = {
      ...player,
      teamId: teamIdA,
      developmentLeague: nextDl,
    };
    if (!wasDlAssigned && !teamA.roster.includes(playerId)) {
      teamA.roster = [...teamA.roster, playerId];
    }
    if (player.contractId !== null) {
      const contract = contracts[player.contractId];
      if (contract !== undefined) {
        contracts[player.contractId] = { ...contract, teamId: teamIdA };
      }
    }
  }

  // Transfer picks (ownerTeamId only; originalTeamId immutable)
  for (const pickId of proposal.sideA.draftPickIds) {
    const pick = draftPicks[pickId]!;
    draftPicks[pickId] = { ...pick, ownerTeamId: teamIdB };
  }
  for (const pickId of proposal.sideB.draftPickIds) {
    const pick = draftPicks[pickId]!;
    draftPicks[pickId] = { ...pick, ownerTeamId: teamIdA };
  }

  teams[teamIdA] = teamA;
  teams[teamIdB] = teamB;

  const allPlayerIds = [
    ...proposal.sideA.playerIds,
    ...proposal.sideB.playerIds,
  ];
  const allPickIds = [
    ...proposal.sideA.draftPickIds,
    ...proposal.sideB.draftPickIds,
  ];
  tradeBlocks = stripTradedAssetsFromTradeBlocks(
    tradeBlocks,
    teamIdA,
    teamIdB,
    allPlayerIds,
    allPickIds,
  );

  let next: GameState = {
    ...state,
    world: {
      ...state.world,
      players,
      teams,
      draftPicks,
    },
    business: {
      ...state.business,
      contracts,
      tradeBlocks,
      finances,
    },
  };

  // Post-trade payroll for affected teams
  for (const teamId of [teamIdA, teamIdB]) {
    const existingFinance = next.business.finances[teamId];
    if (existingFinance) {
      next = {
        ...next,
        business: {
          ...next.business,
          finances: {
            ...next.business.finances,
            [teamId]: {
              ...existingFinance,
              payroll: getTeamPayroll(teamId, seasonYear, next),
            },
          },
        },
      };
    }
  }

  for (const teamId of [teamIdA, teamIdB]) {
    next = reconcileRosterManagement(next, teamId);
  }

  const events: DomainEvent[] = [];
  const occurredOn = state.world.calendar.currentDate;
  for (const playerId of proposal.sideA.playerIds) {
    events.push(
      createDomainEvent({
        type: "PlayerTraded",
        occurredOn,
        payload: {
          playerId,
          fromTeamId: teamIdA,
          toTeamId: teamIdB,
        },
      }),
    );
  }
  for (const playerId of proposal.sideB.playerIds) {
    events.push(
      createDomainEvent({
        type: "PlayerTraded",
        occurredOn,
        payload: {
          playerId,
          fromTeamId: teamIdB,
          toTeamId: teamIdA,
        },
      }),
    );
  }

  next = appendSeasonEventLog(next, events);

  return {
    success: true,
    proposal,
    validation,
    state: next,
    events,
    teamsInvolved,
    playersExchanged,
    picksExchanged,
  };
}
