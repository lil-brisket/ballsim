/**
 * Contract extensions: one set of rules for owners and CPU teams.
 *
 * - {@link evaluateExtensionOffer} is the player's answer to terms (accept,
 *   counter or refuse), a pure function of state.
 * - {@link applyContractExtension} writes the extended contract after the cap
 *   check, and emits `ContractSigned` with reason "extension".
 * - {@link offerContractExtension} is the owner path: eligibility, answer,
 *   negotiation memory (refusal cooldown, "testing the market").
 * - {@link processCpuContractExtensions} is the CPU pass when roster
 *   decisions begin: it extends stars near the end of their deals through
 *   the same functions, on the terms an owner would get.
 */

import { calendarDaysBetween, addCalendarDays } from "@/domain/calendar-date";
import {
  createContract,
  getContractSalaryForYear,
  type Contract,
} from "@/domain/entities/contract";
import type {
  ExtensionResponseRecord,
  ExtensionTalks,
} from "@/domain/entities/extension-talks";
import { createDomainEvent, type DomainEvent } from "@/domain/events";
import type { Player } from "@/domain/entities/player";
import type { PlayerId, TeamId } from "@/domain/ids";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { appendSeasonEventLog } from "@/state/game-state";
import {
  getOwnedFranchiseAssistance,
  isUserControlledTeam,
} from "@/state/owner-context";
import { aiPayrollBudget } from "@/systems/ai-payroll-budget";
import {
  CPU_CONTRACT_END_AGE,
  cpuContractYears,
} from "@/systems/free-agent-market";
import { luxuryTaxThreshold } from "@/systems/payroll-rules";
import { moraleFactor } from "@/systems/player-morale";
import { aiWillPayTax, hasVeteranRights } from "@/systems/veteran-rights";
import { checkContractExtensionWindow } from "@/systems/league-rules/contract-rules";
import { getLeagueSalaryCap } from "@/systems/league-salary-cap";
import { canAiExecute } from "@/systems/simulation/management-policy";
import { getContractSigningYear, getTeamPayroll } from "@/systems/salary-cap";
import {
  salaryForPlayer,
  serviceYearsForSalary,
  salaryBoundsBlockReason,
  vetMinSalary,
} from "@/systems/salary-scale";

const EXTENSION_OVERALL_FLOOR = 80;
/** The CPU extends a star with this many seasons or fewer left. */
const CPU_EXTENSION_SEASONS_LEFT = 1;
/** A CPU team re-signs expiring players among its best this many. */
export const CPU_RESIGN_ROTATION_SIZE = 9;
/** ...who are at least this good. */
export const CPU_RESIGN_OVERALL_FLOOR = 65;

/** An owner may extend a player with this many seasons or fewer left. */
export const EXTENSION_ELIGIBLE_SEASONS_LEFT = 2;
/** Longest extension, in added seasons. */
export const EXTENSION_MAX_YEARS = 5;
/** Days after a refusal before he will hear another offer. */
export const EXTENSION_REFUSAL_COOLDOWN_DAYS = 14;
/** Refusals on one contract before he decides to test free agency. */
export const EXTENSION_REFUSALS_BEFORE_MARKET = 2;
/** Offers at least this share of his ask get a counter instead of a no. */
export const EXTENSION_COUNTER_RATIO = 0.85;
/** Win% swing of the ask: a .250 team pays 5% more, a .750 team 5% less. */
export const EXTENSION_WINNING_SWING = 0.2;
/** Ask discount per loyalty point above 50 (loyalty 90: 4% less). */
export const EXTENSION_LOYALTY_DISCOUNT_PER_POINT = 0.001;
/** Most an unhappy player adds to his ask (morale 0). */
export const EXTENSION_UNHAPPY_PREMIUM = 0.1;
/** From this age a player wants at least two more seasons. */
export const EXTENSION_SECURITY_AGE = 30;

export type ExtensionTerms = {
  /** Seasons added after the current deal. */
  years: number;
  /** Flat salary for each added season. */
  salary: number;
};

export type ExtensionAsk = {
  salary: number;
  minYears: number;
  maxYears: number;
};

export type ExtensionAnswer =
  | { kind: "accept" }
  | { kind: "counter"; salary: number; years: number }
  | { kind: "refuse"; reason: string };

/** What the player wants to extend. Deterministic from state. */
export function playerExtensionAsk(
  state: GameState,
  playerId: PlayerId,
  teamId: TeamId,
): ExtensionAsk {
  const player = state.world.players[playerId];
  if (!player) throw new Error(`Player "${playerId}" does not exist.`);
  const overall = calculatePlayerOverall(player.position, player.attributes);
  const base = salaryForPlayer({
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
    kind: "extension",
  });
  // Players give a winning team a small discount and a losing one a
  // premium; loyal players take a little less to stay.
  // An unhappy player asks for up to 10% more.
  const swing =
    (0.5 - teamWinPct(state, teamId)) * EXTENSION_WINNING_SWING -
    (player.personality.loyalty - 50) * EXTENSION_LOYALTY_DISCOUNT_PER_POINT +
    (1 - moraleFactor(state, playerId)) * EXTENSION_UNHAPPY_PREMIUM;
  const salary = Math.max(
    vetMinSalary(getLeagueSalaryCap(state)),
    Math.round((base * (1 + swing)) / 1_000) * 1_000,
  );
  return {
    salary,
    minYears: player.age >= EXTENSION_SECURITY_AGE ? 2 : 1,
    maxYears: EXTENSION_MAX_YEARS,
  };
}

/** The player's answer to extension terms. Pure; same for user and CPU. */
export function evaluateExtensionOffer(
  state: GameState,
  playerId: PlayerId,
  teamId: TeamId,
  terms: ExtensionTerms,
): ExtensionAnswer {
  const ask = playerExtensionAsk(state, playerId, teamId);
  const ratio = ask.salary > 0 ? terms.salary / ask.salary : 1;
  if (ratio < EXTENSION_COUNTER_RATIO) {
    return {
      kind: "refuse",
      reason: "The offer is well below what he is worth.",
    };
  }
  const years = Math.min(ask.maxYears, Math.max(ask.minYears, terms.years));
  if (ratio < 1 || years !== terms.years) {
    return {
      kind: "counter",
      salary: Math.max(terms.salary, ask.salary),
      years,
    };
  }
  return { kind: "accept" };
}

/**
 * Why an owner extension offer cannot be made, or null. Checks the window,
 * the contract, the negotiation memory and the terms; not the answer.
 */
export function getExtensionBlockReason(
  state: GameState,
  input: { playerId: PlayerId; teamId: TeamId; terms?: ExtensionTerms },
): string | null {
  const player = state.world.players[input.playerId];
  if (!player || player.retired === true) return "Player not found.";
  if (player.teamId !== input.teamId) return "Player is not on this team.";
  const contract = playerContract(state, input.playerId, input.teamId);
  if (!contract) return "He has no contract with this team.";
  const window = checkContractExtensionWindow(
    state,
    input.playerId,
    input.teamId,
  );
  if (!window.allowed) {
    return window.violations[0]?.message ?? "Extensions are closed right now.";
  }
  const seasonsLeft = seasonsLeftOnContract(state, contract);
  if (seasonsLeft < 0) return "His contract has already ended.";
  if (seasonsLeft > EXTENSION_ELIGIBLE_SEASONS_LEFT) {
    return `Extensions open with ${EXTENSION_ELIGIBLE_SEASONS_LEFT} seasons or fewer left on the deal.`;
  }
  const talks = activeTalks(state, input.playerId, contract);
  if (talks?.testingMarket) {
    return "He has decided to test free agency.";
  }
  if (talks?.lastRefusedOn) {
    const days = calendarDaysBetween(
      talks.lastRefusedOn,
      state.world.calendar.currentDate,
    );
    if (days < EXTENSION_REFUSAL_COOLDOWN_DAYS) {
      const until = addCalendarDays(
        talks.lastRefusedOn,
        EXTENSION_REFUSAL_COOLDOWN_DAYS,
      );
      return `He turned down the last offer. He will talk again from ${until}.`;
    }
  }
  if (input.terms) {
    const { years, salary } = input.terms;
    if (!Number.isInteger(years) || years < 1 || years > EXTENSION_MAX_YEARS) {
      return `Extensions run 1 to ${EXTENSION_MAX_YEARS} seasons.`;
    }
    const cap = getLeagueSalaryCap(state);
    const boundsBlock = salaryBoundsBlockReason(cap, salary);
    if (boundsBlock) return boundsBlock;
    const capBlock = extensionCapBlock(
      state,
      input.teamId,
      contract,
      extendedSalaryByYear(state, contract, input.terms),
    );
    if (capBlock) return capBlock;
  }
  return null;
}

export type ExtensionOfferResult = {
  result: SystemResult;
  response: ExtensionResponseRecord;
};

/**
 * Owner extension offer. Accepts extend the contract; counters and refusals
 * are remembered (refusals start a cooldown, two send him to free agency).
 */
export function offerContractExtension(
  state: GameState,
  input: { playerId: PlayerId; teamId: TeamId; terms: ExtensionTerms },
): ExtensionOfferResult {
  const blocked = getExtensionBlockReason(state, input);
  if (blocked !== null) throw new Error(blocked);
  const contract = playerContract(state, input.playerId, input.teamId)!;
  const answer = evaluateExtensionOffer(
    state,
    input.playerId,
    input.teamId,
    input.terms,
  );
  const today = state.world.calendar.currentDate;
  const response: ExtensionResponseRecord = {
    kind: answer.kind,
    offeredSalary: input.terms.salary,
    offeredYears: input.terms.years,
    askSalary: answer.kind === "counter" ? answer.salary : input.terms.salary,
    askYears: answer.kind === "counter" ? answer.years : input.terms.years,
    on: today,
  };

  if (answer.kind === "accept") {
    const applied = applyContractExtension(state, {
      playerId: input.playerId,
      teamId: input.teamId,
      salaryByYear: extendedSalaryByYear(state, contract, input.terms),
    });
    const { [input.playerId]: _done, ...talks } =
      applied.state.business.extensionTalks ?? {};
    const next: GameState = {
      ...applied.state,
      business: { ...applied.state.business, extensionTalks: talks },
    };
    return {
      result: systemResult(appendSeasonEventLog(next, applied.events), [
        ...applied.events,
      ]),
      response,
    };
  }

  const previous = activeTalks(state, input.playerId, contract);
  const refusals =
    (previous?.refusals ?? 0) + (answer.kind === "refuse" ? 1 : 0);
  const talks: ExtensionTalks = {
    playerId: input.playerId,
    teamId: input.teamId,
    contractId: contract.id,
    refusals,
    lastRefusedOn:
      answer.kind === "refuse" ? today : (previous?.lastRefusedOn ?? null),
    testingMarket: refusals >= EXTENSION_REFUSALS_BEFORE_MARKET,
    lastResponse: response,
  };
  const events: DomainEvent[] =
    answer.kind === "refuse"
      ? [
          createDomainEvent({
            type: "ContractExtensionRefused",
            occurredOn: today,
            payload: {
              playerId: input.playerId,
              teamId: input.teamId,
              offeredSalary: input.terms.salary,
              offeredYears: input.terms.years,
              testingMarket: talks.testingMarket,
            },
          }),
        ]
      : [];
  let next: GameState = {
    ...state,
    business: {
      ...state.business,
      extensionTalks: {
        ...(state.business.extensionTalks ?? {}),
        [input.playerId]: talks,
      },
    },
  };
  next = appendSeasonEventLog(next, events);
  return { result: systemResult(next, events), response };
}

/**
 * Writes an extended contract for the player (same contract id). The caller
 * supplies the full new salary schedule. Throws when the cap check fails.
 */
export function applyContractExtension(
  state: GameState,
  input: {
    playerId: PlayerId;
    teamId: TeamId;
    salaryByYear: Record<string, number>;
  },
): SystemResult {
  const contract = playerContract(state, input.playerId, input.teamId);
  if (!contract) throw new Error("He has no contract with this team.");
  const capBlock = extensionCapBlock(
    state,
    input.teamId,
    contract,
    input.salaryByYear,
  );
  if (capBlock) throw new Error(capBlock);

  const years = Object.keys(input.salaryByYear).map(Number);
  const endYear = Math.max(...years);
  // Options belonged to the old end of the deal; the extension replaces it.
  const next = createContract({
    id: contract.id,
    playerId: contract.playerId,
    teamId: contract.teamId,
    startYear: contract.startYear,
    endYear,
    salaryByYear: input.salaryByYear,
  });
  const firstNewYear = Math.max(
    contract.endYear + 1,
    getContractSigningYear(state),
  );
  const annualSalary =
    getContractSalaryForYear(next, firstNewYear) ??
    getContractSalaryForYear(next, endYear) ??
    0;
  const state2: GameState = {
    ...state,
    business: {
      ...state.business,
      contracts: { ...state.business.contracts, [next.id]: next },
    },
  };
  return systemResult(state2, [
    createDomainEvent({
      type: "ContractSigned",
      occurredOn: state.world.calendar.currentDate,
      payload: {
        playerId: input.playerId,
        teamId: input.teamId,
        contractId: next.id,
        annualSalary,
        endYear,
        reason: "extension",
      },
    }),
  ]);
}

/** Salary schedule after adding `terms` to the current deal. */
export function extendedSalaryByYear(
  state: GameState,
  contract: Contract,
  terms: ExtensionTerms,
): Record<string, number> {
  const salaryByYear = { ...contract.salaryByYear };
  const first = Math.max(contract.endYear + 1, getContractSigningYear(state));
  for (let year = first; year < first + terms.years; year += 1) {
    salaryByYear[String(year)] = terms.salary;
  }
  // Seasons skipped between the old end and the first new one (none today)
  // would break the contract shape; fill them at the new salary.
  for (let year = contract.endYear + 1; year < first; year += 1) {
    salaryByYear[String(year)] = terms.salary;
  }
  return salaryByYear;
}

/** Seasons from the signing year to the end of the deal (0 = ends now). */
export function seasonsLeftOnContract(
  state: GameState,
  contract: Contract,
): number {
  return contract.endYear - getContractSigningYear(state) + 1;
}

/**
 * Cap rule for raises and added seasons: each changed season must fit under
 * the cap. Null when it fits or the cap is off.
 */
function extensionCapBlock(
  state: GameState,
  teamId: TeamId,
  contract: Contract,
  salaryByYear: Record<string, number>,
): string | null {
  if (!state.settings.financialRules.salaryCapEnabled) return null;
  // Veteran rights: a team may go over the cap to keep its own player.
  if (hasVeteranRights(state, contract.playerId, teamId)) return null;
  const cap = getLeagueSalaryCap(state);
  const fromYear = getContractSigningYear(state);
  for (const [key, salary] of Object.entries(salaryByYear)) {
    const year = Number(key);
    if (year < fromYear) continue;
    const old = getContractSalaryForYear(contract, year) ?? 0;
    if (salary <= old) continue;
    const payroll = getTeamPayroll(teamId, year, state) - old + salary;
    if (payroll > cap) {
      return `The extension would put you over the cap in ${year}.`;
    }
  }
  return null;
}

function playerContract(
  state: GameState,
  playerId: PlayerId,
  teamId: TeamId,
): Contract | undefined {
  const contractId = state.world.players[playerId]?.contractId;
  const contract =
    contractId != null ? state.business.contracts[contractId] : undefined;
  return contract?.teamId === teamId ? contract : undefined;
}

/** Talks for the player's current contract (older talks no longer apply). */
export function activeTalks(
  state: GameState,
  playerId: PlayerId,
  contract: Contract,
): ExtensionTalks | undefined {
  const talks = state.business.extensionTalks?.[playerId];
  return talks?.contractId === contract.id ? talks : undefined;
}

function teamWinPct(state: GameState, teamId: TeamId): number {
  const standing = state.competition.standings.byTeamId[teamId];
  const played = (standing?.wins ?? 0) + (standing?.losses ?? 0);
  if (standing && played >= 10) return standing.wins / played;
  const seasons = state.business.franchiseHistory[teamId]?.seasons ?? [];
  const last = seasons[seasons.length - 1];
  if (last && last.wins + last.losses > 0) {
    return last.wins / (last.wins + last.losses);
  }
  if (standing && played > 0) return standing.wins / played;
  return 0.5;
}

/**
 * CPU pass at the start of roster decisions: each team extends its stars
 * whose deals end this season or next, and CPU teams re-sign the expiring
 * players of their rotation, at his ask for a CPU-length deal (see
 * {@link cpuContractYears}, within the seasons he takes). Seasons already
 * signed never change.
 */
export function processCpuContractExtensions(state: GameState): SystemResult {
  let current = state;
  const events: DomainEvent[] = [];

  for (const team of Object.values(current.world.teams)) {
    const result = extendTeamCore(current, team.id);
    current = result.state;
    events.push(...result.events);
  }

  return systemResult(current, events);
}

type ExtensionCandidate = {
  playerId: PlayerId;
  overall: number;
};

/**
 * Who a team tries to keep, best first: stars with a season or less left,
 * and (CPU teams only) expiring rotation players.
 */
function extensionCandidates(
  state: GameState,
  teamId: TeamId,
  userControlled: boolean,
): ExtensionCandidate[] {
  const team = state.world.teams[teamId];
  if (!team) return [];
  const ranked = team.roster
    .map((playerId) => state.world.players[playerId])
    .filter(
      (player): player is Player =>
        player !== undefined && player.retired !== true,
    )
    .map((player) => ({
      player,
      overall: calculatePlayerOverall(player.position, player.attributes),
    }))
    .sort(
      (a, b) =>
        b.overall - a.overall ||
        (a.player.id < b.player.id ? -1 : a.player.id > b.player.id ? 1 : 0),
    );

  const candidates: ExtensionCandidate[] = [];
  ranked.forEach(({ player, overall }, rank) => {
    if (player.contractId == null) return;
    const contract = state.business.contracts[player.contractId];
    if (!contract || contract.teamId !== teamId) return;
    const seasonsLeft = seasonsLeftOnContract(state, contract);
    if (seasonsLeft < 0) return;
    const star =
      overall >= EXTENSION_OVERALL_FLOOR &&
      seasonsLeft <= CPU_EXTENSION_SEASONS_LEFT;
    const rotation =
      !userControlled &&
      seasonsLeft === 0 &&
      rank < CPU_RESIGN_ROTATION_SIZE &&
      overall >= CPU_RESIGN_OVERALL_FLOOR &&
      player.age <= CPU_CONTRACT_END_AGE;
    if (star || rotation) {
      candidates.push({ playerId: player.id, overall });
    }
  });
  return candidates;
}

function extendTeamCore(state: GameState, teamId: TeamId): SystemResult {
  const team = state.world.teams[teamId];
  if (!team) return systemResult(state);
  // An owner's stars are only extended when the owner delegated it.
  const userControlled = isUserControlledTeam(state, teamId);
  if (
    userControlled &&
    !canAiExecute(
      state.settings,
      "EXTEND_KEY_PLAYER",
      getOwnedFranchiseAssistance(state, teamId),
    )
  ) {
    return systemResult(state);
  }

  let current = state;
  const events: DomainEvent[] = [];

  for (const { playerId, overall } of extensionCandidates(
    state,
    teamId,
    userControlled,
  )) {
    const player = current.world.players[playerId];
    if (!player || player.contractId == null) continue;
    const contract = current.business.contracts[player.contractId];
    if (!contract || contract.teamId !== teamId) continue;
    if (activeTalks(current, playerId, contract)?.testingMarket) continue;

    const ask = playerExtensionAsk(current, playerId, teamId);
    const years = Math.min(
      ask.maxYears,
      Math.max(ask.minYears, cpuContractYears(player.age, overall)),
    );
    const terms: ExtensionTerms = { years, salary: ask.salary };
    const answer = evaluateExtensionOffer(current, playerId, teamId, terms);
    if (answer.kind !== "accept") continue;

    const salaryByYear = extendedSalaryByYear(current, contract, terms);
    // AI teams also stay within what they can afford (#93). Owners who
    // delegated get the cap check only, as before.
    if (
      !userControlled &&
      !cpuCanAffordExtension(current, teamId, contract, salaryByYear)
    ) {
      continue;
    }
    try {
      const applied = applyContractExtension(current, {
        playerId,
        teamId,
        salaryByYear,
      });
      current = applied.state;
      events.push(...applied.events);
    } catch {
      // Over the cap in an added season: leave the deal as it is.
    }
  }

  return systemResult(current, events);
}

/**
 * Whether a CPU team's budget covers every added season. Seasons ahead hold
 * few signed deals yet (the roster is filled later), so each is projected at
 * no less than last season's payroll, with his new salary in place of his old
 * one. Above the tax line only for a team that will pay it.
 */
function cpuCanAffordExtension(
  state: GameState,
  teamId: TeamId,
  contract: Contract,
  salaryByYear: Record<string, number>,
): boolean {
  const lastYear = state.competition.season.year;
  const lastPayroll =
    getTeamPayroll(teamId, lastYear, state) -
    (getContractSalaryForYear(contract, lastYear) ?? 0);
  const budget = aiPayrollBudget(state, teamId);
  const taxLine =
    state.settings.financialRules.luxuryTaxEnabled &&
    !aiWillPayTax(state, teamId)
      ? luxuryTaxThreshold(state.settings, getLeagueSalaryCap(state))
      : Number.POSITIVE_INFINITY;
  const firstAdded = Math.max(
    contract.endYear + 1,
    getContractSigningYear(state),
  );
  for (let year = firstAdded; ; year += 1) {
    const salary = salaryByYear[String(year)];
    if (salary === undefined) return true;
    const payroll =
      Math.max(getTeamPayroll(teamId, year, state), lastPayroll) + salary;
    if (budget !== null && payroll > budget) return false;
    if (payroll > taxLine) return false;
  }
}

/** How many of an owner's best players get a final-year notice. */
export const FINAL_YEAR_NOTICE_TOP_PLAYERS = 5;

/**
 * Owner notice for key players starting the last season of their deal, so
 * the owner can extend them before free agency. Emits events only.
 */
export function announceFinalContractYears(state: GameState): DomainEvent[] {
  const year = state.competition.season.year;
  const events: DomainEvent[] = [];
  for (const teamId of [...state.user.ownedTeamIds].sort()) {
    const team = state.world.teams[teamId];
    if (!team) continue;
    const ranked = team.roster
      .map((id) => state.world.players[id])
      .filter((p) => p !== undefined && p.retired !== true)
      .map((p) => ({
        player: p!,
        overall: calculatePlayerOverall(p!.position, p!.attributes),
      }))
      .sort(
        (a, b) => b.overall - a.overall || (a.player.id < b.player.id ? -1 : 1),
      )
      .slice(0, FINAL_YEAR_NOTICE_TOP_PLAYERS);
    for (const { player } of ranked) {
      const contract = playerContract(state, player.id, teamId);
      if (!contract || contract.endYear !== year) continue;
      events.push(
        createDomainEvent({
          type: "ContractFinalYear",
          occurredOn: state.world.calendar.currentDate,
          payload: {
            playerId: player.id,
            teamId,
            seasonYear: year,
            salary: getContractSalaryForYear(contract, year) ?? 0,
          },
        }),
      );
    }
  }
  return events;
}
