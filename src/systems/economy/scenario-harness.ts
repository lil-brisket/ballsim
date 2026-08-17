import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import type { DraftClass } from "@/domain/entities/draft";
import { draftClassIdFor } from "@/domain/entities/draft";
import {
  FACILITY_CATEGORIES,
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
  GAMEPLAY_OBJECTIVE_REWARD,
  GAMEPLAY_PLAYOFF_QUALIFICATION_REVENUE,
  GAMEPLAY_PLAYOFF_SERIES_WIN_REVENUE,
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
  total: number;
  shares: Record<keyof Omit<RevenueMix, "shares" | "total">, number>;
};

export type OwnerActionLogEntry = {
  seasonYear: number;
  ticketPrice: number;
  marketingBudget: number;
  payroll: number;
  facilityLevels: Record<FacilityCategory, number>;
  endingCash: number;
  health: FinancialHealthState;
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
  runwayWeeks: number | null;
  projectedCash: number;
  health: FinancialHealthState;
  attendanceMean: number | null;
  homeGames: number;
};

export type EconomyHarnessResult = {
  scenario: EconomyScenarioId;
  seasons: SeasonEconomySnapshot[];
  actions: OwnerActionLogEntry[];
  finalState: GameState;
};

const MAX_DAYS_PER_SEASON = 500;
const HARNESS_SEED = 77;

type MixAccumulator = {
  gate: number;
  merchandise: number;
  concessions: number;
  sponsorship: number;
  broadcast: number;
  playoffs: number;
  other: number;
  attendanceSum: number;
  homeGames: number;
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
    attendanceSum: 0,
    homeGames: 0,
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

function applyRecoveryPolicy(state: GameState, teamId: TeamId): GameState {
  let next = setMarketingBudget(state, teamId, 250_000).state;
  next = setTicketPrice(next, teamId, 45).state;
  return next;
}

export function applyEconomyScenario(
  state: GameState,
  scenario: EconomyScenarioId,
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
  let next = applyEconomyScenario(state, "distress");
  return applyRecoveryPolicy(next, teamId);
}

function pickBestProspect(state: GameState, draft: DraftClass): string | undefined {
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

function absorbEvents(
  mix: MixAccumulator,
  events: readonly DomainEvent[],
  teamId: string,
): void {
  for (const event of events) {
    if (event.type === "HomeGameDaySettled" && event.payload.teamId === teamId) {
      mix.gate += Number(event.payload.ticketRevenue) || 0;
      mix.merchandise += Number(event.payload.merchRevenue) || 0;
      mix.concessions += Number(event.payload.concessionsRevenue) || 0;
      mix.attendanceSum += Number(event.payload.attendance) || 0;
      mix.homeGames += 1;
      continue;
    }
    if (event.type !== "RevenueRecorded" || event.payload.teamId !== teamId) {
      continue;
    }
    const category = event.payload.category;
    const amount = Number(event.payload.amount) || 0;
    if (category === "tickets") {
      mix.gate += amount;
    } else if (category === "merchandise") {
      mix.merchandise += amount;
    } else if (category === "sponsorships") {
      mix.sponsorship += amount;
    } else if (category === "other") {
      if (
        amount === GAMEPLAY_PLAYOFF_QUALIFICATION_REVENUE ||
        amount === GAMEPLAY_PLAYOFF_SERIES_WIN_REVENUE
      ) {
        mix.playoffs += amount;
      } else if (amount === GAMEPLAY_OBJECTIVE_REWARD) {
        mix.other += amount;
      } else {
        mix.broadcast += amount;
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
    mix.other;
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
    total,
    shares: {
      gate: pct(mix.gate),
      merchandise: pct(mix.merchandise),
      concessions: pct(mix.concessions),
      sponsorship: pct(mix.sponsorship),
      broadcast: pct(mix.broadcast),
      playoffs: pct(mix.playoffs),
      other: pct(mix.other),
    },
  };
}

function snapshotSeason(
  state: GameState,
  mix: MixAccumulator,
): SeasonEconomySnapshot {
  const teamId = state.user.controlledTeamId;
  const year = state.competition.season.year;
  const ops = state.business.franchiseOps[teamId]!;
  const standing = state.competition.standings.byTeamId[teamId];
  const statement = getFinancialStatement(state, teamId as TeamId, year);
  const history = state.business.franchiseHistory[teamId];
  const lastHistory = history?.seasons[history.seasons.length - 1];
  const projection = projectCashHorizon(state, teamId);
  const cash = state.business.finances[teamId]?.cash ?? 0;
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
    runwayWeeks: projection.runwayWeeks,
    projectedCash: projection.projectedCash,
    health,
    attendanceMean:
      mix.homeGames > 0
        ? Math.round(mix.attendanceSum / mix.homeGames)
        : null,
    homeGames: mix.homeGames,
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
  const startYear = current.competition.season.year;
  let days = 0;
  while (days < MAX_DAYS_PER_SEASON) {
    days += 1;
    if (isUserOnDraftClock(current)) {
      current = persistRng(autoPickUserDraft(current), rng);
      current = persistRng(runAiTeamDecisions(current, rng).state, rng);
      continue;
    }
    const advanced = advanceSimulation(current, rng, { days: 1 });
    current = persistRng(advanced.state, rng);
    absorbEvents(mix, advanced.events, teamId);
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
  const snapshot = snapshotSeason(current, mix);
  current = resolveOffseason(current, rng);
  return { state: current, snapshot };
}

export function bootstrapEconomyScenario(
  scenario: EconomyScenarioId,
  options: { seed?: number } = {},
): { state: GameState; rng: Rng } {
  const seed = options.seed ?? HARNESS_SEED;
  let state = createInitialGameState({
    saveId: `econ_${scenario}`,
    rngSeed: seed,
    settings: CBL_GAME_SETTINGS,
  });
  const rng = createSeededRng(state.meta.rngState);
  state = persistRng(bootstrapWorld(state, rng).state, rng);
  state = applyEconomyScenario(state, scenario);
  return { state, rng };
}

export function runEconomyScenario(
  scenario: EconomyScenarioId,
  seasonCount: number,
  options: { seed?: number } = {},
): EconomyHarnessResult {
  if (!Number.isInteger(seasonCount) || seasonCount < 1) {
    throw new Error("runEconomyScenario: seasonCount must be an integer >= 1.");
  }
  let { state, rng } = bootstrapEconomyScenario(scenario, options);
  const teamId = state.user.controlledTeamId;
  const seasons: SeasonEconomySnapshot[] = [];
  const actions: OwnerActionLogEntry[] = [];
  for (let index = 0; index < seasonCount; index += 1) {
    if (scenario === "recovery" && index > 0) {
      state = applyRecoveryPolicy(state, teamId as TeamId);
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
    });
  }
  return { scenario, seasons, actions, finalState: state };
}
