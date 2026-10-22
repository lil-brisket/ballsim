/**
 * Releasing a player who is still under contract: waive (dead money on the
 * original schedule) or buyout (a negotiated lump now, cap hit spread over
 * the seasons the deal had left). Players with no salary left go through the
 * plain {@link releasePlayerToFreeAgency}.
 *
 * Money rules:
 * - The cap/payroll view of a season counts dead money through
 *   `getTeamPayroll`, so cap space, trades, AI budgets and books all see it.
 * - Waived money is paid from cash by weekly payroll like any salary. The
 *   release season keeps its full salary as dead money: weeks already paid
 *   were paid under the contract, and the rest is paid as the season goes on.
 * - A buyout pays its lump from cash at release. Its entries are prepaid, so
 *   weekly payroll skips them. Salary of the release season that was already
 *   paid stays on the cap as a prepaid `buyout_paid` entry.
 */

import { addCalendarDays, calendarDaysBetween } from "@/domain/calendar-date";
import { getContractSalaryForYear } from "@/domain/entities/contract";
import type { DeadMoneyEntry } from "@/domain/entities/dead-money";
import { createDomainEvent, type DomainEvent } from "@/domain/events";
import type { PlayerId, TeamId } from "@/domain/ids";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { appendSeasonEventLog } from "@/state/game-state";
import {
  getTopLeagueRosterSize,
  isPlayerDlAssigned,
} from "@/systems/development-league/franchise-membership";
import { releasePlayerToFreeAgency } from "@/systems/free-agency";
import { checkPlayerReleaseWindow } from "@/systems/league-rules/contract-rules";
import { regularSeasonDateSpan } from "@/systems/regular-season-pay";
import {
  getContractSigningYear,
  getTeamCapSpace,
  getTeamPayroll,
} from "@/systems/salary-cap";
import { getLeagueSalaryCap } from "@/systems/league-salary-cap";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import { applyCashOnlyImpact } from "@/systems/team-finances";
import { TRADE_ROSTER_RULES } from "@/systems/trades-config";

export type ReleaseMode = "waive" | "buyout";

/** A player signed this recently cannot be released (no sign-and-cut). */
export const RELEASE_SIGNING_COOLDOWN_DAYS = 14;

/** Share of the remaining salary a player accepts in a buyout. */
export const BUYOUT_RATE_BASE = 0.9;
export const BUYOUT_RATE_MIN = 0.75;
export const BUYOUT_RATE_MAX = 0.95;
/** Veterans this old take a little less to get out early. */
export const BUYOUT_VETERAN_AGE = 32;
export const BUYOUT_VETERAN_DISCOUNT = 0.05;

export type ReleaseSeasonCost = {
  seasonYear: number;
  /** Cap hit that season. */
  capHit: number;
  /** Cash still to be paid that season through weekly payroll. */
  cashDue: number;
};

export type ReleasePreview = {
  playerId: PlayerId;
  teamId: TeamId;
  mode: ReleaseMode;
  /** Salary still owed under the contract before the release. */
  remainingSalary: number;
  /** Buyout: lump paid now. Waive: 0. */
  cashNow: number;
  /** Buyout: share of the remaining salary the player accepts. */
  buyoutRate: number | null;
  seasons: ReleaseSeasonCost[];
  /** Cap space in the first affected season after the release. */
  capSpaceAfter: number;
  entries: DeadMoneyEntry[];
};

export type ReleaseInput = {
  playerId: PlayerId;
  teamId: TeamId;
  mode: ReleaseMode;
};

/**
 * Why the release is not allowed, or null. Same checks for the user and CPU.
 */
export function getPlayerReleaseBlockReason(
  state: GameState,
  input: { playerId: PlayerId; teamId: TeamId },
): string | null {
  const player = state.world.players[input.playerId];
  if (!player || player.retired === true) {
    return "Player not found.";
  }
  if (player.teamId !== input.teamId) {
    return "Player is not on this team.";
  }
  const window = checkPlayerReleaseWindow(state);
  if (!window.allowed) {
    return window.violations[0]?.message ?? "Releases are closed right now.";
  }
  if (isInSeasonPhase(state) && !isPlayerDlAssigned(player)) {
    const after = getTopLeagueRosterSize(input.teamId, state) - 1;
    if (after < TRADE_ROSTER_RULES.minRosterSize) {
      return `Releasing him would leave fewer than ${TRADE_ROSTER_RULES.minRosterSize} players on the roster.`;
    }
  }
  if (isInPendingTrade(state, input.playerId)) {
    return "He is part of a pending trade offer. Resolve the offer first.";
  }
  const signedOn = recentSigningDate(state, input.playerId);
  if (signedOn !== null) {
    const days = calendarDaysBetween(
      signedOn,
      state.world.calendar.currentDate,
    );
    if (days < RELEASE_SIGNING_COOLDOWN_DAYS) {
      return `He signed ${days === 0 ? "today" : `${days} day${days === 1 ? "" : "s"} ago`}. Players can be released ${RELEASE_SIGNING_COOLDOWN_DAYS} days after signing.`;
    }
  }
  return null;
}

/** Deterministic buyout acceptance rate from age and competitiveness. */
export function buyoutRateForPlayer(state: GameState, playerId: PlayerId) {
  const player = state.world.players[playerId];
  if (!player) return BUYOUT_RATE_BASE;
  let rate = BUYOUT_RATE_BASE;
  if (player.age >= BUYOUT_VETERAN_AGE) rate -= BUYOUT_VETERAN_DISCOUNT;
  // Competitive players give up more money to get to a contender.
  rate -= (player.personality.competitiveness - 50) / 400;
  rate = Math.min(BUYOUT_RATE_MAX, Math.max(BUYOUT_RATE_MIN, rate));
  return Math.round(rate * 100) / 100;
}

/**
 * Cost of releasing a player, without changing state. Throws when the player
 * has no contract with the team.
 */
export function previewPlayerRelease(
  state: GameState,
  input: ReleaseInput,
): ReleasePreview {
  const player = state.world.players[input.playerId];
  const contract =
    player?.contractId != null
      ? state.business.contracts[player.contractId]
      : undefined;
  if (!player || !contract || contract.teamId !== input.teamId) {
    throw new Error("Player has no contract with this team.");
  }

  const createdOn = state.world.calendar.currentDate;
  const firstYear = getContractSigningYear(state);
  const owed: { seasonYear: number; salary: number; unpaid: number }[] = [];
  for (let year = firstYear; year <= contract.endYear; year += 1) {
    const salary = getContractSalaryForYear(contract, year);
    if (salary === undefined || salary <= 0) continue;
    const unpaid = Math.round(salary * unpaidShareOfSeason(state, year));
    owed.push({ seasonYear: year, salary, unpaid });
  }
  const remainingSalary = owed.reduce((sum, row) => sum + row.unpaid, 0);

  const entries: DeadMoneyEntry[] = [];
  let cashNow = 0;
  let buyoutRate: number | null = null;
  const base = {
    playerId: input.playerId,
    teamId: input.teamId,
    createdOn,
  };

  if (input.mode === "waive") {
    for (const row of owed) {
      entries.push({
        ...base,
        seasonYear: row.seasonYear,
        amount: row.salary,
        reason: "waived",
        prepaid: false,
      });
    }
  } else {
    buyoutRate = buyoutRateForPlayer(state, input.playerId);
    cashNow = Math.round((remainingSalary * buyoutRate) / 1_000) * 1_000;
    for (const row of owed) {
      const paid = row.salary - row.unpaid;
      if (paid > 0) {
        entries.push({
          ...base,
          seasonYear: row.seasonYear,
          amount: paid,
          reason: "buyout_paid",
          prepaid: true,
        });
      }
    }
    const spreadOver = owed.filter((row) => row.unpaid > 0);
    if (spreadOver.length > 0 && cashNow > 0) {
      const share = Math.floor(cashNow / spreadOver.length);
      spreadOver.forEach((row, index) => {
        const amount =
          index === 0 ? cashNow - share * (spreadOver.length - 1) : share;
        entries.push({
          ...base,
          seasonYear: row.seasonYear,
          amount,
          reason: "bought_out",
          prepaid: true,
        });
      });
    }
  }

  const seasons: ReleaseSeasonCost[] = owed.map((row) => {
    const forYear = entries.filter((e) => e.seasonYear === row.seasonYear);
    return {
      seasonYear: row.seasonYear,
      capHit: forYear.reduce((sum, e) => sum + e.amount, 0),
      cashDue:
        input.mode === "waive" ? row.unpaid : 0 /* buyout cash is paid now */,
    };
  });

  // Cap space after: the contract salary leaves, the cap hit arrives.
  const capYear = owed[0]?.seasonYear ?? firstYear;
  const contractSalary = getContractSalaryForYear(contract, capYear) ?? 0;
  const capHit = seasons[0]?.capHit ?? 0;
  const countsOnCap = !isPlayerDlAssigned(player);
  const capSpaceAfter =
    getTeamCapSpace(input.teamId, capYear, state) +
    (countsOnCap ? contractSalary : 0) -
    capHit;

  return {
    playerId: input.playerId,
    teamId: input.teamId,
    mode: input.mode,
    remainingSalary,
    cashNow,
    buyoutRate,
    seasons,
    capSpaceAfter,
    entries,
  };
}

/**
 * Ends the player's contract, books the dead money (and a buyout lump), and
 * releases him to free agency. Callers check {@link getPlayerReleaseBlockReason}.
 */
export function releasePlayerUnderContract(
  state: GameState,
  input: ReleaseInput,
): SystemResult {
  const blocked = getPlayerReleaseBlockReason(state, input);
  if (blocked !== null) {
    throw new Error(blocked);
  }
  const player = state.world.players[input.playerId]!;
  const contract =
    player.contractId != null
      ? state.business.contracts[player.contractId]
      : undefined;
  if (!contract || contract.teamId !== input.teamId) {
    // Nothing owed: an ordinary release.
    return releasePlayerToFreeAgency(state, input.playerId);
  }

  const preview = previewPlayerRelease(state, input);
  const { [contract.id]: _ended, ...contracts } = state.business.contracts;
  const deadMoney = state.business.deadMoney ?? {};
  let current: GameState = {
    ...state,
    business: {
      ...state.business,
      contracts,
      deadMoney: {
        ...deadMoney,
        [input.teamId]: [
          ...(deadMoney[input.teamId] ?? []),
          ...preview.entries,
        ],
      },
    },
    world: {
      ...state.world,
      players: {
        ...state.world.players,
        [input.playerId]: { ...player, contractId: null },
      },
    },
  };

  const released = releasePlayerToFreeAgency(current, input.playerId);
  current = released.state;

  if (preview.cashNow > 0) {
    current = applyCashOnlyImpact(
      current,
      input.teamId,
      -preview.cashNow,
    ).state;
  }

  const finance = current.business.finances[input.teamId];
  if (finance) {
    current = {
      ...current,
      business: {
        ...current.business,
        finances: {
          ...current.business.finances,
          [input.teamId]: {
            ...finance,
            payroll: getTeamPayroll(
              input.teamId,
              current.competition.season.year,
              current,
            ),
          },
        },
      },
    };
  }

  const event = createDomainEvent({
    type: input.mode === "waive" ? "PlayerWaived" : "PlayerBoughtOut",
    occurredOn: state.world.calendar.currentDate,
    payload: {
      playerId: input.playerId,
      teamId: input.teamId,
      formerTeamId: input.teamId,
      contractId: contract.id,
      deadMoneyTotal: preview.entries.reduce((sum, e) => sum + e.amount, 0),
      buyoutAmount: preview.cashNow,
      seasons: preview.seasons.map((s) => s.seasonYear),
    },
  });
  // The waive/buyout event replaces the plain PlayerReleased.
  const events: DomainEvent[] = [
    ...released.events.filter((e) => e.type !== "PlayerReleased"),
    event,
  ];
  current = appendSeasonEventLog(current, [event]);
  return systemResult(current, events);
}

/** CPU teams only waive players whose dead money is at most this share of the cap. */
export const AI_WAIVE_MAX_DEAD_MONEY_CAP_SHARE = 0.03;

/**
 * The player a CPU team waives to open a roster spot for a needed position:
 * its lowest-rated player at a position it has more than one of, whose dead
 * money stays small. Null when nobody qualifies.
 */
export function findCpuWaiverCandidate(
  state: GameState,
  teamId: TeamId,
  neededPosition: string,
): PlayerId | null {
  const team = state.world.teams[teamId];
  if (!team) return null;
  const counts = new Map<string, number>();
  for (const id of team.roster) {
    const p = state.world.players[id];
    if (p && !isPlayerDlAssigned(p)) {
      counts.set(p.position, (counts.get(p.position) ?? 0) + 1);
    }
  }
  const maxDead = getLeagueSalaryCap(state) * AI_WAIVE_MAX_DEAD_MONEY_CAP_SHARE;
  let best: { id: PlayerId; overall: number; dead: number } | null = null;
  for (const id of team.roster) {
    const player = state.world.players[id];
    if (!player || isPlayerDlAssigned(player) || player.contractId == null) {
      continue;
    }
    if (player.position === neededPosition) continue;
    if ((counts.get(player.position) ?? 0) < 2) continue;
    const contract = state.business.contracts[player.contractId];
    if (!contract || contract.teamId !== teamId) continue;
    if (getPlayerReleaseBlockReason(state, { playerId: id, teamId }) !== null) {
      continue;
    }
    const preview = previewPlayerRelease(state, {
      playerId: id,
      teamId,
      mode: "waive",
    });
    const dead = preview.entries.reduce((sum, e) => sum + e.amount, 0);
    if (dead > maxDead) continue;
    const overall = calculatePlayerOverall(player.position, player.attributes);
    if (
      best === null ||
      overall < best.overall ||
      (overall === best.overall &&
        (dead < best.dead || (dead === best.dead && id < best.id)))
    ) {
      best = { id, overall, dead };
    }
  }
  return best?.id ?? null;
}

function isInSeasonPhase(state: GameState): boolean {
  const phase = state.competition.season.phase;
  return phase === "preseason" || phase === "regular" || phase === "playoffs";
}

function isInPendingTrade(state: GameState, playerId: PlayerId): boolean {
  for (const decision of state.user.pendingOwnerDecisions) {
    const status = decision.payload.status;
    if (
      status !== undefined &&
      status !== "pending" &&
      status !== "negotiating"
    )
      continue;
    const proposal = decision.payload.currentProposal;
    if (
      proposal.sideA.playerIds.includes(playerId) ||
      proposal.sideB.playerIds.includes(playerId)
    ) {
      return true;
    }
  }
  return false;
}

/** Date of the free-agency signing behind the player's current contract. */
function recentSigningDate(
  state: GameState,
  playerId: PlayerId,
): string | null {
  const contractId = state.world.players[playerId]?.contractId;
  if (contractId == null) return null;
  for (const offer of Object.values(state.business.freeAgency.offers)) {
    if (
      offer.playerId === playerId &&
      offer.status === "accepted" &&
      offer.contractId === contractId
    ) {
      return offer.updatedOn;
    }
  }
  return null;
}

/**
 * Share of a season's salary not yet paid. Weekly payroll pays each week on
 * the Monday after it, so the current week is still unpaid.
 */
export function unpaidShareOfSeason(
  state: GameState,
  seasonYear: number,
): number {
  const season = state.competition.season;
  if (season.phase === "offseason" || seasonYear > season.year) {
    return seasonYear > season.year ? 1 : 0;
  }
  if (seasonYear < season.year) return 0;
  const span = regularSeasonDateSpan(state);
  if (span === null) {
    return season.phase === "preseason" ? 1 : 0;
  }
  const weekStart = startOfIsoWeek(state.world.calendar.currentDate);
  const from = weekStart > span.start ? weekStart : span.start;
  if (from > span.end) return 0;
  const total = calendarDaysBetween(span.start, span.end) + 1;
  return (calendarDaysBetween(from, span.end) + 1) / total;
}

function startOfIsoWeek(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number) as [number, number, number];
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  const sinceMonday = (weekday + 6) % 7;
  return addCalendarDays(isoDate, -sinceMonday);
}
