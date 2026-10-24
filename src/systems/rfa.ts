/**
 * Restricted free agency.
 *
 * Flow (when `settings.offseason.restrictedFreeAgency` is on):
 * 1. Entering roster decisions, expiring players under 4 years of service on
 *    their deal are classified. CPU teams issue qualifying offers to players
 *    worth keeping; owners issue them by hand during the phase.
 * 2. Leaving roster decisions, players whose deal was extended drop out, and
 *    expiring contracts end. A player with a qualifying offer is a restricted
 *    free agent: other teams reach him only with an offer sheet.
 * 3. In free agency a team submits an offer sheet; if he signs it, his old
 *    team has {@link RFA_MATCH_WINDOW_DAYS} days to match (he stays on the
 *    sheet's terms) or decline (he joins the new team). An unanswered sheet
 *    counts as declined.
 * 4. When free agency closes, a restricted free agent without a sheet
 *    accepts his qualifying offer: one season with his old team.
 */

import {
  createContract,
  getContractSalaryForYear,
  type Contract,
  type ContractInput,
} from "@/domain/entities/contract";
import {
  createRfaStatus,
  isActiveRfa,
  type RfaStatus,
} from "@/domain/entities/rfa-status";
import { createDomainEvent, type DomainEvent } from "@/domain/events";
import { asContractId, type PlayerId, type TeamId } from "@/domain/ids";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { appendSeasonEventLog } from "@/state/game-state";
import { isUserControlledTeam } from "@/state/owner-context";
import { aiPayrollBudget, aiPayrollRoom } from "@/systems/ai-payroll-budget";
import {
  assignSignedContract,
  evaluateInterestAtSalary,
} from "@/systems/free-agency";
import {
  buildOfferSheet,
  checkDeclineMatch,
  checkMatchRfaOffer,
  checkSubmitRfaOfferSheet,
  computeQualifyingOfferSalary,
} from "@/systems/league-rules/rfa-rules";
import { RFA_MAX_YEARS_OF_SERVICE } from "@/systems/league-rules/invariants";
import { getLeagueSalaryCap } from "@/systems/league-salary-cap";
import {
  getContractSigningYear,
  getTeamCapSpace,
  getTeamPayroll,
} from "@/systems/salary-cap";
import {
  isVetMinExceptionSalary,
  salaryForPlayer,
  serviceYearsForSalary,
} from "@/systems/salary-scale";
import { VET_MIN_EXCEPTION_ENABLED } from "@/systems/salary-cap-config";
import { TRADE_ROSTER_RULES } from "@/systems/trades-config";

/** CPU teams qualify players at or above this overall... */
export const RFA_AI_QO_MIN_OVERALL = 68;
/** ...or young players with this much potential. */
export const RFA_AI_QO_MIN_POTENTIAL = 74;
export const RFA_AI_QO_MAX_AGE_FOR_POTENTIAL = 24;
/** CPU teams match sheets for players at or above this overall... */
export const RFA_AI_MATCH_MIN_OVERALL = 70;
/** ...when the sheet pays at most this multiple of his market value. */
export const RFA_AI_MATCH_MAX_MARKET_MULTIPLE = 1.15;

export function isRestrictedFreeAgencyEnabled(state: GameState): boolean {
  return state.settings.offseason.restrictedFreeAgency !== false;
}

/**
 * Classify expiring players as RFA-eligible (or leave them UFA). Runs when
 * roster decisions begin, before any contract ends. Idempotent per season.
 */
export function finalizeRfaQualification(
  state: GameState,
  options: { autoIssueQoForAiTeams?: boolean } = {},
): SystemResult {
  if (state.competition.season.rfaQualificationComplete === true) {
    return systemResult(state);
  }
  const complete = (next: GameState): GameState => ({
    ...next,
    competition: {
      ...next.competition,
      season: {
        ...next.competition.season,
        rfaQualificationComplete: true,
      },
    },
  });
  if (!isRestrictedFreeAgencyEnabled(state)) {
    return systemResult(complete(state));
  }

  const year = state.competition.season.year;
  const events: DomainEvent[] = [];
  const rfaStatuses: Record<string, RfaStatus> = {
    ...(state.business.rfaStatuses ?? {}),
  };
  const leagueMin = Math.round(getLeagueSalaryCap(state) * 0.01);
  // Qualifying offers a CPU team has already committed to this pass.
  const committed = new Map<string, number>();

  for (const player of Object.values(state.world.players).sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  )) {
    if (player.retired === true || player.teamId == null) continue;
    if (player.contractId == null) continue;
    const contract = state.business.contracts[player.contractId];
    if (!contract || contract.teamId !== player.teamId) continue;
    if (contract.endYear !== year) continue;
    if (!isRestrictedEligible(state, player.id)) continue;
    const existing = rfaStatuses[player.id];
    if (existing !== undefined && existing.seasonYear === year) continue;

    const priorSalary =
      getContractSalaryForYear(contract, year) ??
      getContractSalaryForYear(contract, year - 1) ??
      leagueMin;
    const qoSalary = computeQualifyingOfferSalary(priorSalary, leagueMin);
    const isAiTeam = !isUserControlledTeam(state, player.teamId);
    const issue =
      options.autoIssueQoForAiTeams === true &&
      isAiTeam &&
      cpuWouldQualify(
        state,
        player.id,
        qoSalary + (committed.get(player.teamId) ?? 0),
      );
    if (isAiTeam && !issue) continue;
    if (issue) {
      committed.set(
        player.teamId,
        (committed.get(player.teamId) ?? 0) + qoSalary,
      );
    }

    rfaStatuses[player.id] = createRfaStatus({
      playerId: player.id,
      originalTeamId: player.teamId,
      seasonYear: year,
      qualifyingOfferSalary: qoSalary,
      hasQualifyingOffer: issue,
      activeOfferSheet: null,
      // Owners decide during roster decisions; no offer means UFA.
      resolution: issue ? "pending_rfa" : "unsigned_ufa",
    });
    if (issue) {
      events.push(
        createDomainEvent({
          type: "RfaQualifyingOfferIssued",
          occurredOn: state.world.calendar.currentDate,
          payload: {
            playerId: player.id,
            teamId: player.teamId,
            salary: qoSalary,
          },
        }),
      );
    }
  }

  return systemResult(
    complete({
      ...state,
      business: { ...state.business, rfaStatuses },
    }),
    events,
  );
}

/**
 * Restricted free agency is for players early in their careers: fewer than
 * {@link RFA_MAX_YEARS_OF_SERVICE} seasons of service, and only once — a
 * player who already played a season on his qualifying offer is unrestricted.
 */
export function isRestrictedEligible(
  state: GameState,
  playerId: PlayerId,
): boolean {
  const player = state.world.players[playerId];
  if (!player) return false;
  if (state.business.rfaStatuses?.[playerId]?.resolution === "accepted_qo") {
    return false;
  }
  return careerServiceYears(state, playerId) < RFA_MAX_YEARS_OF_SERVICE;
}

/**
 * Seasons of professional service. History is exact for players drafted in
 * this league; for players who were already pros when the league began, it
 * only covers this league, so their age (from 19) sets a floor.
 */
export function careerServiceYears(
  state: GameState,
  playerId: PlayerId,
): number {
  const player = state.world.players[playerId];
  if (!player) return 0;
  const history = state.business.playerHistory[playerId]?.seasons.length ?? 0;
  if (draftedInLeague(state, playerId)) return history;
  return Math.max(history, Math.max(0, player.age - 19));
}

/**
 * Drafted players carry their draft year (set at the pick; backfilled for
 * older saves by the v79 migration), so old draft classes are not needed.
 */
function draftedInLeague(state: GameState, playerId: PlayerId): boolean {
  return (
    state.world.players[playerId]?.developmentLeague.draftSeasonYear != null
  );
}

function cpuWouldQualify(
  state: GameState,
  playerId: PlayerId,
  qoSalary: number,
): boolean {
  const player = state.world.players[playerId];
  if (!player || player.teamId == null) return false;
  // Only commit what next season's budget allows.
  const room = aiPayrollRoom(
    state,
    player.teamId,
    state.competition.season.year + 1,
  );
  if (room < qoSalary) return false;
  const overall = calculatePlayerOverall(player.position, player.attributes);
  if (overall >= RFA_AI_QO_MIN_OVERALL) return true;
  return (
    player.age <= RFA_AI_QO_MAX_AGE_FOR_POTENTIAL &&
    player.potential.overall >= RFA_AI_QO_MIN_POTENTIAL
  );
}

/**
 * Before expiring contracts end: drop this season's statuses for players
 * who are no longer expiring (extended or released).
 */
export function pruneRfaStatusesBeforeExpiry(state: GameState): GameState {
  const year = state.competition.season.year;
  const statuses = state.business.rfaStatuses ?? {};
  let changed = false;
  const next: Record<string, RfaStatus> = {};
  for (const [playerId, status] of Object.entries(statuses)) {
    if (status.seasonYear === year) {
      const player = state.world.players[playerId];
      const contract =
        player?.contractId != null
          ? state.business.contracts[player.contractId]
          : undefined;
      const stillExpiring =
        player?.teamId === status.originalTeamId &&
        contract?.teamId === status.originalTeamId &&
        contract.endYear === year;
      if (!stillExpiring) {
        changed = true;
        continue;
      }
    }
    next[playerId] = status;
  }
  return changed
    ? { ...state, business: { ...state.business, rfaStatuses: next } }
    : state;
}

/**
 * Issue a qualifying offer for an owned-team player (idempotent).
 */
export function issueQualifyingOffer(
  state: GameState,
  playerId: PlayerId,
): SystemResult {
  const player = state.world.players[playerId];
  if (!player || player.teamId == null || player.contractId == null) {
    throw new Error("Cannot issue QO: player not under contract.");
  }
  const contract = state.business.contracts[player.contractId];
  if (!contract) {
    throw new Error("Cannot issue QO: contract missing.");
  }
  const year = state.competition.season.year;
  if (contract.endYear !== year) {
    throw new Error("Qualifying offers are for players whose deal ends now.");
  }
  if (!isRestrictedEligible(state, playerId)) {
    throw new Error(
      "Only players early in their careers, who have not already played on a qualifying offer, can be restricted.",
    );
  }
  const leagueMin = Math.round(getLeagueSalaryCap(state) * 0.01);
  const priorSalary = getContractSalaryForYear(contract, year) ?? leagueMin;
  const qoSalary = computeQualifyingOfferSalary(priorSalary, leagueMin);

  const status = createRfaStatus({
    playerId,
    originalTeamId: player.teamId,
    seasonYear: year,
    qualifyingOfferSalary: qoSalary,
    hasQualifyingOffer: true,
    activeOfferSheet: null,
    resolution: "pending_rfa",
  });

  const event = createDomainEvent({
    type: "RfaQualifyingOfferIssued",
    occurredOn: state.world.calendar.currentDate,
    payload: {
      playerId,
      teamId: player.teamId,
      salary: qoSalary,
    },
  });

  return systemResult(
    {
      ...state,
      business: {
        ...state.business,
        rfaStatuses: {
          ...(state.business.rfaStatuses ?? {}),
          [playerId]: status,
        },
      },
    },
    [event],
  );
}

export type OfferSheetInput = {
  playerId: PlayerId;
  offeringTeamId: TeamId;
  /** Flat salary per season. */
  salary: number;
  years: number;
  contractId: string;
};

/**
 * Why a team cannot submit this sheet, or null. Covers the RFA rules, the
 * qualifying-offer floor, cap space and roster size; not his answer.
 */
export function getOfferSheetBlockReason(
  state: GameState,
  input: OfferSheetInput,
): string | null {
  const rules = checkSubmitRfaOfferSheet(
    state,
    input.playerId,
    input.offeringTeamId,
  );
  if (!rules.allowed) return rules.violations[0]!.message;
  const status = state.business.rfaStatuses[input.playerId]!;
  if (!Number.isInteger(input.years) || input.years < 1 || input.years > 5) {
    return "Offer sheets run 1 to 5 seasons.";
  }
  if (
    !Number.isInteger(input.salary) ||
    input.salary < status.qualifyingOfferSalary
  ) {
    return "An offer sheet must pay at least his qualifying offer.";
  }
  const year = getContractSigningYear(state);
  // Sheets already out count against the team's cap room and roster.
  const outgoing = pendingOutgoingSheets(state, input.offeringTeamId);
  if (
    state.settings.financialRules.salaryCapEnabled &&
    input.salary >
      getTeamCapSpace(input.offeringTeamId, year, state) - outgoing.salary &&
    !(
      VET_MIN_EXCEPTION_ENABLED &&
      isVetMinExceptionSalary(input.salary, getLeagueSalaryCap(state))
    )
  ) {
    return "You do not have the cap space for this offer sheet.";
  }
  const team = state.world.teams[input.offeringTeamId];
  if (
    !team ||
    team.roster.length + outgoing.count >= TRADE_ROSTER_RULES.maxRosterSize
  ) {
    return `Your roster is full (${TRADE_ROSTER_RULES.maxRosterSize}), counting offer sheets you have out.`;
  }
  return null;
}

/** Offer sheets a team has out that are waiting on a match decision. */
export function pendingOutgoingSheets(
  state: GameState,
  teamId: TeamId,
): { count: number; salary: number } {
  let count = 0;
  let salary = 0;
  for (const status of Object.values(state.business.rfaStatuses ?? {})) {
    const sheet = status.activeOfferSheet;
    if (
      status.resolution === "pending_match" &&
      sheet?.offeringTeamId === teamId
    ) {
      count += 1;
      salary += sheet.terms.salaryByYear[String(sheet.terms.startYear)] ?? 0;
    }
  }
  return { count, salary };
}

/** Contract terms an offer sheet would carry. */
export function offerSheetTerms(
  state: GameState,
  input: OfferSheetInput,
): ContractInput {
  const startYear = getContractSigningYear(state);
  const salaryByYear: Record<string, number> = {};
  for (let year = startYear; year < startYear + input.years; year += 1) {
    salaryByYear[String(year)] = input.salary;
  }
  return {
    id: asContractId(input.contractId),
    playerId: input.playerId,
    teamId: input.offeringTeamId,
    startYear,
    endYear: startYear + input.years - 1,
    salaryByYear,
  };
}

/**
 * Submit an offer sheet. When he signs it, his old team gets the match
 * window. `signed: false` when he turns it down (no state change).
 */
export function submitRfaOfferSheet(
  state: GameState,
  input: OfferSheetInput,
): { result: SystemResult; signed: boolean } {
  const blocked = getOfferSheetBlockReason(state, input);
  if (blocked !== null) throw new Error(blocked);
  const interest = evaluateInterestAtSalary(
    state,
    input.playerId,
    input.offeringTeamId,
    input.salary,
  );
  if (!interest.interested) {
    return { result: systemResult(state), signed: false };
  }
  const status = state.business.rfaStatuses[input.playerId]!;
  const today = state.world.calendar.currentDate;
  const sheet = buildOfferSheet(
    input.offeringTeamId,
    offerSheetTerms(state, input),
    today,
  );
  const next: GameState = {
    ...state,
    business: {
      ...state.business,
      rfaStatuses: {
        ...state.business.rfaStatuses,
        [input.playerId]: {
          ...status,
          activeOfferSheet: sheet,
          resolution: "pending_match",
        },
      },
    },
  };
  const event = createDomainEvent({
    type: "RfaOfferSheetSigned",
    occurredOn: today,
    payload: {
      playerId: input.playerId,
      teamId: status.originalTeamId,
      originalTeamId: status.originalTeamId,
      offeringTeamId: input.offeringTeamId,
      salary: input.salary,
      years: input.years,
      matchDeadlineDate: sheet.matchDeadlineDate,
    },
  });
  return {
    result: systemResult(appendSeasonEventLog(next, [event]), [event]),
    signed: true,
  };
}

/** Original team keeps him on the sheet's terms. */
export function matchRfaOfferSheet(
  state: GameState,
  playerId: PlayerId,
  teamId: TeamId,
): SystemResult {
  const rules = checkMatchRfaOffer(state, playerId, teamId);
  if (!rules.allowed) throw new Error(rules.violations[0]!.message);
  const team = state.world.teams[teamId];
  if (!team || team.roster.length >= TRADE_ROSTER_RULES.maxRosterSize) {
    throw new Error(
      `Your roster is full (${TRADE_ROSTER_RULES.maxRosterSize}). Free a spot to match.`,
    );
  }
  const status = state.business.rfaStatuses[playerId]!;
  const sheet = status.activeOfferSheet!;
  // Matching keeps his own team over the cap if needed (restricted rights).
  const contract = createContract({
    ...sheet.terms,
    id: asContractId(`${sheet.terms.id}_match`),
    teamId,
  });
  let next = assignSignedContract(state, contract);
  next = withStatus(next, playerId, {
    ...status,
    activeOfferSheet: null,
    resolution: "matched",
  });
  const today = state.world.calendar.currentDate;
  const events = [
    createDomainEvent({
      type: "RfaOfferSheetMatched",
      occurredOn: today,
      payload: {
        playerId,
        teamId,
        offeringTeamId: sheet.offeringTeamId,
        contractId: contract.id,
      },
    }),
    createDomainEvent({
      type: "ContractSigned",
      occurredOn: today,
      payload: {
        playerId,
        teamId,
        contractId: contract.id,
        annualSalary: getContractSalaryForYear(contract, contract.startYear),
        endYear: contract.endYear,
        reason: "rfa_match",
      },
    }),
  ];
  return systemResult(appendSeasonEventLog(next, events), events);
}

/** Original team lets him go: he joins the offering team on the sheet. */
export function declineRfaOfferSheet(
  state: GameState,
  playerId: PlayerId,
  teamId: TeamId,
): SystemResult {
  const rules = checkDeclineMatch(state, playerId, teamId);
  if (!rules.allowed) throw new Error(rules.violations[0]!.message);
  return signWithOfferingTeam(state, playerId);
}

function signWithOfferingTeam(
  state: GameState,
  playerId: PlayerId,
): SystemResult {
  const status = state.business.rfaStatuses[playerId]!;
  const sheet = status.activeOfferSheet!;
  const offering = state.world.teams[sheet.offeringTeamId];
  const salary = sheet.terms.salaryByYear[String(sheet.terms.startYear)] ?? 0;
  const overCap =
    state.settings.financialRules.salaryCapEnabled &&
    salary >
      getTeamCapSpace(sheet.offeringTeamId, sheet.terms.startYear, state);
  if (
    !offering ||
    offering.roster.length >= TRADE_ROSTER_RULES.maxRosterSize ||
    overCap ||
    state.business.contracts[sheet.terms.id] !== undefined
  ) {
    // The sheet can no longer be honoured: he is a restricted free agent again.
    return systemResult(
      withStatus(state, playerId, {
        ...status,
        activeOfferSheet: null,
        resolution: "pending_rfa",
      }),
    );
  }
  const contract = createContract(sheet.terms);
  let next = assignSignedContract(state, contract);
  next = withStatus(next, playerId, {
    ...status,
    activeOfferSheet: null,
    resolution: "signed_elsewhere",
  });
  const events = [
    createDomainEvent({
      type: "FreeAgentSigned",
      occurredOn: state.world.calendar.currentDate,
      payload: {
        contractId: contract.id,
        playerId,
        teamId: sheet.offeringTeamId,
        fromTeamId: status.originalTeamId,
        reason: "offer_sheet",
      },
    }),
  ];
  return systemResult(appendSeasonEventLog(next, events), events);
}

/**
 * Sheets whose match window closed resolve as declined: he joins the
 * offering team. Idempotent.
 */
export function expireRfaOfferSheets(state: GameState): SystemResult {
  const currentDate = state.world.calendar.currentDate;
  let current = state;
  const events: DomainEvent[] = [];
  for (const playerId of Object.keys(state.business.rfaStatuses ?? {}).sort()) {
    const status = current.business.rfaStatuses[playerId]!;
    const sheet = status.activeOfferSheet;
    if (sheet == null || status.resolution !== "pending_match") continue;
    if (currentDate <= sheet.matchDeadlineDate) continue;
    const resolved = signWithOfferingTeam(current, playerId as PlayerId);
    current = resolved.state;
    events.push(
      createDomainEvent({
        type: "RfaOfferSheetExpired",
        occurredOn: currentDate,
        payload: {
          playerId,
          teamId: status.originalTeamId,
          offeringTeamId: sheet.offeringTeamId,
        },
      }),
      ...resolved.events,
    );
  }
  return systemResult(current, events);
}

/**
 * CPU teams answer offer sheets for their players: match valuable players
 * on terms they can afford, otherwise decline.
 */
export function decideCpuRfaMatches(state: GameState): SystemResult {
  let current = state;
  const events: DomainEvent[] = [];
  for (const playerId of Object.keys(state.business.rfaStatuses ?? {}).sort()) {
    const status = current.business.rfaStatuses[playerId]!;
    if (status.resolution !== "pending_match" || !status.activeOfferSheet) {
      continue;
    }
    if (isUserControlledTeam(current, status.originalTeamId)) continue;
    const pid = playerId as PlayerId;
    const decision = cpuWouldMatch(current, pid, status)
      ? safely(() => matchRfaOfferSheet(current, pid, status.originalTeamId))
      : null;
    const resolved =
      decision ?? declineRfaOfferSheet(current, pid, status.originalTeamId);
    current = resolved.state;
    events.push(...resolved.events);
  }
  return systemResult(current, events);
}

function safely(run: () => SystemResult): SystemResult | null {
  try {
    return run();
  } catch {
    return null;
  }
}

function cpuWouldMatch(
  state: GameState,
  playerId: PlayerId,
  status: RfaStatus,
): boolean {
  const player = state.world.players[playerId];
  const sheet = status.activeOfferSheet;
  if (!player || !sheet) return false;
  const overall = calculatePlayerOverall(player.position, player.attributes);
  if (overall < RFA_AI_MATCH_MIN_OVERALL) return false;
  const salary =
    getContractSalaryForYear(sheet.terms as Contract, sheet.terms.startYear) ??
    0;
  const market = salaryForPlayer({
    overall,
    age: player.age,
    years: serviceYearsForSalary({
      age: player.age,
      seasonYear: state.competition.season.year,
      draftSeasonYear: player.developmentLeague?.draftSeasonYear ?? null,
      seasonsPlayed:
        state.business.playerHistory[playerId]?.seasons.length ?? 0,
    }),
    cap: getLeagueSalaryCap(state),
    kind: "fa",
  });
  if (salary > market * RFA_AI_MATCH_MAX_MARKET_MULTIPLE) return false;
  const budget = aiPayrollBudget(state, status.originalTeamId);
  if (budget === null) return true;
  const payroll = getTeamPayroll(
    status.originalTeamId,
    sheet.terms.startYear,
    state,
  );
  const committed =
    pendingQualifyingOffers(state, status.originalTeamId).salary +
    pendingOutgoingSheets(state, status.originalTeamId).salary;
  return payroll + committed + salary <= budget;
}

/**
 * Free agency is closing: CPU teams answer their open sheets, and sheets an
 * owner has not answered count as declined.
 */
export function closeOfferSheetsAtFreeAgencyClose(
  state: GameState,
): SystemResult {
  const decided = decideCpuRfaMatches(state);
  let current = decided.state;
  const events = [...decided.events];
  for (const playerId of Object.keys(
    current.business.rfaStatuses ?? {},
  ).sort()) {
    const status = current.business.rfaStatuses[playerId]!;
    if (status.resolution !== "pending_match" || !status.activeOfferSheet) {
      continue;
    }
    const resolved = signWithOfferingTeam(current, playerId as PlayerId);
    current = resolved.state;
    events.push(...resolved.events);
  }
  return systemResult(current, events);
}

/**
 * When free agency closes, restricted free agents without a sheet accept
 * their qualifying offer: one season with the old team (when it has room).
 */
export function resolveQualifyingOffersAtFreeAgencyClose(
  state: GameState,
): SystemResult {
  let current = state;
  const events: DomainEvent[] = [];
  const year = getContractSigningYear(state);
  for (const playerId of Object.keys(state.business.rfaStatuses ?? {}).sort()) {
    const status = current.business.rfaStatuses[playerId]!;
    if (!isActiveRfa(status) || status.resolution !== "pending_rfa") continue;
    const team = current.world.teams[status.originalTeamId];
    const player = current.world.players[playerId];
    if (!player || player.retired === true || player.teamId !== null) {
      continue;
    }
    // A CPU team takes him back only if this season's budget still allows.
    const unaffordable =
      !isUserControlledTeam(current, status.originalTeamId) &&
      aiPayrollRoom(current, status.originalTeamId, year) <
        status.qualifyingOfferSalary;
    if (
      !team ||
      team.roster.length >= TRADE_ROSTER_RULES.maxRosterSize ||
      unaffordable
    ) {
      current = withStatus(current, playerId as PlayerId, {
        ...status,
        resolution: "declined_to_ufa",
      });
      continue;
    }
    const contract = createContract({
      id: asContractId(`contract_qo_${playerId}_${year}`),
      playerId: playerId as PlayerId,
      teamId: status.originalTeamId,
      startYear: year,
      endYear: year,
      salaryByYear: { [String(year)]: status.qualifyingOfferSalary },
    });
    current = assignSignedContract(current, contract);
    current = withStatus(current, playerId as PlayerId, {
      ...status,
      resolution: "accepted_qo",
    });
    events.push(
      createDomainEvent({
        type: "ContractSigned",
        occurredOn: current.world.calendar.currentDate,
        payload: {
          playerId,
          teamId: status.originalTeamId,
          contractId: contract.id,
          annualSalary: status.qualifyingOfferSalary,
          endYear: year,
          reason: "qualifying_offer",
        },
      }),
    );
  }
  return systemResult(appendSeasonEventLog(current, events), events);
}

function withStatus(
  state: GameState,
  playerId: PlayerId,
  status: RfaStatus,
): GameState {
  return {
    ...state,
    business: {
      ...state.business,
      rfaStatuses: { ...state.business.rfaStatuses, [playerId]: status },
    },
  };
}

/**
 * A team's restricted free agents still waiting (no sheet): they return on
 * their qualifying offers when free agency closes, so CPU teams plan around
 * the roster spots and salary.
 */
export function pendingQualifyingOffers(
  state: GameState,
  teamId: TeamId,
): { count: number; salary: number } {
  let count = 0;
  let salary = 0;
  const year = state.competition.season.year;
  for (const status of Object.values(state.business.rfaStatuses ?? {})) {
    if (
      status.originalTeamId === teamId &&
      status.seasonYear === year &&
      isActiveRfa(status) &&
      status.resolution === "pending_rfa" &&
      state.world.players[status.playerId]?.teamId == null
    ) {
      count += 1;
      salary += status.qualifyingOfferSalary;
    }
  }
  return { count, salary };
}

/** Active RFA without a pending sheet: reachable only by an offer sheet. */
export function isOpenRestrictedFreeAgent(
  state: GameState,
  playerId: PlayerId,
): boolean {
  const status = state.business.rfaStatuses?.[playerId];
  return (
    status !== undefined &&
    isActiveRfa(status) &&
    status.resolution === "pending_rfa"
  );
}
