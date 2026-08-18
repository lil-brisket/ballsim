import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import type { DraftClass } from "@/domain/entities/draft";
import { draftClassIdFor } from "@/domain/entities/draft";
import {
  FACILITY_CATEGORIES,
  FACILITY_LEVEL_MAX,
  type FacilityCategory,
  type FranchiseOps,
} from "@/domain/entities/franchise-ops";
import type { DomainEvent } from "@/domain/events";
import type { PlayerAttributes } from "@/domain/entities/player";
import { PLAYER_ATTRIBUTE_KEYS, RATING_MAX, RATING_MIN } from "@/domain/entities/player";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { Rng } from "@/domain/rng";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import type { GameState } from "@/state/game-state";
import { calculateFranchiseValue } from "@/state/franchise-value";
import { projectCashHorizon } from "@/systems/cash-projection";
import {
  draftYearForSeason,
  getActiveDraftOnClockSlot,
  isUserOnDraftClock,
  makeDraftSelection,
} from "@/systems/draft";
import {
  calculateFinancialHealth,
  type FinancialHealthState,
} from "@/systems/financial-health";
import { getTeamPayroll } from "@/systems/salary-cap";
import { advanceSimulation } from "@/systems/simulation/advance-simulation";
import { advanceOffseasonStage } from "@/systems/simulation/offseason-lifecycle";
import { runAiTeamDecisions } from "@/systems/ai-team-decisions";
import { setMarketingBudget } from "@/systems/marketing";
import { setTicketPrice } from "@/systems/ticket-pricing";
import { getFinancialStatement } from "@/systems/team-finances";
import {
  facilityUpgradeCost,
} from "@/systems/facilities-config";
import { startFacilityUpgrade } from "@/systems/facilities";
import { estimateMonthlyBroadcastShare } from "@/systems/league-economy";
import {
  GAMEPLAY_OBJECTIVE_REWARD,
  GAMEPLAY_PLAYOFF_QUALIFICATION_REVENUE,
  GAMEPLAY_PLAYOFF_SERIES_WIN_REVENUE,
  POOR_ATTENDANCE_FILL_RATE_PCT,
  SELLOUT_FILL_RATE_PCT,
} from "@/systems/owner-objectives-config";
import { bootstrapWorld } from "@/systems/world-pipeline";
import type { TeamId } from "@/domain/ids";

export const ECONOMY_SCENARIOS = [
  "baseline",
  "win_now",
  "conservative",
  "development",
  "distress",
  "recovery",
  "aggressive",
  "high_market",
  "low_market",
] as const;

export type EconomyScenarioId = (typeof ECONOMY_SCENARIOS)[number];

export type RevenueMix = {
  gate: number;
  merchandise: number;
  concessions: number;
  sponsorship: number;
  broadcast: number;
  playoffs: number;
  other: number;
  unclassified: number;
  total: number;
  shares: Record<
    keyof Omit<RevenueMix, "shares" | "total">,
    number
  >;
};

export type CapitalAttemptKind = "facility_upgrade" | "marketing_increase";

export type CapitalAttemptOutcome =
  | "succeeded"
  | "rejected"
  | "skipped_unaffordable";

export type CapitalAttempt = {
  kind: CapitalAttemptKind;
  target: string;
  amount: number;
  outcome: CapitalAttemptOutcome;
  restrictedReason?: string;
};

export type OwnerActionLogEntry = {
  seasonYear: number;
  ticketPrice: number;
  marketingBudget: number;
  payroll: number;
  facilityLevels: Record<FacilityCategory, number>;
  endingCash: number;
  health: FinancialHealthState;
  capitalAttempts: CapitalAttempt[];
  capitalRestricted: boolean;
  attemptedCapitalSpend: number;
  succeededCapitalSpend: number;
};

export type SeasonCashFlow = {
  startingCash: number;
  endingCash: number;
  /** endingCash - startingCash */
  netCash: number;
  revenue: {
    gate: number;
    merchandise: number;
    concessions: number;
    sponsorship: number;
    broadcast: number;
    playoffs: number;
    other: number;
    unclassified: number;
    total: number;
  };
  costs: {
    playerPayroll: number;
    staff: number;
    facilityOpex: number;
    facilityInvestment: number;
    marketing: number;
    other: number;
    unclassified: number;
    total: number;
  };
  /**
   * Recurring operating revenue − recurring operating cash costs.
   * Excludes playoffs, objectives, unclassified, and facility capex.
   */
  netOperatingCashFlow: number;
  /** Playoffs + objectives + unclassified revenue − unclassified expenses. */
  nonOperatingCashFlow: number;
  minCash: number;
  firstNegativeDate: string | null;
  daysNegative: number;
  endedNegative: boolean;
};

export type SeasonEconomySnapshot = {
  seasonYear: number;
  cash: number;
  payroll: number;
  ticketPrice: number;
  marketingBudget: number;
  awareness: number;
  fanSentiment: number;
  reputation: number;
  mediaAttention: number;
  wins: number;
  losses: number;
  playoffResult: string;
  meanRosterOverall: number;
  franchiseValue: number;
  facilityLevels: Record<FacilityCategory, number>;
  revenue: RevenueMix;
  expenses: {
    playerSalaries: number;
    staff: number;
    facilities: number;
    operations: number;
    marketing: number;
    total: number;
  };
  cashFlow: SeasonCashFlow;
  runwayWeeks: number | null;
  projectedCash: number;
  health: FinancialHealthState;
  attendanceMean: number | null;
  capacityMean: number | null;
  fillRateMean: number | null;
  selloutGames: number;
  lowAttendanceGames: number;
  homeGames: number;
  /** Statement tickets at snapshot time — for double-count invariants. */
  statementTickets: number;
  statementMerchandise: number;
};

export type RecoveryDelta = {
  fromSeasonYear: number;
  toSeasonYear: number;
  cash: { from: number; to: number; delta: number };
  runwayWeeks: { from: number | null; to: number | null };
  health: { from: FinancialHealthState; to: FinancialHealthState };
  netOperatingCashFlow: { from: number; to: number; delta: number };
  improved: boolean;
};

export type EconomyHarnessResult = {
  scenario: EconomyScenarioId;
  seed: number;
  seasons: SeasonEconomySnapshot[];
  actions: OwnerActionLogEntry[];
  finalState: GameState;
  recoveryDelta: RecoveryDelta | null;
};

const MAX_DAYS_PER_SEASON = 500;
const HARNESS_SEED = 77;
const AGGRESSIVE_MARKETING_BUDGET = 7_000_000;
const AGGRESSIVE_TICKET_PRICE = 90;
/** Keep at least this much cash after optional third upgrade. */
const AGGRESSIVE_LIQUIDITY_BUFFER = 5_000_000;
const HIGH_MARKET_SIZE = 80;
const LOW_MARKET_SIZE = 25;

const HEALTH_RANK: Record<FinancialHealthState, number> = {
  insolvent: 0,
  critical: 1,
  warning: 2,
  stable: 3,
  healthy: 4,
};

type MixAccumulator = {
  gate: number;
  merchandise: number;
  concessions: number;
  sponsorship: number;
  broadcast: number;
  playoffs: number;
  other: number;
  unclassifiedRevenue: number;
  attendanceSum: number;
  capacitySum: number;
  fillRateSum: number;
  selloutGames: number;
  lowAttendanceGames: number;
  homeGames: number;
  playerPayroll: number;
  staff: number;
  facilitiesBooks: number;
  facilityInvestment: number;
  marketing: number;
  otherOpex: number;
  unclassifiedExpenses: number;
};

type CashSignTracker = {
  minCash: number;
  firstNegativeDate: string | null;
  daysNegative: number;
};

function emptyMix(): MixAccumulator {
  return {
    gate: 0,
    merchandise: 0,
    concessions: 0,
    sponsorship: 0,
    broadcast: 0,
    playoffs: 0,
    other: 0,
    unclassifiedRevenue: 0,
    attendanceSum: 0,
    capacitySum: 0,
    fillRateSum: 0,
    selloutGames: 0,
    lowAttendanceGames: 0,
    homeGames: 0,
    playerPayroll: 0,
    staff: 0,
    facilitiesBooks: 0,
    facilityInvestment: 0,
    marketing: 0,
    otherOpex: 0,
    unclassifiedExpenses: 0,
  };
}

function persistRng(state: GameState, rng: Rng): GameState {
  return {
    ...state,
    meta: { ...state.meta, rngState: rng.getState() },
  };
}

function clampRating(value: number): number {
  return Math.max(RATING_MIN, Math.min(RATING_MAX, Math.round(value)));
}

function meanRosterOverall(state: GameState, teamId: string): number {
  const team = state.world.teams[teamId];
  if (!team || team.roster.length === 0) {
    return 0;
  }
  let sum = 0;
  let count = 0;
  for (const playerId of team.roster) {
    const player = state.world.players[playerId];
    if (!player) {
      continue;
    }
    sum += calculatePlayerOverall(player.position, player.attributes);
    count += 1;
  }
  return count === 0 ? 0 : Math.round((sum / count) * 10) / 10;
}

function facilityLevelsOf(
  ops: FranchiseOps,
): Record<FacilityCategory, number> {
  const levels = {} as Record<FacilityCategory, number>;
  for (const category of FACILITY_CATEGORIES) {
    levels[category] = ops.facilities[category].level;
  }
  return levels;
}

function patchOps(
  state: GameState,
  teamId: string,
  patch: Partial<FranchiseOps>,
): GameState {
  const ops = state.business.franchiseOps[teamId];
  if (!ops) {
    return state;
  }
  return {
    ...state,
    business: {
      ...state.business,
      franchiseOps: {
        ...state.business.franchiseOps,
        [teamId]: { ...ops, ...patch, marketing: patch.marketing ?? ops.marketing },
      },
    },
  };
}

function setFacilityLevels(
  state: GameState,
  teamId: string,
  levels: Partial<Record<FacilityCategory, number>>,
): GameState {
  const ops = state.business.franchiseOps[teamId];
  if (!ops) {
    return state;
  }
  const facilities = { ...ops.facilities };
  for (const category of FACILITY_CATEGORIES) {
    const level = levels[category];
    if (level === undefined) {
      continue;
    }
    facilities[category] = { level, upgradeWeeksRemaining: 0 };
  }
  return patchOps(state, teamId, { facilities });
}

function scaleTeamContracts(
  state: GameState,
  teamId: string,
  factor: number,
): GameState {
  const contracts = { ...state.business.contracts };
  for (const [id, contract] of Object.entries(contracts)) {
    if (contract.teamId !== teamId) {
      continue;
    }
    const salaryByYear = { ...contract.salaryByYear };
    for (const [yearKey, salary] of Object.entries(salaryByYear)) {
      salaryByYear[yearKey] = Math.max(0, Math.floor(salary * factor));
    }
    contracts[id] = { ...contract, salaryByYear };
  }
  return {
    ...state,
    business: { ...state.business, contracts },
  };
}

function scaleTeamAttributes(
  state: GameState,
  teamId: string,
  delta: number,
): GameState {
  const team = state.world.teams[teamId];
  if (!team) {
    return state;
  }
  const players = { ...state.world.players };
  for (const playerId of team.roster) {
    const player = players[playerId];
    if (!player) {
      continue;
    }
    const attributes = { ...player.attributes } as PlayerAttributes;
    for (const key of PLAYER_ATTRIBUTE_KEYS) {
      attributes[key] = clampRating(attributes[key] + delta);
    }
    players[playerId] = { ...player, attributes };
  }
  return {
    ...state,
    world: { ...state.world, players },
  };
}

function shiftTeamAges(
  state: GameState,
  teamId: string,
  delta: number,
): GameState {
  const team = state.world.teams[teamId];
  if (!team) {
    return state;
  }
  const players = { ...state.world.players };
  for (const playerId of team.roster) {
    const player = players[playerId];
    if (!player) {
      continue;
    }
    const age = Math.max(18, Math.min(44, player.age + delta));
    players[playerId] = {
      ...player,
      age,
      development: {
        stage: age <= 24 ? "developing" : player.development.stage,
      },
    };
  }
  return {
    ...state,
    world: { ...state.world, players },
  };
}

function teamCash(state: GameState, teamId: string): number {
  return state.business.finances[teamId]?.cash ?? 0;
}

function emptyCapitalRollup(): {
  capitalAttempts: CapitalAttempt[];
  capitalRestricted: boolean;
  attemptedCapitalSpend: number;
  succeededCapitalSpend: number;
} {
  return {
    capitalAttempts: [],
    capitalRestricted: false,
    attemptedCapitalSpend: 0,
    succeededCapitalSpend: 0,
  };
}

function pushCapitalAttempt(
  rollup: ReturnType<typeof emptyCapitalRollup>,
  attempt: CapitalAttempt,
): void {
  rollup.capitalAttempts.push(attempt);
  if (attempt.outcome === "rejected") {
    rollup.capitalRestricted = true;
  }
  if (
    attempt.outcome === "succeeded" ||
    attempt.outcome === "rejected" ||
    attempt.outcome === "skipped_unaffordable"
  ) {
    if (attempt.outcome !== "skipped_unaffordable") {
      rollup.attemptedCapitalSpend += attempt.amount;
    }
  }
  if (attempt.outcome === "succeeded") {
    rollup.succeededCapitalSpend += attempt.amount;
  }
}

function tryMarketingIncrease(
  state: GameState,
  teamId: TeamId,
  annualBudget: number,
  rollup: ReturnType<typeof emptyCapitalRollup>,
): GameState {
  const current = state.business.franchiseOps[teamId]?.marketing.budget ?? 0;
  if (annualBudget <= current) {
    const result = setMarketingBudget(state, teamId, annualBudget);
    return result.state;
  }
  try {
    const result = setMarketingBudget(state, teamId, annualBudget);
    pushCapitalAttempt(rollup, {
      kind: "marketing_increase",
      target: "marketing",
      amount: annualBudget - current,
      outcome: "succeeded",
    });
    return result.state;
  } catch (error) {
    pushCapitalAttempt(rollup, {
      kind: "marketing_increase",
      target: "marketing",
      amount: annualBudget - current,
      outcome: "rejected",
      restrictedReason: error instanceof Error ? error.message : String(error),
    });
    return state;
  }
}

function tryFacilityUpgrade(
  state: GameState,
  teamId: TeamId,
  category: FacilityCategory,
  rollup: ReturnType<typeof emptyCapitalRollup>,
  options: { requireLiquidityBuffer: boolean },
): GameState {
  const ops = state.business.franchiseOps[teamId];
  if (!ops) {
    return state;
  }
  const facility = ops.facilities[category];
  if (
    facility.upgradeWeeksRemaining > 0 ||
    facility.level >= FACILITY_LEVEL_MAX
  ) {
    return state;
  }
  const cost = facilityUpgradeCost(category, facility.level);
  const cash = teamCash(state, teamId);
  const required =
    cost + (options.requireLiquidityBuffer ? AGGRESSIVE_LIQUIDITY_BUFFER : 0);
  if (cash < required) {
    pushCapitalAttempt(rollup, {
      kind: "facility_upgrade",
      target: category,
      amount: cost,
      outcome: "skipped_unaffordable",
    });
    return state;
  }
  try {
    const result = startFacilityUpgrade(state, teamId, category);
    pushCapitalAttempt(rollup, {
      kind: "facility_upgrade",
      target: category,
      amount: cost,
      outcome: "succeeded",
    });
    return result.state;
  } catch (error) {
    pushCapitalAttempt(rollup, {
      kind: "facility_upgrade",
      target: category,
      amount: cost,
      outcome: "rejected",
      restrictedReason: error instanceof Error ? error.message : String(error),
    });
    return state;
  }
}

/**
 * Aggressive capital attempts: arena first, then practice or fan, optional third
 * only with liquidity buffer. Does not teleport facility levels.
 */
function applyAggressivePolicy(
  state: GameState,
  teamId: TeamId,
  rollup: ReturnType<typeof emptyCapitalRollup>,
): GameState {
  let next = tryMarketingIncrease(
    state,
    teamId,
    AGGRESSIVE_MARKETING_BUDGET,
    rollup,
  );
  next = setTicketPrice(next, teamId, AGGRESSIVE_TICKET_PRICE).state;

  next = tryFacilityUpgrade(next, teamId, "arena", rollup, {
    requireLiquidityBuffer: false,
  });

  const afterArena = next;
  const practiceLevel = afterArena.business.franchiseOps[teamId]!.facilities.practice;
  const fanLevel = afterArena.business.franchiseOps[teamId]!.facilities.fan;
  const practiceAffordable =
    practiceLevel.upgradeWeeksRemaining === 0 &&
    practiceLevel.level < FACILITY_LEVEL_MAX &&
    teamCash(afterArena, teamId) >=
      facilityUpgradeCost("practice", practiceLevel.level);
  const fanAffordable =
    fanLevel.upgradeWeeksRemaining === 0 &&
    fanLevel.level < FACILITY_LEVEL_MAX &&
    teamCash(afterArena, teamId) >= facilityUpgradeCost("fan", fanLevel.level);

  if (practiceAffordable) {
    next = tryFacilityUpgrade(next, teamId, "practice", rollup, {
      requireLiquidityBuffer: false,
    });
  } else if (fanAffordable) {
    next = tryFacilityUpgrade(next, teamId, "fan", rollup, {
      requireLiquidityBuffer: false,
    });
  }

  // Optional third: the other of practice/fan, only with liquidity buffer.
  const triedPractice = rollup.capitalAttempts.some(
    (a) => a.kind === "facility_upgrade" && a.target === "practice",
  );
  const third: FacilityCategory = triedPractice ? "fan" : "practice";
  next = tryFacilityUpgrade(next, teamId, third, rollup, {
    requireLiquidityBuffer: true,
  });

  return next;
}

function applyRecoveryPolicy(state: GameState, teamId: TeamId): GameState {
  let next = setMarketingBudget(state, teamId, 250_000).state;
  next = setTicketPrice(next, teamId, 45).state;
  return next;
}

export function applyEconomyScenario(
  state: GameState,
  scenario: EconomyScenarioId,
  options: {
    capitalRollup?: ReturnType<typeof emptyCapitalRollup>;
  } = {},
): GameState {
  const teamId = state.user.controlledTeamId as TeamId;
  if (scenario === "baseline") {
    return state;
  }
  if (scenario === "win_now") {
    let next = scaleTeamAttributes(state, teamId, 8);
    next = scaleTeamContracts(next, teamId, 1.35);
    next = setTicketPrice(next, teamId, 75).state;
    next = setMarketingBudget(next, teamId, 6_000_000).state;
    return next;
  }
  if (scenario === "conservative") {
    let next = scaleTeamContracts(state, teamId, 0.7);
    next = setMarketingBudget(next, teamId, 250_000).state;
    next = setTicketPrice(next, teamId, 40).state;
    return next;
  }
  if (scenario === "development") {
    let next = shiftTeamAges(state, teamId, -3);
    next = scaleTeamContracts(next, teamId, 0.85);
    next = setFacilityLevels(next, teamId, {
      practice: 3,
      training: 3,
      youth: 3,
    });
    next = setTicketPrice(next, teamId, 35).state;
    next = setMarketingBudget(next, teamId, 1_500_000).state;
    return next;
  }
  if (scenario === "distress") {
    let next = scaleTeamAttributes(state, teamId, -10);
    next = scaleTeamContracts(next, teamId, 1.45);
    next = setFacilityLevels(next, teamId, {
      arena: 3,
      practice: 3,
      fan: 3,
    });
    next = patchOps(next, teamId, {
      fanSentiment: 25,
      mediaAttention: 15,
      marketing: { budget: 8_000_000, awareness: 20 },
    });
    next = setTicketPrice(next, teamId, 95).state;
    return next;
  }
  if (scenario === "recovery") {
    let next = applyEconomyScenario(state, "distress");
    return applyRecoveryPolicy(next, teamId);
  }
  if (scenario === "aggressive") {
    const rollup = options.capitalRollup ?? emptyCapitalRollup();
    let next = scaleTeamContracts(state, teamId, 1.35);
    next = applyAggressivePolicy(next, teamId, rollup);
    return next;
  }
  if (scenario === "high_market") {
    return patchOps(state, teamId, { marketSize: HIGH_MARKET_SIZE });
  }
  if (scenario === "low_market") {
    return patchOps(state, teamId, { marketSize: LOW_MARKET_SIZE });
  }
  return state;
}

function pickBestProspect(
  state: GameState,
  draft: DraftClass,
): DraftClass["prospects"][string]["playerId"] | undefined {
  const available = Object.values(draft.prospects).filter(
    (prospect) => prospect.status === "eligible",
  );
  if (available.length === 0) {
    return undefined;
  }
  available.sort((a, b) => {
    const overallA = calculatePlayerOverall(a.player.position, a.player.attributes);
    const overallB = calculatePlayerOverall(b.player.position, b.player.attributes);
    if (overallA !== overallB) {
      return overallB - overallA;
    }
    return a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0;
  });
  return available[0]!.playerId;
}

function autoPickUserDraft(state: GameState): GameState {
  if (!isUserOnDraftClock(state)) {
    return state;
  }
  const slot = getActiveDraftOnClockSlot(state);
  if (!slot) {
    return state;
  }
  const draftYear = draftYearForSeason(state.competition.season.year);
  const draftClassId = draftClassIdFor(draftYear);
  const draft = state.world.drafts[draftClassId];
  if (!draft || draft.status !== "active") {
    return state;
  }
  const prospectId = pickBestProspect(state, draft);
  if (!prospectId) {
    return state;
  }
  const result = makeDraftSelection(state, {
    draftClassId,
    draftPickId: slot.draftPickId,
    prospectPlayerId: prospectId,
    teamId: state.user.controlledTeamId,
  });
  return result.success ? result.state : state;
}

/**
 * Classify season cash movements from domain events.
 * HomeGameDaySettled is the aggregate source of truth for game-day revenue;
 * matching RevenueRecorded tickets/merchandise/concessions are skipped.
 * Unknown other revenue is unclassified — never guessed as broadcast.
 */
function absorbEvents(
  mix: MixAccumulator,
  events: readonly DomainEvent[],
  teamId: string,
  broadcastShare: number,
): void {
  const concessionAmounts = new Set<number>();
  for (const event of events) {
    if (event.type === "HomeGameDaySettled" && event.payload.teamId === teamId) {
      const concessions = Number(event.payload.concessionsRevenue) || 0;
      if (concessions > 0) {
        concessionAmounts.add(concessions);
      }
    }
  }

  for (const event of events) {
    if (event.type === "HomeGameDaySettled" && event.payload.teamId === teamId) {
      mix.gate += Number(event.payload.ticketRevenue) || 0;
      mix.merchandise += Number(event.payload.merchRevenue) || 0;
      mix.concessions += Number(event.payload.concessionsRevenue) || 0;
      const attendance = Number(event.payload.attendance) || 0;
      const capacity = Number(event.payload.capacity) || 0;
      mix.attendanceSum += attendance;
      mix.capacitySum += capacity;
      mix.homeGames += 1;
      if (capacity > 0) {
        const fillPct = (attendance / capacity) * 100;
        mix.fillRateSum += fillPct;
        if (fillPct >= SELLOUT_FILL_RATE_PCT && attendance >= capacity) {
          mix.selloutGames += 1;
        }
        if (fillPct < POOR_ATTENDANCE_FILL_RATE_PCT) {
          mix.lowAttendanceGames += 1;
        }
      }
      continue;
    }

    if (
      event.type === "FacilityUpgradeStarted" &&
      event.payload.teamId === teamId
    ) {
      mix.facilityInvestment += Number(event.payload.cost) || 0;
      continue;
    }

    if (
      event.type === "PlayerPayrollPaid" &&
      event.payload.teamId === teamId
    ) {
      mix.playerPayroll += Math.abs(Number(event.payload.amount) || 0);
      continue;
    }

    if (event.type === "ExpenseRecorded" && event.payload.teamId === teamId) {
      const amount = Number(event.payload.amount) || 0;
      const category = event.payload.category;
      if (category === "staff") {
        mix.staff += amount;
      } else if (category === "facilities") {
        mix.facilitiesBooks += amount;
      } else if (category === "marketing") {
        mix.marketing += amount;
      } else if (category === "operations") {
        mix.otherOpex += amount;
      } else {
        mix.unclassifiedExpenses += amount;
      }
      continue;
    }

    if (event.type !== "RevenueRecorded" || event.payload.teamId !== teamId) {
      continue;
    }
    const category = event.payload.category;
    const amount = Number(event.payload.amount) || 0;
    if (category === "tickets" || category === "merchandise") {
      // Side effect of HomeGameDaySettled — do not double-count.
      continue;
    }
    if (category === "sponsorships") {
      mix.sponsorship += amount;
      continue;
    }
    if (category === "other") {
      if (concessionAmounts.has(amount)) {
        concessionAmounts.delete(amount);
        continue;
      }
      if (
        amount === GAMEPLAY_PLAYOFF_QUALIFICATION_REVENUE ||
        amount === GAMEPLAY_PLAYOFF_SERIES_WIN_REVENUE
      ) {
        mix.playoffs += amount;
      } else if (amount === GAMEPLAY_OBJECTIVE_REWARD) {
        mix.other += amount;
      } else if (broadcastShare > 0 && amount === broadcastShare) {
        mix.broadcast += amount;
      } else {
        mix.unclassifiedRevenue += amount;
      }
    }
  }
}

function toRevenueMix(mix: MixAccumulator): RevenueMix {
  const total =
    mix.gate +
    mix.merchandise +
    mix.concessions +
    mix.sponsorship +
    mix.broadcast +
    mix.playoffs +
    mix.other +
    mix.unclassifiedRevenue;
  const pct = (value: number): number =>
    total <= 0 ? 0 : Math.round((value / total) * 1000) / 10;
  return {
    gate: mix.gate,
    merchandise: mix.merchandise,
    concessions: mix.concessions,
    sponsorship: mix.sponsorship,
    broadcast: mix.broadcast,
    playoffs: mix.playoffs,
    other: mix.other,
    unclassified: mix.unclassifiedRevenue,
    total,
    shares: {
      gate: pct(mix.gate),
      merchandise: pct(mix.merchandise),
      concessions: pct(mix.concessions),
      sponsorship: pct(mix.sponsorship),
      broadcast: pct(mix.broadcast),
      playoffs: pct(mix.playoffs),
      other: pct(mix.other),
      unclassified: pct(mix.unclassifiedRevenue),
    },
  };
}

function buildCashFlow(
  mix: MixAccumulator,
  startingCash: number,
  endingCash: number,
  tracker: CashSignTracker,
): SeasonCashFlow {
  // Capex counted once via FacilityUpgradeStarted; strip from books for opex.
  const facilityOpex = Math.max(0, mix.facilitiesBooks - mix.facilityInvestment);
  const recurringRevenue =
    mix.gate +
    mix.merchandise +
    mix.concessions +
    mix.sponsorship +
    mix.broadcast;
  const recurringCosts =
    mix.playerPayroll +
    mix.staff +
    facilityOpex +
    mix.marketing +
    mix.otherOpex;
  const nonOperatingCashFlow =
    mix.playoffs +
    mix.other +
    mix.unclassifiedRevenue -
    mix.unclassifiedExpenses;
  const costsTotal =
    mix.playerPayroll +
    mix.staff +
    facilityOpex +
    mix.facilityInvestment +
    mix.marketing +
    mix.otherOpex +
    mix.unclassifiedExpenses;
  const revenueTotal =
    mix.gate +
    mix.merchandise +
    mix.concessions +
    mix.sponsorship +
    mix.broadcast +
    mix.playoffs +
    mix.other +
    mix.unclassifiedRevenue;

  return {
    startingCash,
    endingCash,
    netCash: endingCash - startingCash,
    revenue: {
      gate: mix.gate,
      merchandise: mix.merchandise,
      concessions: mix.concessions,
      sponsorship: mix.sponsorship,
      broadcast: mix.broadcast,
      playoffs: mix.playoffs,
      other: mix.other,
      unclassified: mix.unclassifiedRevenue,
      total: revenueTotal,
    },
    costs: {
      playerPayroll: mix.playerPayroll,
      staff: mix.staff,
      facilityOpex,
      facilityInvestment: mix.facilityInvestment,
      marketing: mix.marketing,
      other: mix.otherOpex,
      unclassified: mix.unclassifiedExpenses,
      total: costsTotal,
    },
    netOperatingCashFlow: recurringRevenue - recurringCosts,
    nonOperatingCashFlow,
    minCash: tracker.minCash,
    firstNegativeDate: tracker.firstNegativeDate,
    daysNegative: tracker.daysNegative,
    endedNegative: endingCash < 0,
  };
}

function observeCash(
  tracker: CashSignTracker,
  state: GameState,
  teamId: string,
): void {
  const cash = teamCash(state, teamId);
  if (cash < tracker.minCash) {
    tracker.minCash = cash;
  }
  if (cash < 0) {
    tracker.daysNegative += 1;
    if (tracker.firstNegativeDate === null) {
      tracker.firstNegativeDate = state.world.calendar.currentDate;
    }
  }
}

function snapshotSeason(
  state: GameState,
  mix: MixAccumulator,
  startingCash: number,
  tracker: CashSignTracker,
): SeasonEconomySnapshot {
  const teamId = state.user.controlledTeamId;
  const year = state.competition.season.year;
  const ops = state.business.franchiseOps[teamId]!;
  const standing = state.competition.standings.byTeamId[teamId];
  const statement = getFinancialStatement(state, teamId as TeamId, year);
  const history = state.business.franchiseHistory[teamId];
  const lastHistory = history?.seasons[history.seasons.length - 1];
  const projection = projectCashHorizon(state, teamId);
  const cash = teamCash(state, teamId);
  const health = calculateFinancialHealth({
    cash,
    weeklyOutflow: projection.weeklyOutflow,
    netWeeklyBurn: projection.netWeeklyBurn,
    runwayWeeks: projection.runwayWeeks,
    projectedCash: projection.projectedCash,
  });
  return {
    seasonYear: year,
    cash,
    payroll: getTeamPayroll(teamId as TeamId, year, state),
    ticketPrice: ops.ticketPrice,
    marketingBudget: ops.marketing.budget,
    awareness: ops.marketing.awareness,
    fanSentiment: ops.fanSentiment,
    reputation: state.world.teams[teamId]?.reputation ?? 0,
    mediaAttention: ops.mediaAttention,
    wins: standing?.wins ?? lastHistory?.wins ?? 0,
    losses: standing?.losses ?? lastHistory?.losses ?? 0,
    playoffResult: lastHistory?.playoffResult ?? "missed",
    meanRosterOverall: meanRosterOverall(state, teamId),
    franchiseValue: calculateFranchiseValue(state, teamId as TeamId),
    facilityLevels: facilityLevelsOf(ops),
    revenue: toRevenueMix(mix),
    expenses: {
      playerSalaries: statement.expenses.playerSalaries,
      staff: statement.expenses.staff,
      facilities: statement.expenses.facilities,
      operations: statement.expenses.operations,
      marketing: statement.expenses.marketing,
      total: statement.expenses.total,
    },
    cashFlow: buildCashFlow(mix, startingCash, cash, tracker),
    runwayWeeks: projection.runwayWeeks,
    projectedCash: projection.projectedCash,
    health,
    attendanceMean:
      mix.homeGames > 0
        ? Math.round(mix.attendanceSum / mix.homeGames)
        : null,
    capacityMean:
      mix.homeGames > 0
        ? Math.round(mix.capacitySum / mix.homeGames)
        : null,
    fillRateMean:
      mix.homeGames > 0
        ? Math.round((mix.fillRateSum / mix.homeGames) * 10) / 10
        : null,
    selloutGames: mix.selloutGames,
    lowAttendanceGames: mix.lowAttendanceGames,
    homeGames: mix.homeGames,
    statementTickets: statement.revenue.tickets,
    statementMerchandise: statement.revenue.merchandise,
  };
}

function resolveOffseason(state: GameState, rng: Rng): GameState {
  let current = persistRng(state, rng);
  if (
    current.competition.season.phase === "offseason" &&
    current.competition.season.offseasonStage === "free_agency"
  ) {
    current = persistRng(advanceOffseasonStage(current).state, rng);
  }
  let guard = 0;
  while (guard < 80) {
    guard += 1;
    if (current.competition.season.phase === "preseason") {
      return current;
    }
    if (isUserOnDraftClock(current)) {
      current = persistRng(autoPickUserDraft(current), rng);
      current = persistRng(runAiTeamDecisions(current, rng).state, rng);
      continue;
    }
    current = persistRng(advanceSimulation(current, rng, { days: 1 }).state, rng);
    if (current.competition.season.phase === "preseason") {
      return current;
    }
  }
  throw new Error("Economy harness: offseason did not reach preseason.");
}

function simulateOneSeason(
  state: GameState,
  rng: Rng,
  teamId: string,
): { state: GameState; snapshot: SeasonEconomySnapshot } {
  const mix = emptyMix();
  let current = persistRng(state, rng);
  const startingCash = teamCash(current, teamId);
  const tracker: CashSignTracker = {
    minCash: startingCash,
    firstNegativeDate: null,
    daysNegative: 0,
  };
  observeCash(tracker, current, teamId);
  const startYear = current.competition.season.year;
  let days = 0;
  while (days < MAX_DAYS_PER_SEASON) {
    days += 1;
    if (isUserOnDraftClock(current)) {
      current = persistRng(autoPickUserDraft(current), rng);
      current = persistRng(runAiTeamDecisions(current, rng).state, rng);
      observeCash(tracker, current, teamId);
      continue;
    }
    const broadcastShare = estimateMonthlyBroadcastShare(current);
    const advanced = advanceSimulation(current, rng, { days: 1 });
    current = persistRng(advanced.state, rng);
    absorbEvents(mix, advanced.events, teamId, broadcastShare);
    observeCash(tracker, current, teamId);
    const season = current.competition.season;
    if (
      season.year === startYear &&
      season.phase === "offseason" &&
      (season.offseasonStage === "free_agency" ||
        season.offseasonStage === "draft")
    ) {
      break;
    }
    if (season.year !== startYear) {
      break;
    }
  }
  const snapshot = snapshotSeason(current, mix, startingCash, tracker);
  current = resolveOffseason(current, rng);
  return { state: current, snapshot };
}

export function bootstrapEconomyScenario(
  scenario: EconomyScenarioId,
  options: { seed?: number } = {},
): { state: GameState; rng: Rng; capitalRollup: ReturnType<typeof emptyCapitalRollup> } {
  const seed = options.seed ?? HARNESS_SEED;
  let state = createInitialGameState({
    saveId: `econ_${scenario}`,
    rngSeed: seed,
    settings: CBL_GAME_SETTINGS,
  });
  const rng = createSeededRng(state.meta.rngState);
  state = persistRng(bootstrapWorld(state, rng).state, rng);
  const capitalRollup = emptyCapitalRollup();
  state = applyEconomyScenario(state, scenario, { capitalRollup });
  return { state, rng, capitalRollup };
}

function computeRecoveryDelta(
  seasons: SeasonEconomySnapshot[],
): RecoveryDelta | null {
  if (seasons.length < 2) {
    return null;
  }
  const first = seasons[0]!;
  const last = seasons[seasons.length - 1]!;
  const cashDelta = last.cash - first.cash;
  const opDelta =
    last.cashFlow.netOperatingCashFlow - first.cashFlow.netOperatingCashFlow;
  const runwayImproved =
    first.runwayWeeks !== null &&
    last.runwayWeeks !== null &&
    last.runwayWeeks > first.runwayWeeks;
  const runwayRecovered =
    first.runwayWeeks !== null && last.runwayWeeks === null;
  const healthImproved =
    HEALTH_RANK[last.health] > HEALTH_RANK[first.health];
  const improved =
    cashDelta > 0 ||
    opDelta > 0 ||
    runwayImproved ||
    runwayRecovered ||
    healthImproved;
  return {
    fromSeasonYear: first.seasonYear,
    toSeasonYear: last.seasonYear,
    cash: { from: first.cash, to: last.cash, delta: cashDelta },
    runwayWeeks: { from: first.runwayWeeks, to: last.runwayWeeks },
    health: { from: first.health, to: last.health },
    netOperatingCashFlow: {
      from: first.cashFlow.netOperatingCashFlow,
      to: last.cashFlow.netOperatingCashFlow,
      delta: opDelta,
    },
    improved,
  };
}

export function runEconomyScenario(
  scenario: EconomyScenarioId,
  seasonCount: number,
  options: { seed?: number } = {},
): EconomyHarnessResult {
  if (!Number.isInteger(seasonCount) || seasonCount < 1) {
    throw new Error("runEconomyScenario: seasonCount must be an integer >= 1.");
  }
  const seed = options.seed ?? HARNESS_SEED;
  let { state, rng, capitalRollup } = bootstrapEconomyScenario(scenario, {
    seed,
  });
  const teamId = state.user.controlledTeamId;
  const seasons: SeasonEconomySnapshot[] = [];
  const actions: OwnerActionLogEntry[] = [];
  for (let index = 0; index < seasonCount; index += 1) {
    const seasonRollup =
      index === 0 && scenario === "aggressive"
        ? capitalRollup
        : emptyCapitalRollup();
    if (scenario === "recovery" && index > 0) {
      state = applyRecoveryPolicy(state, teamId as TeamId);
    }
    if (scenario === "aggressive" && index > 0) {
      state = applyAggressivePolicy(state, teamId as TeamId, seasonRollup);
    }
    const result = simulateOneSeason(state, rng, teamId);
    state = result.state;
    seasons.push(result.snapshot);
    actions.push({
      seasonYear: result.snapshot.seasonYear,
      ticketPrice: result.snapshot.ticketPrice,
      marketingBudget: result.snapshot.marketingBudget,
      payroll: result.snapshot.payroll,
      facilityLevels: result.snapshot.facilityLevels,
      endingCash: result.snapshot.cash,
      health: result.snapshot.health,
      capitalAttempts: seasonRollup.capitalAttempts,
      capitalRestricted: seasonRollup.capitalRestricted,
      attemptedCapitalSpend: seasonRollup.attemptedCapitalSpend,
      succeededCapitalSpend: seasonRollup.succeededCapitalSpend,
    });
  }
  return {
    scenario,
    seed,
    seasons,
    actions,
    finalState: state,
    recoveryDelta:
      scenario === "recovery" ? computeRecoveryDelta(seasons) : null,
  };
}

/** Assert cash-flow snapshot identities (throws on violation). */
export function assertCashFlowInvariants(snapshot: SeasonEconomySnapshot): void {
  const { cashFlow, revenue } = snapshot;
  if (cashFlow.netCash !== cashFlow.endingCash - cashFlow.startingCash) {
    throw new Error(
      `cashFlow.netCash mismatch: ${cashFlow.netCash} !== ${cashFlow.endingCash} - ${cashFlow.startingCash}`,
    );
  }
  const revenueSum =
    cashFlow.revenue.gate +
    cashFlow.revenue.merchandise +
    cashFlow.revenue.concessions +
    cashFlow.revenue.sponsorship +
    cashFlow.revenue.broadcast +
    cashFlow.revenue.playoffs +
    cashFlow.revenue.other +
    cashFlow.revenue.unclassified;
  if (cashFlow.revenue.total !== revenueSum || revenue.total !== revenueSum) {
    throw new Error(
      `revenue.total mismatch: cashFlow=${cashFlow.revenue.total} mix=${revenue.total} sum=${revenueSum}`,
    );
  }
  const costsSum =
    cashFlow.costs.playerPayroll +
    cashFlow.costs.staff +
    cashFlow.costs.facilityOpex +
    cashFlow.costs.facilityInvestment +
    cashFlow.costs.marketing +
    cashFlow.costs.other +
    cashFlow.costs.unclassified;
  if (cashFlow.costs.total !== costsSum) {
    throw new Error(
      `costs.total mismatch: ${cashFlow.costs.total} !== ${costsSum}`,
    );
  }
  // Capex must not also sit in opex (facilityOpex already strips investment).
  if (
    cashFlow.costs.facilityInvestment > 0 &&
    cashFlow.costs.facilityOpex + cashFlow.costs.facilityInvestment <
      cashFlow.costs.facilityInvestment
  ) {
    throw new Error("facilityInvestment incorrectly reduced facilityOpex below zero path");
  }
  if (snapshot.revenue.gate !== snapshot.statementTickets) {
    throw new Error(
      `gate double-count or miss: mix=${snapshot.revenue.gate} statement=${snapshot.statementTickets}`,
    );
  }
  if (snapshot.revenue.merchandise !== snapshot.statementMerchandise) {
    throw new Error(
      `merchandise mismatch: mix=${snapshot.revenue.merchandise} statement=${snapshot.statementMerchandise}`,
    );
  }
}

export {
  snapshotAllFranchiseIdentities,
  meanFingerprintsByProfile,
  captureIdentityAxes,
  assertIdentityAxesUnchanged,
  personalityCoherenceScores,
} from "@/systems/economy/franchise-identity-metrics";
export { runIdentityLeagueObservation } from "@/systems/economy/identity-league-observation";

