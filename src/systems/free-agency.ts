import {
  createContract,
  getContractSalaryForYear,
  isContractActive,
  type ContractInput,
} from "@/domain/entities/contract";
import {
  createFreeAgencyOffer,
  isOpenOffer,
  type FreeAgencyOffer,
} from "@/domain/entities/free-agency-offer";
import type { Player } from "@/domain/entities/player";
import type { Team } from "@/domain/entities/team";
import { createDomainEvent } from "@/domain/events/domain-event";
import {
  emptyInterestFactors,
  type EvaluatePlayerInterest,
  type PlayerInterest,
} from "@/domain/free-agency/player-interest";
import type { OfferId, PlayerId, TeamId } from "@/domain/ids";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { appendSeasonEventLog } from "@/state/game-state";
import { FREE_AGENCY_INTEREST_CONFIG } from "@/systems/free-agency-config";
import { computeAwardReputationBonus } from "@/systems/awards/award-reputation";
import { getTeamCapSpace, getTeamPayroll } from "@/systems/salary-cap";
import { reconcileRosterManagement } from "@/systems/roster-management";
import { stripPlayersFromAllTradeBlocks } from "@/systems/trades/trade-block";
import { checkFreeAgencySigning } from "@/systems/league-rules/free-agency-rules";
import { TRADE_ROSTER_RULES } from "@/systems/trades-config";

export type FreeAgentPoolView = {
  playerIds: PlayerId[];
};

export type MakeOfferInput = {
  id: OfferId;
  playerId: PlayerId;
  teamId: TeamId;
  terms: ContractInput;
};

export type FreeAgencyWriteOptions = {
  evaluateInterest?: EvaluatePlayerInterest;
};

/**
 * Default interest: baseline + bounded award reputation (expectations only).
 * Awards never modify OVR, potential, or attributes.
 */
export const defaultEvaluatePlayerInterest: EvaluatePlayerInterest = (
  playerId,
  teamId,
  state,
) => {
  const factors = emptyInterestFactors();
  const awardBonus = computeAwardReputationBonus(playerId, state);
  factors.reputation = awardBonus;
  const score = FREE_AGENCY_INTEREST_CONFIG.baselineScore + awardBonus;
  return {
    playerId,
    teamId,
    score,
    interested: score >= FREE_AGENCY_INTEREST_CONFIG.interestThreshold,
    factors,
  };
};

/**
 * Free agent iff the player exists and has no active contract for the season year.
 * Pool is derived — never persisted.
 */
export function isFreeAgent(state: GameState, playerId: PlayerId): boolean {
  const player = state.world.players[playerId];
  if (player === undefined) {
    return false;
  }
  return !playerHasActiveContract(player, state);
}

export function listFreeAgents(state: GameState): FreeAgentPoolView {
  const playerIds: PlayerId[] = [];
  for (const player of Object.values(state.world.players)) {
    if (isFreeAgent(state, player.id)) {
      playerIds.push(player.id);
    }
  }
  playerIds.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return { playerIds };
}

/**
 * Returns the existing Player when they are a free agent; otherwise undefined.
 * Does not invent a separate FreeAgent entity.
 */
export function getFreeAgent(
  state: GameState,
  playerId: PlayerId,
): Player | undefined {
  if (!isFreeAgent(state, playerId)) {
    return undefined;
  }
  return state.world.players[playerId];
}

export function getPlayerInterest(
  state: GameState,
  playerId: PlayerId,
  teamId: TeamId,
  evaluateInterest: EvaluatePlayerInterest = defaultEvaluatePlayerInterest,
): PlayerInterest {
  assertPlayerExists(state, playerId);
  assertTeamExists(state, teamId);
  return evaluateInterest(playerId, teamId, state);
}

/**
 * Membership cleanup for a player with no active contract (Option B).
 * Does not terminate active contracts — throws if one is still active.
 *
 * Authorization for withdrawing former-team open offers is outside this layer;
 * open offers from the player's former team to this player are withdrawn.
 */
export function releasePlayerToFreeAgency(
  state: GameState,
  playerId: PlayerId,
): SystemResult {
  const player = assertPlayerExists(state, playerId);
  if (playerHasActiveContract(player, state)) {
    throw new Error(
      `Cannot release player "${playerId}" to free agency while they have an active contract.`,
    );
  }

  const formerTeamId = player.teamId;
  let next = clearPlayerTeamMembership(state, playerId);
  next = {
    ...next,
    business: {
      ...next.business,
      tradeBlocks: stripPlayersFromAllTradeBlocks(next.business.tradeBlocks, [
        playerId,
      ]),
    },
  };
  const withOffers =
    formerTeamId === null
      ? next
      : withdrawOpenOffersFromTeam(next, playerId, formerTeamId);

  const events = [
    createDomainEvent({
      type: "PlayerReleased",
      occurredOn: state.world.calendar.currentDate,
      payload: {
        playerId,
        formerTeamId,
      },
    }),
  ];

  return systemResult(withOffers, events);
}

/**
 * Moves players whose linked contracts are not active into free-agency membership.
 * Uses only getContractStatus helpers via isContractActive — does not inspect years/options.
 */
export function releaseExpiredContracts(state: GameState): SystemResult {
  let current = state;
  const events = [];
  const year = current.competition.season.year;
  const offseason = current.competition.season.phase === "offseason";

  const playerIds = Object.keys(current.world.players).sort();
  for (const playerIdKey of playerIds) {
    const player = current.world.players[playerIdKey]!;
    if (player.contractId === null) {
      continue;
    }
    const contract = current.business.contracts[player.contractId];
    if (contract === undefined) {
      continue;
    }

    // During the offseason after a completed season year, contracts whose
    // endYear is that season year are finished and become free agents.
    const stillBound = offseason
      ? year < contract.endYear
      : isContractActive(contract, year);
    if (stillBound) {
      continue;
    }

    const needsCleanup =
      player.teamId !== null ||
      playerOnAnyRoster(current, player.id) ||
      player.contractId !== null;

    if (!needsCleanup) {
      continue;
    }

    const result = releasePlayerToFreeAgency(current, player.id);
    current = result.state;
    events.push(...result.events);
  }

  return systemResult(current, events);
}

export function makeOffer(
  state: GameState,
  input: MakeOfferInput,
): SystemResult {
  assertPlayerExists(state, input.playerId);
  assertTeamExists(state, input.teamId);

  if (!isFreeAgent(state, input.playerId)) {
    throw new Error(
      `Player "${input.playerId}" is not a free agent and cannot receive a free-agency offer.`,
    );
  }

  if (state.business.freeAgency.offers[input.id] !== undefined) {
    throw new Error(`Free-agency offer "${input.id}" already exists.`);
  }

  for (const existing of Object.values(state.business.freeAgency.offers)) {
    if (
      existing.playerId === input.playerId &&
      existing.teamId === input.teamId &&
      isOpenOffer(existing.status)
    ) {
      throw new Error(
        `Team "${input.teamId}" already has an open free-agency offer for player "${input.playerId}".`,
      );
    }
  }

  const today = state.world.calendar.currentDate;
  const offer = createFreeAgencyOffer({
    id: input.id,
    playerId: input.playerId,
    teamId: input.teamId,
    terms: input.terms,
    status: "pending",
    createdOn: today,
    updatedOn: today,
  });

  return systemResult(withOffer(state, offer));
}

/**
 * Advances a pending offer into negotiation, or rejects when the player is uninterested.
 * Lack of interest is a business outcome (rejected), not an exception.
 */
export function negotiateOffer(
  state: GameState,
  offerId: OfferId,
  options: FreeAgencyWriteOptions = {},
): SystemResult {
  const offer = assertOpenOffer(state, offerId);
  const evaluate =
    options.evaluateInterest ?? defaultEvaluatePlayerInterest;
  const interest = evaluate(offer.playerId, offer.teamId, state);
  const today = state.world.calendar.currentDate;

  if (!interest.interested) {
    return systemResult(
      withOffer(state, {
        ...offer,
        status: "rejected",
        updatedOn: today,
      }),
    );
  }

  if (offer.status === "negotiating") {
    return systemResult(
      withOffer(state, {
        ...offer,
        updatedOn: today,
      }),
    );
  }

  return systemResult(
    withOffer(state, {
      ...offer,
      status: "negotiating",
      updatedOn: today,
    }),
  );
}

/**
 * Rejects an open offer. Player remains a free agent; no contract or roster change.
 */
export function rejectOffer(state: GameState, offerId: OfferId): SystemResult {
  const offer = assertOpenOffer(state, offerId);
  return systemResult(
    withOffer(state, {
      ...offer,
      status: "rejected",
      updatedOn: state.world.calendar.currentDate,
    }),
  );
}

/**
 * Team cancels an open offer.
 * Domain meaning: only the offering team may withdraw.
 * v1 has no actor/auth layer — authorization is outside this system.
 */
export function withdrawOffer(state: GameState, offerId: OfferId): SystemResult {
  const offer = assertOpenOffer(state, offerId);
  return systemResult(
    withOffer(state, {
      ...offer,
      status: "withdrawn",
      updatedOn: state.world.calendar.currentDate,
    }),
  );
}

/**
 * Accepts an open offer: creates a normal contract, assigns roster, withdraws competitors.
 * Uninterested players yield a rejected offer (business outcome), not a throw.
 * Stale offers (player no longer free agent / terms invalid) are invalidated without
 * crashing the simulation — no partial state is applied.
 */
export function acceptOffer(
  state: GameState,
  offerId: OfferId,
  options: FreeAgencyWriteOptions = {},
): SystemResult {
  const stale = validateOfferAcceptable(state, offerId);
  if (stale !== null) {
    return invalidateStaleOffer(state, offerId, stale);
  }

  const offer = assertOpenOffer(state, offerId);

  const evaluate =
    options.evaluateInterest ?? defaultEvaluatePlayerInterest;
  const interest = evaluate(offer.playerId, offer.teamId, state);
  const today = state.world.calendar.currentDate;

  if (!interest.interested) {
    return systemResult(
      withOffer(state, {
        ...offer,
        status: "rejected",
        updatedOn: today,
      }),
    );
  }

  const firstYearSalary = getContractSalaryForYear(
    offer.terms,
    offer.terms.startYear,
  );
  if (firstYearSalary === undefined) {
    return invalidateStaleOffer(
      state,
      offerId,
      `Offer "${offerId}" terms are missing salary for startYear ${offer.terms.startYear}.`,
    );
  }

  const capSpace = getTeamCapSpace(
    offer.teamId,
    offer.terms.startYear,
    state,
  );
  if (
    state.settings.financialRules.salaryCapEnabled &&
    firstYearSalary > capSpace
  ) {
    return invalidateStaleOffer(
      state,
      offerId,
      `Team "${offer.teamId}" cannot afford offer "${offerId}": first-year salary ${firstYearSalary} exceeds cap space ${capSpace} for ${offer.terms.startYear}.`,
    );
  }

  const faGate = checkFreeAgencySigning(state, offer.playerId);
  // Phase lock is enforced by canPerformAction / game-service.
  // Engine still enforces hard locks: RFA bypass and retirement.
  const hardOnly = faGate.violations.filter(
    (v) =>
      v.code === "RFA_REQUIRES_OFFER_SHEET" ||
      v.code === "PLAYER_RETIRED" ||
      v.code === "PLAYER_NOT_FOUND",
  );
  if (hardOnly.length > 0) {
    throw new Error(hardOnly[0]!.message);
  }

  const signingTeamForSize = state.world.teams[offer.teamId];
  if (signingTeamForSize) {
    const projectedSize = signingTeamForSize.roster.includes(offer.playerId)
      ? signingTeamForSize.roster.length
      : signingTeamForSize.roster.length + 1;
    const maxSize = TRADE_ROSTER_RULES.maxRosterSize;
    if (projectedSize > maxSize) {
      throw new Error(
        `Signing would exceed maximum roster size of ${maxSize}.`,
      );
    }
  }

  if (state.business.contracts[offer.terms.id] !== undefined) {
    return invalidateStaleOffer(
      state,
      offerId,
      `Contract "${offer.terms.id}" already exists; cannot accept offer "${offerId}".`,
    );
  }

  const contract = createContract(offer.terms);

  let next: GameState = {
    ...state,
    business: {
      ...state.business,
      contracts: {
        ...state.business.contracts,
        [contract.id]: contract,
      },
      freeAgency: {
        ...state.business.freeAgency,
        offers: { ...state.business.freeAgency.offers },
      },
    },
    world: {
      ...state.world,
      players: { ...state.world.players },
      teams: { ...state.world.teams },
    },
  };

  // Remove player from every roster first, then add to signing team.
  next = removePlayerFromAllRosters(next, offer.playerId);

  const player = next.world.players[offer.playerId]!;
  next = {
    ...next,
    world: {
      ...next.world,
      players: {
        ...next.world.players,
        [offer.playerId]: {
          ...player,
          teamId: offer.teamId,
          contractId: contract.id,
        },
      },
    },
  };

  const signingTeam = next.world.teams[offer.teamId]!;
  const roster = signingTeam.roster.includes(offer.playerId)
    ? signingTeam.roster
    : [...signingTeam.roster, offer.playerId];
  next = {
    ...next,
    world: {
      ...next.world,
      teams: {
        ...next.world.teams,
        [offer.teamId]: {
          ...signingTeam,
          roster,
        },
      },
    },
  };

  const offers: Record<string, FreeAgencyOffer> = {
    ...next.business.freeAgency.offers,
  };
  for (const [id, other] of Object.entries(offers)) {
    if (other.playerId !== offer.playerId) {
      continue;
    }
    if (id === offer.id) {
      continue;
    }
    if (isOpenOffer(other.status)) {
      offers[id] = {
        ...other,
        status: "withdrawn",
        updatedOn: today,
      };
    }
  }
  offers[offer.id] = {
    ...offer,
    status: "accepted",
    contractId: contract.id,
    updatedOn: today,
  };

  next = {
    ...next,
    business: {
      ...next.business,
      freeAgency: {
        offers,
      },
    },
  };

  const existingFinance = next.business.finances[offer.teamId];
  if (existingFinance) {
    const payroll = getTeamPayroll(
      offer.teamId,
      next.competition.season.year,
      next,
    );
    next = {
      ...next,
      business: {
        ...next.business,
        finances: {
          ...next.business.finances,
          [offer.teamId]: {
            ...existingFinance,
            payroll,
          },
        },
      },
    };
  }

  const events = [
    createDomainEvent({
      type: "ContractSigned",
      occurredOn: today,
      payload: {
        contractId: contract.id,
        playerId: offer.playerId,
        teamId: offer.teamId,
        offerId: offer.id,
      },
    }),
    createDomainEvent({
      type: "FreeAgentSigned",
      occurredOn: today,
      payload: {
        contractId: contract.id,
        playerId: offer.playerId,
        teamId: offer.teamId,
        offerId: offer.id,
      },
    }),
  ];

  next = reconcileRosterManagement(next, offer.teamId);
  next = appendSeasonEventLog(next, events);

  return systemResult(next, events);
}

function playerHasActiveContract(player: Player, state: GameState): boolean {
  if (player.contractId === null) {
    return false;
  }
  const contract = state.business.contracts[player.contractId];
  if (contract === undefined) {
    return false;
  }
  const year = state.competition.season.year;
  // After the season year concludes, contracts ending that year are no longer binding.
  if (
    state.competition.season.phase === "offseason" &&
    year >= contract.endYear
  ) {
    return false;
  }
  return isContractActive(contract, year);
}

function playerOnAnyRoster(state: GameState, playerId: PlayerId): boolean {
  for (const team of Object.values(state.world.teams)) {
    if (team.roster.includes(playerId)) {
      return true;
    }
  }
  return false;
}

function assertPlayerExists(state: GameState, playerId: PlayerId): Player {
  const player = state.world.players[playerId];
  if (player === undefined) {
    throw new Error(`Player "${playerId}" does not exist.`);
  }
  return player;
}

function assertTeamExists(state: GameState, teamId: TeamId): Team {
  const team = state.world.teams[teamId];
  if (team === undefined) {
    throw new Error(`Team "${teamId}" does not exist.`);
  }
  return team;
}

function assertOpenOffer(state: GameState, offerId: OfferId): FreeAgencyOffer {
  const offer = state.business.freeAgency.offers[offerId];
  if (offer === undefined) {
    throw new Error(`Free-agency offer "${offerId}" does not exist.`);
  }
  if (!isOpenOffer(offer.status)) {
    throw new Error(
      `Free-agency offer "${offerId}" is already resolved with status "${offer.status}".`,
    );
  }
  return offer;
}

/**
 * Returns null when the offer can be accepted; otherwise a reason string.
 * Does not mutate state.
 */
export function validateOfferAcceptable(
  state: GameState,
  offerId: OfferId,
): string | null {
  const offer = state.business.freeAgency.offers[offerId];
  if (offer === undefined) {
    return `Free-agency offer "${offerId}" does not exist.`;
  }
  if (!isOpenOffer(offer.status)) {
    return `Free-agency offer "${offerId}" is already resolved with status "${offer.status}".`;
  }
  const player = state.world.players[offer.playerId];
  if (player === undefined) {
    return `Player "${offer.playerId}" does not exist.`;
  }
  if (!isFreeAgent(state, offer.playerId)) {
    return `Player "${offer.playerId}" is not a free agent.`;
  }
  if (state.world.teams[offer.teamId] === undefined) {
    return `Team "${offer.teamId}" does not exist.`;
  }
  return null;
}

/**
 * Domain recovery for expected stale open offers: withdraw without applying a signing.
 * Does not suppress unexpected invariant violations elsewhere.
 */
export function invalidateStaleOffer(
  state: GameState,
  offerId: OfferId,
  reason: string,
): SystemResult {
  const offer = state.business.freeAgency.offers[offerId];
  if (offer === undefined) {
    throw new Error(`Free-agency offer "${offerId}" does not exist.`);
  }
  if (!isOpenOffer(offer.status)) {
    return systemResult(state);
  }
  const today = state.world.calendar.currentDate;
  const next = withOffer(state, {
    ...offer,
    status: "withdrawn",
    updatedOn: today,
  });
  return systemResult(next, [
    createDomainEvent({
      type: "FreeAgencyOfferInvalidated",
      occurredOn: today,
      payload: {
        offerId: offer.id,
        playerId: offer.playerId,
        teamId: offer.teamId,
        reason,
      },
    }),
  ]);
}

function withOffer(state: GameState, offer: FreeAgencyOffer): GameState {
  return {
    ...state,
    business: {
      ...state.business,
      freeAgency: {
        ...state.business.freeAgency,
        offers: {
          ...state.business.freeAgency.offers,
          [offer.id]: offer,
        },
      },
    },
  };
}

function removePlayerFromAllRosters(
  state: GameState,
  playerId: PlayerId,
): GameState {
  const teams: Record<string, Team> = { ...state.world.teams };
  const touched: string[] = [];
  for (const [teamId, team] of Object.entries(teams)) {
    if (team.roster.includes(playerId)) {
      teams[teamId] = {
        ...team,
        roster: team.roster.filter((id) => id !== playerId),
      };
      touched.push(teamId);
    }
  }
  let next: GameState = {
    ...state,
    world: {
      ...state.world,
      teams,
    },
  };
  for (const teamId of touched) {
    next = reconcileRosterManagement(next, teamId as TeamId);
  }
  return next;
}

function clearPlayerTeamMembership(
  state: GameState,
  playerId: PlayerId,
): GameState {
  const withoutRosters = removePlayerFromAllRosters(state, playerId);
  const player = withoutRosters.world.players[playerId]!;
  const clearContractId =
    player.contractId !== null &&
    !playerHasActiveContract(player, withoutRosters);

  return {
    ...withoutRosters,
    world: {
      ...withoutRosters.world,
      players: {
        ...withoutRosters.world.players,
        [playerId]: {
          ...player,
          teamId: null,
          contractId: clearContractId ? null : player.contractId,
        },
      },
    },
  };
}

function withdrawOpenOffersFromTeam(
  state: GameState,
  playerId: PlayerId,
  teamId: TeamId,
): GameState {
  const today = state.world.calendar.currentDate;
  const offers: Record<string, FreeAgencyOffer> = {
    ...state.business.freeAgency.offers,
  };
  let changed = false;
  for (const [id, offer] of Object.entries(offers)) {
    if (
      offer.playerId === playerId &&
      offer.teamId === teamId &&
      isOpenOffer(offer.status)
    ) {
      offers[id] = {
        ...offer,
        status: "withdrawn",
        updatedOn: today,
      };
      changed = true;
    }
  }
  if (!changed) {
    return state;
  }
  return {
    ...state,
    business: {
      ...state.business,
      freeAgency: {
        offers,
      },
    },
  };
}
