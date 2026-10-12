/**
 * 10-year Owner Mode playtest on the Standard template
 * (30 teams / 82 games / 16 playoff teams). Small-market owner: invest in
 * facilities/tickets, GM for stars, and attempt relocation after year 4
 * through the same tenure/offseason gates the UI uses.
 *
 * Run: npx tsx scripts/_play_10_year_dynasty.ts
 */
import { config as loadEnv } from "dotenv";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";
import { DEFAULT_GAME_SETTINGS } from "@/domain/game-settings";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import { createSeededRng, type Rng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import { GAME_STATE_SCHEMA_VERSION, type GameState } from "@/state/game-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { applyOwnerCitySelection } from "@/systems/owner-city-selection";
import { applyOwnerFranchiseBranding } from "@/systems/owner-franchise-branding";
import { advanceSimulation } from "@/systems/simulation/advance-simulation";
import { advanceLeaguePhase } from "@/systems/simulation/offseason-lifecycle";
import { getActivePhaseId, previewAdvance } from "@/systems/phase-engine";
import { runAiTeamDecisions } from "@/systems/ai-team-decisions";
import { runTeamStaffAiManagement } from "@/systems/staff-ai-management";
import {
  recommendRosterManagement,
  withTeamRosterManagement,
} from "@/systems/roster-management";
import {
  completeDraft,
  draftYearForSeason,
  getActiveDraftOnClockSlot,
  isUserOnDraftClock,
  makeDraftSelection,
} from "@/systems/draft";
import { createDraft } from "@/systems/draft/draft-creation";
import {
  getDraftClassDecision,
  withDraftClassDecision,
} from "@/systems/custom-content/draft-class-decision";
import { draftClassIdFor } from "@/domain/entities/draft";
import { listFreeAgents, makeOffer, acceptOffer } from "@/systems/free-agency";
import { getTeamCapSpace } from "@/systems/salary-cap";
import { evaluateTradeOffer } from "@/systems/trades/trade-evaluation";
import { executeTrade } from "@/systems/trades/trade-execution";
import { validateTrade } from "@/systems/trades/trade-validation";
import type { TradeProposal } from "@/domain/entities/trade-proposal";
import { resolvePendingOwnerDecision } from "@/systems/owner-decisions";
import {
  declinePlayerOption,
  declineTeamOption,
  exercisePlayerOption,
  exerciseTeamOption,
  getContractStatus,
  isContractActive,
} from "@/domain/entities/contract";
import { assignPlayerToDevelopmentLeague } from "@/systems/development-league/assignment";
import { enforceMaxRosterViaDevelopmentLeague } from "@/systems/development-league/enforce-roster-cap";
import { fillShortRosters } from "@/systems/roster-generation";
import {
  derivePlannedRegularSeasonStartDate,
  enterOffseasonFromPostseason,
  needsRegularSeasonInitialization,
} from "@/systems/simulation/season-lifecycle";
import { toLeagueHistoryView } from "@/state/league-history-selectors";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";
import { projectSaveEntities } from "@/persistence/mappers/save-projection-mapper";
import { collectLeagueInvariantIssues } from "@/systems/league-rules/lifecycle-invariants";
import { validateTeamRosterIntegrity } from "@/systems/roster-integrity";
import { TRADE_ROSTER_RULES } from "@/systems/trades-config";
import type { DraftPickId, PlayerId, TeamId } from "@/domain/ids";
import { asContractId, asOfferId } from "@/domain/ids";
import type { ContractInput } from "@/domain/entities/contract";
import type { Player } from "@/domain/entities/player";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { assessRelocation } from "@/state/relocation-assessment";
import { isRelocationAccessible } from "@/state/owner-season-context";
import { advanceRelocationStage } from "@/systems/relocation";
import { setTicketPrice } from "@/systems/ticket-pricing";
import { setMarketingBudget } from "@/systems/marketing";
import { startFacilityUpgrade } from "@/systems/facilities";
import {
  FACILITY_CATEGORIES,
  FACILITY_LEVEL_MAX,
  type FacilityCategory,
} from "@/domain/entities/franchise-ops";
import { calculateCashRunway } from "@/state/franchise-selectors";
import { readAttendanceRealization } from "@/state/franchise-value";

loadEnv();
loadEnv({ path: ".env.local" });

const TARGET_SEASONS = 10;
const SAVE_NAME = "10Y Owner Stress Test";
const LOAD_SAVE_ID = "543043c6-7b4b-409c-a959-89ea89ced83b";
const NICKNAME = "Bisons";
const LOGO_ID = "eagle";
const PALETTE_ID = "midnight_navy";
const SMALL_MARKET_MAX = 47;
const RELOCATE_AFTER_COMPLETED_SEASONS = 4;
const MAX_STAR_TRADES_PER_WINDOW = 4;
const STAR_OVERALL = 82;
const KEEP_OVERALL = 76;

type SeasonLog = {
  year: number;
  phaseAtEnd: string;
  wins: number;
  losses: number;
  playoffResult: string | null;
  championship: boolean;
  trades: string[];
  signings: string[];
  draftPicks: string[];
  incomingOffersAccepted: number;
  incomingOffersDeclined: number;
  topPlayers: string[];
  notes: string[];
  city: string;
  marketSize: number;
  cash: number;
  fanSentiment: number;
  attendanceRealization: number;
  relocationStatus: string;
  relocationStage: string;
};

type RelocationAttemptLog = {
  year: number;
  date: string;
  phase: string;
  status: string;
  canStart: boolean;
  accessible: boolean;
  tenureSeasons: number;
  minTenure: number;
  stageBefore: string;
  stageAfter: string;
  target: string | null;
  outcome: string;
};

type PlayLog = {
  saveId: string;
  settings: {
    preset: "standard" | "custom";
    teamCount: number;
    gamesPerTeam: number;
    playoffTeams: number;
    seriesLength: number;
    injuryFrequency: string;
    salaryCap: number;
    luxuryTaxEnabled: boolean;
    city: string;
    nickname: string;
    marketSize: number;
  };
  seasons: SeasonLog[];
  relocationAttempts: RelocationAttemptLog[];
  issues: string[];
  opportunities: string[];
};

const SIM_ADVANCE = {
  gameFidelity: "box_score" as const,
  stopOnPhaseChange: true,
};

function persistRng(state: GameState, rng: Rng): GameState {
  return {
    ...state,
    meta: { ...state.meta, rngState: rng.getState() },
  };
}

function reviewSaveBalance(
  state: GameState,
  play: PlayLog,
  history: ReturnType<typeof toLeagueHistoryView>,
): {
  lines: string[];
  flags: string[];
  overall: {
    min: number;
    p50: number;
    p90: number;
    max: number;
    stars90: number;
  };
  scoring: { maxPpg: number; p90Ppg: number; games82Plus30Ppg: number };
  userPayrollVsOverall: string[];
} {
  const lines: string[] = [];
  const flags: string[] = [];
  const overalls = Object.values(state.world.players).map((player) =>
    calculatePlayerOverall(player.position, player.attributes),
  );
  overalls.sort((a, b) => a - b);
  const pct = (arr: number[], p: number): number => {
    if (arr.length === 0) return 0;
    const index = Math.min(arr.length - 1, Math.floor((arr.length - 1) * p));
    return arr[index] ?? 0;
  };
  const stars90 = overalls.filter((value) => value >= 90).length;
  const overall = {
    min: overalls[0] ?? 0,
    p50: pct(overalls, 0.5),
    p90: pct(overalls, 0.9),
    max: overalls[overalls.length - 1] ?? 0,
    stars90,
  };
  lines.push(
    `Overall n=${overalls.length} min=${overall.min} p50=${overall.p50} p90=${overall.p90} max=${overall.max} 90+=${stars90}`,
  );
  if (stars90 > 40) {
    flags.push(
      `Too many 90+ players league-wide (${stars90}). Superstar inflation.`,
    );
  }
  if (overall.max >= 98) {
    flags.push(`Peak overall ${overall.max} is extremely high.`);
  }

  const ppg: number[] = [];
  for (const historyRow of Object.values(state.business.playerHistory)) {
    for (const season of historyRow.seasons) {
      const games = season.competition.regular.games;
      if (games >= 20) {
        ppg.push(season.competition.regular.points / games);
      }
    }
  }
  ppg.sort((a, b) => a - b);
  const scoring = {
    maxPpg: ppg[ppg.length - 1] ?? 0,
    p90Ppg: pct(ppg, 0.9),
    games82Plus30Ppg: ppg.filter((value) => value >= 30).length,
  };
  lines.push(
    `Scoring (20+ GP seasons) n=${ppg.length} p90=${scoring.p90Ppg.toFixed(1)} max=${scoring.maxPpg.toFixed(1)} 30+ppg seasons=${scoring.games82Plus30Ppg}`,
  );
  if (scoring.maxPpg > 38) {
    flags.push(`Scoring too high: peak ${scoring.maxPpg.toFixed(1)} PPG.`);
  }
  if (scoring.maxPpg > 0 && scoring.maxPpg < 22) {
    flags.push(`Scoring too low: peak ${scoring.maxPpg.toFixed(1)} PPG.`);
  }

  const teamId = state.user.activeOwnerTeamId;
  const userPayrollVsOverall: string[] = [];
  for (const playerId of rankedRoster(state, teamId).slice(0, 10)) {
    const player = state.world.players[playerId];
    if (!player) continue;
    const contract = Object.values(state.business.contracts).find(
      (row) =>
        row.playerId === playerId &&
        isContractActive(row, state.competition.season.year),
    );
    const ovr = overallOf(state, playerId);
    const salary =
      contract?.salaryByYear[String(state.competition.season.year)] ?? 0;
    const row = `${player.firstName} ${player.lastName} ovr ${ovr} age ${player.age} $${Math.round(salary / 1_000_000)}M`;
    userPayrollVsOverall.push(row);
  }
  lines.push(`User top 10: ${userPayrollVsOverall.join(" | ")}`);
  const cheapStars = userPayrollVsOverall.filter((row) => {
    const ovrMatch = /ovr (\d+)/.exec(row);
    const salMatch = /\$(\d+)M/.exec(row);
    const ovr = ovrMatch ? Number(ovrMatch[1]) : 0;
    const sal = salMatch ? Number(salMatch[1]) : 99;
    return ovr >= 88 && sal <= 8;
  });
  if (cheapStars.length >= 2) {
    flags.push(
      `Stars are too cheap: ${cheapStars.length} players 88+ at $8M or less.`,
    );
  }

  const records = play.seasons
    .filter((season) => season.wins + season.losses >= 40)
    .map((season) => ({
      year: season.year,
      wins: season.wins,
      losses: season.losses,
    }));
  for (const row of records) {
    lines.push(`Record ${row.year}: ${row.wins}-${row.losses}`);
    if (row.wins >= 70) {
      flags.push(`${row.year} record ${row.wins}-${row.losses} is too easy.`);
    }
  }
  const titles = history.seasons.filter(
    (row) => row.championTeamId === teamId,
  ).length;
  lines.push(`Titles ${titles}/${history.seasons.length}`);
  const relocations = play.relocationAttempts.map((row) => row.outcome);
  lines.push(`Relocation attempts: ${relocations.length}`);
  return { lines, flags, overall, scoring, userPayrollVsOverall };
}

function emptySeasonLog(year: number, state?: GameState): SeasonLog {
  const teamId = state?.user.activeOwnerTeamId;
  const team = teamId ? state?.world.teams[teamId] : undefined;
  const ops = teamId ? state?.business.franchiseOps[teamId] : undefined;
  const process = teamId
    ? state?.business.relocationByTeamId[teamId]
    : undefined;
  return {
    year,
    phaseAtEnd: "",
    wins: 0,
    losses: 0,
    playoffResult: null,
    championship: false,
    trades: [],
    signings: [],
    draftPicks: [],
    incomingOffersAccepted: 0,
    incomingOffersDeclined: 0,
    topPlayers: [],
    notes: [],
    city: team ? `${team.city} ${team.name}` : "",
    marketSize: ops?.marketSize ?? 0,
    cash: teamId ? (state?.business.finances[teamId]?.businessFunds ?? 0) : 0,
    fanSentiment: ops?.fanSentiment ?? 0,
    attendanceRealization:
      state && teamId ? readAttendanceRealization(state, teamId) : 0,
    relocationStatus: "",
    relocationStage: process?.stage ?? "none",
  };
}

function ownerSnapshot(state: GameState): {
  city: string;
  marketSize: number;
  cash: number;
  fanSentiment: number;
  attendanceRealization: number;
  relocationStatus: string;
  relocationStage: string;
} {
  const teamId = state.user.activeOwnerTeamId;
  const team = state.world.teams[teamId];
  const ops = state.business.franchiseOps[teamId];
  const process = state.business.relocationByTeamId[teamId];
  const assessment = assessRelocation(state, teamId);
  return {
    city: team ? `${team.city} ${team.name}` : teamId,
    marketSize: ops?.marketSize ?? 0,
    cash: state.business.finances[teamId]?.businessFunds ?? 0,
    fanSentiment: ops?.fanSentiment ?? 0,
    attendanceRealization: readAttendanceRealization(state, teamId),
    relocationStatus: assessment.status,
    relocationStage: process?.stage ?? "none",
  };
}

function applyOwnerSnapshot(state: GameState, log: SeasonLog): void {
  const snap = ownerSnapshot(state);
  log.city = snap.city;
  log.marketSize = snap.marketSize;
  log.cash = snap.cash;
  log.fanSentiment = snap.fanSentiment;
  log.attendanceRealization = snap.attendanceRealization;
  log.relocationStatus = snap.relocationStatus;
  log.relocationStage = snap.relocationStage;
}

function completedSeasonCount(play: PlayLog): number {
  return play.seasons.filter((season) => season.wins + season.losses > 0)
    .length;
}

function runOwnerOps(state: GameState, log: SeasonLog): GameState {
  let current = state;
  const teamId = current.user.activeOwnerTeamId;
  const ops = current.business.franchiseOps[teamId];
  if (!ops) return current;
  const runway = calculateCashRunway(current, teamId);
  const realization = readAttendanceRealization(current, teamId);

  if (realization < 0.7 && ops.ticketPrice > 35) {
    const nextPrice = Math.max(28, ops.ticketPrice - 5);
    try {
      current = setTicketPrice(current, teamId, nextPrice).state;
      noteOnce(log, `Cut tickets to $${nextPrice} (soft attendance).`);
    } catch (error) {
      noteOnce(
        log,
        `Ticket cut failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  } else if (
    realization >= 0.9 &&
    runway.health === "healthy" &&
    ops.ticketPrice < 70
  ) {
    const nextPrice = ops.ticketPrice + 4;
    try {
      current = setTicketPrice(current, teamId, nextPrice).state;
      noteOnce(log, `Raised tickets to $${nextPrice}.`);
    } catch (error) {
      noteOnce(
        log,
        `Ticket raise failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const liveMarketing = current.business.franchiseOps[teamId];
  if (
    liveMarketing &&
    liveMarketing.marketing.awareness < 50 &&
    runway.cash > 8_000_000
  ) {
    const nextBudget = Math.min(
      6_000_000,
      Math.max(liveMarketing.marketing.budget, 3_500_000),
    );
    if (nextBudget > liveMarketing.marketing.budget) {
      try {
        current = setMarketingBudget(current, teamId, nextBudget).state;
        noteOnce(
          log,
          `Raised marketing budget to $${Math.round(nextBudget / 1_000_000)}M.`,
        );
      } catch (error) {
        noteOnce(
          log,
          `Marketing bump failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  const liveOps = current.business.franchiseOps[teamId];
  if (liveOps && runway.health === "healthy" && runway.cash > 12_000_000) {
    const upgradeOrder: FacilityCategory[] = [
      "practice",
      "training",
      "medical",
      "fan",
      "youth",
      "arena",
    ];
    for (const category of upgradeOrder) {
      if (!FACILITY_CATEGORIES.includes(category)) continue;
      const facility = liveOps.facilities[category];
      if (
        facility.level >= FACILITY_LEVEL_MAX ||
        facility.upgradeWeeksRemaining > 0
      ) {
        continue;
      }
      try {
        current = startFacilityUpgrade(current, teamId, category).state;
        noteOnce(
          log,
          `Started ${category} facility upgrade from L${facility.level}.`,
        );
      } catch (error) {
        noteOnce(
          log,
          `${category} upgrade skipped: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      break;
    }
  }
  return current;
}

function tryRelocation(
  state: GameState,
  log: SeasonLog,
  play: PlayLog,
): GameState {
  const teamId = state.user.activeOwnerTeamId;
  const process = state.business.relocationByTeamId[teamId];
  const stageBefore = process?.stage ?? "none";
  const inProgress =
    stageBefore !== "none" &&
    stageBefore !== "complete" &&
    stageBefore !== "rejected";
  const seasonsDone = completedSeasonCount(play);
  if (!inProgress && seasonsDone < RELOCATE_AFTER_COMPLETED_SEASONS) {
    return state;
  }

  const assessment = assessRelocation(state, teamId);
  const accessible = isRelocationAccessible(state, teamId);
  const dest =
    assessment.destinationOpportunity.find((row) => row.credibleImprovement) ??
    assessment.destinationOpportunity[0];
  const target = dest
    ? {
        city: dest.city,
        name: dest.name,
        abbreviation: dest.abbreviation,
        marketSize: dest.marketSize,
      }
    : (process?.target ?? undefined);

  const record = (current: GameState, outcome: string): void => {
    const after = current.business.relocationByTeamId[teamId];
    play.relocationAttempts.push({
      year: current.competition.season.year,
      date: current.world.calendar.currentDate,
      phase: `${current.competition.season.phase}/${getActivePhaseId(current)}`,
      status: assessRelocation(current, teamId).status,
      canStart: assessment.canStart,
      accessible,
      tenureSeasons: assessment.tenure.seasonsInCurrentCity,
      minTenure: assessment.tenure.minSeasonsInCity,
      stageBefore,
      stageAfter: after?.stage ?? "none",
      target: target
        ? `${target.city} ${target.name} (${target.marketSize})`
        : null,
      outcome,
    });
    noteOnce(log, `Relocation: ${outcome}`);
  };

  if (!inProgress && !accessible) {
    const outcome = `Blocked after ${seasonsDone} seasons: status=${assessment.status} tenure=${assessment.tenure.seasonsInCurrentCity}/${assessment.tenure.minSeasonsInCity} offseason=${state.competition.season.phase === "offseason"} constraints=${assessment.constraints.join(" | ") || "none"}`;
    const last = play.relocationAttempts[play.relocationAttempts.length - 1];
    if (
      last &&
      last.year === state.competition.season.year &&
      last.outcome === outcome
    ) {
      return state;
    }
    record(state, outcome);
    return state;
  }

  let current = state;
  const maxAdvances = 8;
  for (let step = 0; step < maxAdvances; step += 1) {
    const live = current.business.relocationByTeamId[teamId];
    const stage = live?.stage ?? "none";
    if (stage === "complete") {
      break;
    }
    if (stage === "rejected") {
      record(current, "Rejected by league review or occupied city.");
      break;
    }
    try {
      const advanced = advanceRelocationStage(current, teamId, target);
      current = advanced.state;
      const nextStage = current.business.relocationByTeamId[teamId]?.stage;
      const team = current.world.teams[teamId];
      record(
        current,
        `Advanced ${stage} → ${nextStage}${
          nextStage === "complete" && team
            ? ` now ${team.city} ${team.name}`
            : ""
        }`,
      );
      if (nextStage === "complete" || nextStage === "rejected") {
        break;
      }
    } catch (error) {
      record(
        current,
        `Advance failed from ${stage}: ${error instanceof Error ? error.message : String(error)}`,
      );
      break;
    }
  }
  return current;
}

function overallOf(state: GameState, playerId: PlayerId): number {
  const player = state.world.players[playerId];
  if (!player) return 0;
  return calculatePlayerOverall(player.position, player.attributes);
}

function prospectOverall(prospect: { player: Player }): number {
  return calculatePlayerOverall(
    prospect.player.position,
    prospect.player.attributes,
  );
}

function playerLabel(state: GameState, playerId: PlayerId): string {
  const player = state.world.players[playerId];
  if (!player) return playerId;
  return `${player.firstName} ${player.lastName} (${overallOf(state, playerId)} ${player.position})`;
}

function teamLabel(state: GameState, teamId: TeamId): string {
  const team = state.world.teams[teamId];
  return team ? `${team.city} ${team.name}` : teamId;
}

function ownedPicks(state: GameState, teamId: TeamId): DraftPickId[] {
  return (
    Object.values(state.world.draftPicks) as {
      id: DraftPickId;
      ownerTeamId: TeamId;
      status: string;
    }[]
  )
    .filter(
      (pick) => pick.ownerTeamId === teamId && pick.status === "available",
    )
    .map((pick) => pick.id)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function rosterPlayers(state: GameState, teamId: TeamId): PlayerId[] {
  return [...(state.world.teams[teamId]?.roster ?? [])];
}

function rankedRoster(state: GameState, teamId: TeamId): PlayerId[] {
  return rosterPlayers(state, teamId).sort(
    (a, b) => overallOf(state, b) - overallOf(state, a),
  );
}

function topEightOverall(state: GameState, teamId: TeamId): number {
  return rankedRoster(state, teamId)
    .slice(0, 8)
    .reduce((sum, id) => sum + overallOf(state, id), 0);
}

function faSalaryForOverall(overall: number, capSpace: number): number {
  let ask = 2_000_000;
  if (overall >= 90) ask = 28_000_000;
  else if (overall >= 86) ask = 22_000_000;
  else if (overall >= 82) ask = 16_000_000;
  else if (overall >= 78) ask = 10_000_000;
  else if (overall >= 74) ask = 6_000_000;
  else if (overall >= 70) ask = 3_500_000;
  const yearsFloor = Math.max(1_250_000, Math.floor(capSpace * 0.85));
  return Math.min(ask, yearsFloor);
}

function faYearsForOverall(overall: number): number {
  if (overall >= 84) return 4;
  if (overall >= 78) return 3;
  return 2;
}

function shouldKeepPlayer(state: GameState, playerId: PlayerId): boolean {
  const player = state.world.players[playerId];
  if (!player) return false;
  const ovr = overallOf(state, playerId);
  if (ovr >= KEEP_OVERALL && player.age <= 34) return true;
  if (ovr >= 80) return true;
  return false;
}

function resolveContractOptions(state: GameState, log: SeasonLog): GameState {
  const year = state.competition.season.year;
  const teamId = state.user.activeOwnerTeamId;
  let contracts = state.business.contracts;
  let changed = false;
  for (const [contractId, contract] of Object.entries(contracts)) {
    if (contract.teamId !== teamId) continue;
    const status = getContractStatus(contract, year);
    let next = contract;
    if (status === "team_option") {
      next = shouldKeepPlayer(state, contract.playerId)
        ? exerciseTeamOption(contract)
        : declineTeamOption(contract);
      log.notes.push(
        `${shouldKeepPlayer(state, contract.playerId) ? "Exercised" : "Declined"} team option: ${playerLabel(state, contract.playerId)}`,
      );
    } else if (status === "player_option") {
      next = shouldKeepPlayer(state, contract.playerId)
        ? exercisePlayerOption(contract)
        : declinePlayerOption(contract);
      log.notes.push(
        `${shouldKeepPlayer(state, contract.playerId) ? "Kept" : "Let walk on"} player option: ${playerLabel(state, contract.playerId)}`,
      );
    }
    if (next !== contract) {
      contracts = { ...contracts, [contractId]: next };
      changed = true;
    }
  }
  if (!changed) return state;
  return {
    ...state,
    business: { ...state.business, contracts },
  };
}

function resolveIncomingOffers(state: GameState, log: SeasonLog): GameState {
  let current = state;
  const teamId = current.user.activeOwnerTeamId;
  const pending = [...current.user.pendingOwnerDecisions];
  for (const decision of pending) {
    if (decision.type !== "trade_offer") continue;
    const proposal =
      decision.payload.currentProposal ?? decision.payload.proposal;
    const ourSide =
      proposal.sideA.teamId === teamId ? proposal.sideA : proposal.sideB;
    const theirSide =
      proposal.sideA.teamId === teamId ? proposal.sideB : proposal.sideA;
    const outgoingOvr = ourSide.playerIds.reduce(
      (sum, id) => sum + overallOf(current, id),
      0,
    );
    const incomingOvr = theirSide.playerIds.reduce(
      (sum, id) => sum + overallOf(current, id),
      0,
    );
    const incomingStar = theirSide.playerIds.some(
      (id) => overallOf(current, id) >= STAR_OVERALL,
    );
    const sendingCore = ourSide.playerIds.some((id) =>
      shouldKeepPlayer(current, id),
    );
    const accept =
      (incomingOvr > outgoingOvr + 4 || incomingStar) && !sendingCore;
    const resolved = resolvePendingOwnerDecision(current, {
      decisionId: decision.id,
      status: accept ? "accepted" : "declined",
      decisionSource: "owner",
    });
    current = resolved.state;
    if (accept) {
      log.incomingOffersAccepted += 1;
      log.trades.push(
        `Accepted incoming: ${theirSide.playerIds.map((id) => playerLabel(current, id)).join(", ") || "picks"} for ${ourSide.playerIds.map((id) => playerLabel(current, id)).join(", ") || "picks"}`,
      );
    } else {
      log.incomingOffersDeclined += 1;
    }
  }
  return current;
}

function makePackages(
  picks: DraftPickId[],
  chips: PlayerId[],
): Array<{ playerIds: PlayerId[]; draftPickIds: DraftPickId[] }> {
  const firsts = picks.filter((id) => id.includes("_r1"));
  const seconds = picks.filter((id) => id.includes("_r2"));
  const packages: Array<{
    playerIds: PlayerId[];
    draftPickIds: DraftPickId[];
  }> = [];
  if (seconds[0]) packages.push({ playerIds: [], draftPickIds: [seconds[0]] });
  if (firsts[0]) packages.push({ playerIds: [], draftPickIds: [firsts[0]] });
  if (firsts[0] && seconds[0]) {
    packages.push({ playerIds: [], draftPickIds: [firsts[0], seconds[0]] });
  }
  if (firsts.length >= 2) {
    packages.push({ playerIds: [], draftPickIds: [firsts[0]!, firsts[1]!] });
  }
  if (chips[0] && firsts[0]) {
    packages.push({
      playerIds: [chips[0]],
      draftPickIds: [firsts[0]],
    });
  }
  if (chips[0] && firsts.length >= 2) {
    packages.push({
      playerIds: [chips[0]],
      draftPickIds: [firsts[0]!, firsts[1]!],
    });
  }
  if (chips[0] && chips[1] && firsts[0]) {
    packages.push({
      playerIds: [chips[0], chips[1]],
      draftPickIds: [firsts[0]],
    });
  }
  return packages;
}

function huntStars(state: GameState, log: SeasonLog): GameState {
  let current = state;
  const teamId = current.user.activeOwnerTeamId;
  let tradesLanded = 0;
  const stars = (
    Object.values(
      current.world.players,
    ) as GameState["world"]["players"][PlayerId][]
  )
    .filter((player) => {
      if (!player || player.retired || player.teamId == null) return false;
      if (player.teamId === teamId) return false;
      if (player.age > 33) return false;
      return overallOf(current, player.id) >= STAR_OVERALL;
    })
    .sort((a, b) => overallOf(current, b.id) - overallOf(current, a.id));

  for (const star of stars) {
    if (tradesLanded >= MAX_STAR_TRADES_PER_WINDOW) break;
    if (star.teamId == null) continue;
    if (current.world.teams[teamId]?.roster.includes(star.id)) continue;
    const picks = ownedPicks(current, teamId);
    const chips = rankedRoster(current, teamId)
      .filter((id) => !shouldKeepPlayer(current, id))
      .slice(-6);
    const packages = makePackages(picks, chips);
    let landed = false;
    for (const pack of packages) {
      const proposal: TradeProposal = {
        sideA: {
          teamId,
          playerIds: pack.playerIds,
          draftPickIds: pack.draftPickIds,
        },
        sideB: {
          teamId: star.teamId,
          playerIds: [star.id],
          draftPickIds: [],
        },
      };
      if (!validateTrade(current, proposal).valid) continue;
      const evaluation = evaluateTradeOffer(current, star.teamId, proposal);
      if (!evaluation.accepted) continue;
      const executed = executeTrade(current, proposal);
      if (!executed.success) continue;
      current = executed.state;
      tradesLanded += 1;
      landed = true;
      log.trades.push(
        `Acquired ${playerLabel(current, star.id)} from ${teamLabel(current, star.teamId)} for ${[
          ...pack.playerIds.map((id) => playerLabel(current, id)),
          ...pack.draftPickIds,
        ].join(", ")}`,
      );
      break;
    }
    if (!landed) {
      // keep hunting cheaper stars
    }
  }
  return current;
}

function noteOnce(log: SeasonLog, message: string): void {
  if (!log.notes.includes(message)) {
    log.notes.push(message);
  }
}

function dumpToCap(state: GameState, maxRoster = 15): GameState {
  const teamId = state.user.activeOwnerTeamId;
  const roster = rankedRoster(state, teamId);
  if (roster.length <= maxRoster) return state;
  let current = state;
  for (const playerId of roster.slice(maxRoster)) {
    const assigned = assignPlayerToDevelopmentLeague(current, playerId, teamId);
    if (assigned.success) {
      current = assigned.state;
    }
  }
  return current;
}

function makeRosterSpot(state: GameState): GameState {
  const teamId = state.user.activeOwnerTeamId;
  const rosterSize = state.world.teams[teamId]?.roster.length ?? 0;
  if (rosterSize < 15) return state;
  const fringe = [...rankedRoster(state, teamId)]
    .reverse()
    .find((id) => !shouldKeepPlayer(state, id));
  if (!fringe) return dumpToCap(state, 14);
  const assigned = assignPlayerToDevelopmentLeague(state, fringe, teamId);
  return assigned.success ? assigned.state : dumpToCap(state, 14);
}

function signFreeAgents(state: GameState, log: SeasonLog): GameState {
  let current = dumpToCap(state);
  const teamId = current.user.activeOwnerTeamId;
  const year = current.competition.season.year;
  const pool = listFreeAgents(current).playerIds;
  const ranked = [...pool].sort(
    (a, b) => overallOf(current, b) - overallOf(current, a),
  );
  const capAtStart = getTeamCapSpace(teamId, year, current);
  if (ranked.length === 0) {
    noteOnce(log, "FA window: pool was empty.");
    return current;
  }
  if (capAtStart < 1_250_000) {
    noteOnce(
      log,
      `FA window: cap space $${Math.round(capAtStart / 1_000_000)}M blocked signings.`,
    );
  }
  let signed = 0;
  let attempts = 0;
  for (const playerId of ranked) {
    if (signed >= 4) break;
    if (attempts >= 12) break;
    const ovr = overallOf(current, playerId);
    if (ovr < 68) break;
    attempts += 1;
    if ((current.world.teams[teamId]?.roster.length ?? 0) >= 15) {
      current = makeRosterSpot(current);
    }
    if ((current.world.teams[teamId]?.roster.length ?? 0) >= 15) {
      noteOnce(log, "FA window: could not open a roster spot.");
      break;
    }
    const capSpace = getTeamCapSpace(teamId, year, current);
    if (capSpace < 1_250_000) {
      noteOnce(
        log,
        `FA window: cap space $${Math.round(capSpace / 1_000_000)}M blocked signings.`,
      );
      break;
    }
    const salary = faSalaryForOverall(ovr, capSpace);
    const years = faYearsForOverall(ovr);
    const endYear = year + years - 1;
    const salaryByYear: Record<string, number> = {};
    for (let y = year; y <= endYear; y += 1) {
      salaryByYear[String(y)] = salary;
    }
    const offerId = asOfferId(
      `offer_dynasty_${teamId}_${playerId}_${current.world.calendar.currentDate}_${signed}`,
    );
    const terms: ContractInput = {
      id: asContractId(`contract_dynasty_${playerId}_${year}_${signed}`),
      playerId,
      teamId,
      startYear: year,
      endYear,
      salaryByYear,
    };
    try {
      const offered = makeOffer(current, {
        id: offerId,
        playerId,
        teamId,
        terms,
      });
      const accepted = acceptOffer(offered.state, offerId);
      const offer = accepted.state.business.freeAgency.offers[offerId];
      const joined = accepted.state.world.players[playerId]?.teamId === teamId;
      if (offer?.status === "accepted" && joined) {
        current = accepted.state;
        signed += 1;
        log.signings.push(
          `${playerLabel(current, playerId)} — $${Math.round(salary / 1_000_000)}M × ${years}`,
        );
      } else {
        noteOnce(
          log,
          `FA miss ${playerLabel(current, playerId)}: ${offer?.status ?? "no offer"}`,
        );
      }
    } catch (error) {
      noteOnce(
        log,
        `FA miss ${playerLabel(current, playerId)}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  return current;
}

function pickOnClock(state: GameState, log: SeasonLog): GameState {
  const slot = getActiveDraftOnClockSlot(state);
  if (!slot) return state;
  const draftYear = draftYearForSeason(state.competition.season.year);
  const draftClassId = draftClassIdFor(draftYear);
  const draft = state.world.drafts[draftClassId];
  if (!draft || draft.status !== "active") return state;
  const eligible = Object.values(draft.prospects).filter(
    (prospect) =>
      prospect.status === "eligible" &&
      state.world.players[prospect.playerId] === undefined,
  );
  if (eligible.length === 0) return state;
  const best = eligible
    .map((prospect) => ({
      prospect,
      ovr: prospectOverall(prospect),
      pot: prospect.player.potential.overall,
    }))
    .sort((a, b) => b.ovr + b.pot * 0.25 - (a.ovr + a.pot * 0.25))[0];
  if (!best) return state;
  const result = makeDraftSelection(state, {
    draftClassId,
    draftPickId: slot.draftPickId,
    prospectPlayerId: best.prospect.playerId,
    teamId: slot.ownerTeamId,
  });
  if (!result.success) return state;
  if (slot.ownerTeamId === state.user.activeOwnerTeamId) {
    log.draftPicks.push(
      `#${slot.overallPick} ${playerLabel(result.state, best.prospect.playerId)} pot ${best.pot}`,
    );
  }
  return result.state;
}

function pickBestProspect(state: GameState, log: SeasonLog): GameState {
  if (!isUserOnDraftClock(state)) return state;
  return pickOnClock(state, log);
}

function drainDraft(state: GameState, rng: Rng, log: SeasonLog): GameState {
  let current = persistRng(state, rng);
  if (getActivePhaseId(current) !== "offseason.draft") return current;
  for (let step = 0; step < 200; step += 1) {
    const slot = getActiveDraftOnClockSlot(current);
    if (!slot) break;
    if (isUserOnDraftClock(current)) {
      const before = current;
      current = persistRng(pickBestProspect(current, log), rng);
      if (current === before) {
        noteOnce(log, `Draft clock stuck at pick #${slot.overallPick}.`);
        break;
      }
      continue;
    }
    current = persistRng(runAiTeamDecisions(current, rng).state, rng);
    if (getActiveDraftOnClockSlot(current)?.draftPickId !== slot.draftPickId) {
      continue;
    }
    current = persistRng(pickOnClock(current, log), rng);
    if (getActiveDraftOnClockSlot(current)?.draftPickId === slot.draftPickId) {
      noteOnce(log, `AI draft stall at pick #${slot.overallPick}.`);
      break;
    }
  }
  const draftYear = draftYearForSeason(current.competition.season.year);
  const draftClassId = draftClassIdFor(draftYear);
  const draft = current.world.drafts[draftClassId];
  if (
    draft?.status === "active" &&
    draft.order.length > 0 &&
    draft.order.every((entry) => entry.status === "used")
  ) {
    current = persistRng(completeDraft(current, draftClassId).state, rng);
  }
  return persistRng(current, rng);
}

function setRotations(state: GameState): GameState {
  const teamId = state.user.activeOwnerTeamId;
  if (!state.world.teams[teamId]) return state;
  return withTeamRosterManagement(
    state,
    teamId,
    recommendRosterManagement(state, teamId, { configuredBy: "user" }),
  );
}

function resolveDraftClass(state: GameState, rng: Rng): GameState {
  const draftYear = draftYearForSeason(state.competition.season.year);
  const existing = getDraftClassDecision(state, draftYear);
  if (existing?.resolved === true) return state;
  const next = withDraftClassDecision(state, {
    draftYear,
    resolved: true,
    source: "generated",
  });
  const created = createDraft(next, rng);
  return created.state;
}

const huntedWindows = new Set<string>();
let activePlay: PlayLog | null = null;

function windowKey(state: GameState, label: string): string {
  return `${state.competition.season.year}:${label}`;
}

function runHuntOnce(
  state: GameState,
  log: SeasonLog,
  label: string,
): GameState {
  const key = windowKey(state, label);
  if (huntedWindows.has(key)) return state;
  huntedWindows.add(key);
  return huntStars(state, log);
}

function gmWindow(
  state: GameState,
  rng: Rng,
  log: SeasonLog,
  mode: "cheap" | "full",
): GameState {
  let current = persistRng(state, rng);
  current = resolveIncomingOffers(current, log);
  if (getActivePhaseId(current) === "offseason.draft") {
    current = drainDraft(current, rng, log);
  } else if (isUserOnDraftClock(current)) {
    current = persistRng(pickBestProspect(current, log), rng);
  }
  if (mode === "cheap") {
    return persistRng(current, rng);
  }
  current = resolveContractOptions(current, log);
  const phase = getActivePhaseId(current);
  if (phase === "offseason.draft_preparation") {
    current = persistRng(resolveDraftClass(current, rng), rng);
    current = runHuntOnce(current, log, "draft_prep");
  } else if (phase === "offseason.draft") {
    current = runHuntOnce(current, log, "draft");
    current = drainDraft(current, rng, log);
  } else if (phase === "offseason.free_agency") {
    current = runHuntOnce(current, log, "free_agency");
    current = signFreeAgents(current, log);
    current = persistRng(runAiTeamDecisions(current, rng).state, rng);
  } else if (phase === "offseason.roster_decisions") {
    current = runHuntOnce(current, log, "roster_decisions");
  } else if (phase === "offseason.staff_development") {
    const staffed = runTeamStaffAiManagement(
      current,
      current.user.activeOwnerTeamId,
      rng,
    );
    current = persistRng(staffed.state, rng);
    if (staffed.events.length > 0) {
      noteOnce(log, "Resolved staff vacancies and renewals.");
    }
    current = persistRng(setRotations(current), rng);
  } else if (phase === "preseason.preparation") {
    current = runHuntOnce(current, log, "preseason");
    current = persistRng(setRotations(current), rng);
  } else if (phase === "regular") {
    const deadline = current.competition.season.tradeDeadlineDate;
    const today = current.world.calendar.currentDate;
    if (deadline && today >= deadline) {
      current = runHuntOnce(current, log, "trade_deadline");
    } else {
      current = runHuntOnce(current, log, "season_open");
    }
  }
  current = dumpToCap(current);
  if (activePlay) {
    const phaseNow = getActivePhaseId(current);
    if (
      mode === "full" &&
      (phaseNow.startsWith("offseason.") || phaseNow.startsWith("preseason."))
    ) {
      current = persistRng(runOwnerOps(current, log), rng);
      current = persistRng(tryRelocation(current, log, activePlay), rng);
    }
  }
  return persistRng(current, rng);
}

function prepareAdvance(state: GameState, rng: Rng, log: SeasonLog): GameState {
  let current = gmWindow(state, rng, log, "cheap");
  const plannedOpener = derivePlannedRegularSeasonStartDate(current);
  if (
    needsRegularSeasonInitialization(current) &&
    plannedOpener != null &&
    current.world.calendar.currentDate >= plannedOpener
  ) {
    current = persistRng(
      enforceMaxRosterViaDevelopmentLeague(current).state,
      rng,
    );
    current = persistRng(fillShortRosters(current, rng).state, rng);
  }
  return persistRng(current, rng);
}

function tryAdvancePhase(
  state: GameState,
  rng: Rng,
  log: SeasonLog,
): GameState {
  const current = gmWindow(state, rng, log, "full");
  const preview = previewAdvance(current);
  if (!preview.canAdvance) {
    if (preview.blockReason) {
      noteOnce(log, `Phase block: ${preview.blockReason}`);
    }
    return persistRng(current, rng);
  }
  const advanced = advanceLeaguePhase(current, rng);
  return persistRng(advanced.state, rng);
}

function snapshotSeason(state: GameState, log: SeasonLog): void {
  const teamId = state.user.activeOwnerTeamId;
  const history = state.business.franchiseHistory?.[teamId];
  const record =
    history?.seasons.find((season) => season.seasonYear === log.year) ??
    history?.seasons[history.seasons.length - 1];
  if (record && (record.wins > 0 || record.losses > 0 || record.championship)) {
    log.wins = record.wins;
    log.losses = record.losses;
    log.playoffResult = record.playoffResult ?? null;
    log.championship = record.championship === true;
  } else {
    const standing = state.competition.standings?.byTeamId?.[teamId];
    if (standing && (standing.wins > 0 || standing.losses > 0)) {
      log.wins = standing.wins;
      log.losses = standing.losses;
    }
    if (state.competition.playoffs?.championTeamId === teamId) {
      log.championship = true;
      log.playoffResult = "champion";
    }
  }
  log.phaseAtEnd = `${state.competition.season.phase}/${getActivePhaseId(state)}`;
  log.topPlayers = rankedRoster(state, teamId)
    .slice(0, 8)
    .map((id) => playerLabel(state, id));
  applyOwnerSnapshot(state, log);
}

function checkSeasonHealth(
  state: GameState,
  play: PlayLog,
  seasonYear: number,
): void {
  const prefix = `Y${seasonYear}`;
  const push = (message: string): void => {
    const line = `${prefix}: ${message}`;
    if (!play.issues.includes(line)) play.issues.push(line);
  };

  for (const issue of collectLeagueInvariantIssues(state)) {
    push(`${issue.code}: ${issue.message}`);
  }

  const teams = Object.values(state.world.teams);
  const seenPlayers = new Set<PlayerId>();
  for (const team of teams) {
    const roster = team.roster;
    if (roster.length < 5) {
      push(`Roster too small: ${team.city} ${team.name} has ${roster.length}.`);
    }
    if (roster.length > TRADE_ROSTER_RULES.maxRosterSize + 8) {
      push(`Roster bloated: ${team.city} ${team.name} has ${roster.length}.`);
    }
    for (const playerId of roster) {
      if (seenPlayers.has(playerId)) {
        push(`Player ${playerId} appears on multiple NBA rosters.`);
      }
      seenPlayers.add(playerId);
    }
    const integrity = validateTeamRosterIntegrity(state, team.id);
    for (const issue of integrity.issues) {
      if (
        issue.severity === "error" &&
        (issue.code === "missing_roster_player" ||
          issue.code === "player_team_mismatch" ||
          issue.code === "missing_contract" ||
          issue.code === "contract_team_mismatch" ||
          issue.code === "contract_player_mismatch")
      ) {
        push(`${team.city} ${team.name}: ${issue.code} ${issue.message}`);
      }
    }
  }

  const year = state.competition.season.year;
  const phaseId = getActivePhaseId(state);
  if (phaseId === "regular") {
    let rosteredWithoutActiveContract = 0;
    let activeContractOrphans = 0;
    for (const player of Object.values(state.world.players)) {
      if (player.retired) continue;
      if (player.teamId == null) continue;
      const team = state.world.teams[player.teamId];
      if (team && !team.roster.includes(player.id)) continue;
      const contract =
        (player.contractId != null
          ? state.business.contracts[player.contractId]
          : undefined) ??
        Object.values(state.business.contracts).find(
          (c) => c.playerId === player.id && isContractActive(c, year),
        );
      if (contract == null || !isContractActive(contract, year)) {
        rosteredWithoutActiveContract += 1;
      }
    }
    for (const contract of Object.values(state.business.contracts)) {
      if (!isContractActive(contract, year)) continue;
      if (state.world.players[contract.playerId] == null) {
        activeContractOrphans += 1;
      }
    }
    if (rosteredWithoutActiveContract > 0) {
      push(
        `${rosteredWithoutActiveContract} rostered players lack an active contract.`,
      );
    }
    if (activeContractOrphans > 0) {
      push(
        `${activeContractOrphans} active contracts point at missing players.`,
      );
    }
  }

  const history = toLeagueHistoryView(state);
  const completedYears = play.seasons
    .filter((season) => season.wins + season.losses > 0)
    .map((season) => season.year);
  for (const completedYear of completedYears) {
    const row = history.seasons.find(
      (entry) => entry.seasonYear === completedYear,
    );
    if (row?.championTeamId == null) {
      push(`League history missing champion for ${completedYear}.`);
    }
  }

  if (completedYears.length > 0) {
    const archiveCount = Object.keys(state.business.gameArchive ?? {}).length;
    if (archiveCount === 0) {
      push("gameArchive is empty after a completed season.");
    }
    const playerHistoryCount = Object.keys(
      state.business.playerHistory ?? {},
    ).length;
    if (playerHistoryCount === 0) {
      push("playerHistory is empty after a completed season.");
    }
    const yearlyAwards = Object.values(
      state.business.awards?.results ?? {},
    ).filter((award) => award.cadence === "yearly");
    if (yearlyAwards.length === 0) {
      push("No yearly awards recorded after a completed season.");
    }
  }

  const financeTeams = Object.keys(state.business.finances ?? {});
  if (financeTeams.length < teams.length) {
    push(
      `Finance books missing for ${teams.length - financeTeams.length} teams.`,
    );
  }
  const employedStaff = Object.values(state.world.staff).filter(
    (member) => member.teamId != null,
  );
  if (employedStaff.length < teams.length) {
    push(
      `Only ${employedStaff.length} employed staff for ${teams.length} teams.`,
    );
  }

  if (
    getActivePhaseId(state) === "offseason.free_agency" &&
    listFreeAgents(state).playerIds.length === 0
  ) {
    push("Free-agent pool is empty during free agency.");
  }
}

function createPrisma(): PrismaClient {
  const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  const adapter = new PrismaLibSql({ url });
  return new PrismaClient({ adapter });
}

async function persistSave(
  db: PrismaClient,
  saveId: string,
  name: string,
  state: GameState,
  create: boolean,
): Promise<void> {
  const stateJson = serializeGameState(state);
  const { teams, players } = projectSaveEntities(state);
  console.log(
    `Persist ${name}: ${Math.round(stateJson.length / 1024)} KB, ${teams.length} teams, ${players.length} players`,
  );
  try {
    await db.$transaction(
      async (tx) => {
        if (create) {
          await tx.saveGame.create({
            data: {
              id: saveId,
              name,
              schemaVersion: GAME_STATE_SCHEMA_VERSION,
              stateJson,
            },
          });
        } else {
          await tx.saveGame.update({
            where: { id: saveId },
            data: {
              schemaVersion: GAME_STATE_SCHEMA_VERSION,
              stateJson,
            },
          });
        }
        await tx.saveTeam.deleteMany({ where: { saveGameId: saveId } });
        await tx.savePlayer.deleteMany({ where: { saveGameId: saveId } });
        if (teams.length > 0) {
          await tx.saveTeam.createMany({
            data: teams.map((team) => ({ saveGameId: saveId, ...team })),
          });
        }
        if (players.length > 0) {
          await tx.savePlayer.createMany({
            data: players.map((player) => ({ saveGameId: saveId, ...player })),
          });
        }
      },
      { timeout: 20_000, maxWait: 5_000 },
    );
    console.log("Persist committed.");
  } catch (error) {
    console.log(
      `Persist skipped (DB busy): ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function main(): Promise<void> {
  const play: PlayLog = {
    saveId: "",
    settings: {
      preset: "standard",
      teamCount: DEFAULT_GAME_SETTINGS.league.teamCount,
      gamesPerTeam: DEFAULT_GAME_SETTINGS.regularSeason.gamesPerTeam,
      playoffTeams: DEFAULT_GAME_SETTINGS.playoffs.playoffTeams,
      seriesLength: DEFAULT_GAME_SETTINGS.playoffs.seriesLength,
      injuryFrequency: DEFAULT_GAME_SETTINGS.injuryFrequency,
      salaryCap: DEFAULT_GAME_SETTINGS.financialRules.salaryCap,
      luxuryTaxEnabled: DEFAULT_GAME_SETTINGS.financialRules.luxuryTaxEnabled,
      city: "",
      nickname: NICKNAME,
      marketSize: 0,
    },
    seasons: [],
    relocationAttempts: [],
    issues: [],
    opportunities: [],
  };

  const db = createPrisma();
  const row = await db.saveGame.findUnique({
    where: { id: LOAD_SAVE_ID },
    select: { id: true, name: true, stateJson: true },
  });
  if (!row) {
    throw new Error(`Save ${LOAD_SAVE_ID} was not found.`);
  }

  const saveId = row.id;
  let state = deserializeGameState(row.stateJson);
  const rng = createSeededRng(state.meta.rngState);
  play.saveId = saveId;
  activePlay = play;
  play.settings = {
    preset: "custom",
    teamCount: state.settings.league.teamCount,
    gamesPerTeam: state.settings.regularSeason.gamesPerTeam,
    playoffTeams: state.settings.playoffs.playoffTeams,
    seriesLength: state.settings.playoffs.seriesLength,
    injuryFrequency: state.settings.injuryFrequency,
    salaryCap: state.settings.financialRules.salaryCap,
    luxuryTaxEnabled: state.settings.financialRules.luxuryTaxEnabled,
    city: state.world.teams[state.user.activeOwnerTeamId]?.city ?? "",
    nickname: state.world.teams[state.user.activeOwnerTeamId]?.name ?? NICKNAME,
    marketSize:
      state.business.franchiseOps[state.user.activeOwnerTeamId]?.marketSize ??
      0,
  };
  console.log(
    `Loaded ${play.settings.city} ${play.settings.nickname} (market ${play.settings.marketSize}) from save ${saveId} date=${state.world.calendar.currentDate} phase=${getActivePhaseId(state)}`,
  );
  console.log(
    `Opening roster: ${rankedRoster(state, state.user.activeOwnerTeamId)
      .slice(0, 8)
      .map((id) => playerLabel(state, id))
      .join(" | ")}`,
  );

  const openingLog = emptySeasonLog(state.competition.season.year, state);
  play.seasons.push(openingLog);
  state = gmWindow(state, rng, openingLog, "full");
  if (openingLog.trades.length > 0) {
    console.log(`Opening trades:\n  ${openingLog.trades.join("\n  ")}`);
  }
  console.log(
    "Skipping opening DB persist (dev server holds SQLite). Simulating in memory.",
  );

  let seasonIndex = 0;
  let idle = 0;
  let steps = 0;
  const maxSteps = 50_000;

  try {
    while (seasonIndex < TARGET_SEASONS && steps < maxSteps) {
      steps += 1;
      const year = state.competition.season.year;
      let log = play.seasons[seasonIndex];
      if (!log || log.year !== year) {
        log = emptySeasonLog(year, state);
        play.seasons[seasonIndex] = log;
      }

      state = prepareAdvance(state, rng, log);
      const phase = getActivePhaseId(state);
      const seasonPhase = state.competition.season.phase;
      const gameCount = Object.keys(state.competition.games ?? {}).length;
      const archiveCount = Object.keys(state.business.gameArchive ?? {}).length;
      const live =
        state.competition.standings?.byTeamId?.[state.user.activeOwnerTeamId];
      if (live && (live.wins > 0 || live.losses > 0)) {
        log.wins = live.wins;
        log.losses = live.losses;
      }
      if (
        state.competition.playoffs?.championTeamId ===
        state.user.activeOwnerTeamId
      ) {
        log.championship = true;
        log.playoffResult = "champion";
      }

      if (seasonPhase === "postseason") {
        const entered = enterOffseasonFromPostseason(state);
        state = persistRng(entered.state, rng);
        const day = advanceSimulation(state, rng, {
          days: 1,
          gameFidelity: "box_score",
        });
        state = persistRng(day.state, rng);
        idle = 0;
        if (state.competition.season.year > year) {
          snapshotSeason(state, log);
          checkSeasonHealth(state, play, log.year);
          console.log(
            `Season ${log.year} done: ${log.wins}-${log.losses} ${log.playoffResult ?? ""} ${log.championship ? "CHAMPION" : ""} | ${log.city} mkt=${log.marketSize} reloc=${log.relocationStage}/${log.relocationStatus} cash=${Math.round(log.cash / 1_000_000)}M trades=${log.trades.length} FA=${log.signings.length} games=${gameCount} archive=${archiveCount}`,
          );
          seasonIndex += 1;
          writeFileSync(
            resolve("scripts/_play_10_year_report.json"),
            JSON.stringify({ play }, null, 2),
          );
        }
        continue;
      }

      if (phase.startsWith("offseason.")) {
        const beforePhase = phase;
        const beforeYear = state.competition.season.year;
        state = tryAdvancePhase(state, rng, log);
        if (
          getActivePhaseId(state) === beforePhase &&
          state.competition.season.year === beforeYear
        ) {
          const day = advanceSimulation(state, rng, {
            days: beforePhase === "offseason.draft" ? 1 : 3,
            ...SIM_ADVANCE,
          });
          state = persistRng(day.state, rng);
          if (day.stopReason === "pending_owner_decision") {
            state = resolveIncomingOffers(state, log);
          }
          if (day.stopReason === "draft_clock") {
            state = persistRng(pickBestProspect(state, log), rng);
          }
        }
        if (state.competition.season.year > beforeYear) {
          snapshotSeason(state, log);
          checkSeasonHealth(state, play, log.year);
          console.log(
            `Season ${log.year} done: ${log.wins}-${log.losses} ${log.playoffResult ?? ""} ${log.championship ? "CHAMPION" : ""} | ${log.city} mkt=${log.marketSize} reloc=${log.relocationStage}/${log.relocationStatus} cash=${Math.round(log.cash / 1_000_000)}M trades=${log.trades.length} FA=${log.signings.length} games=${gameCount} archive=${archiveCount}`,
          );
          seasonIndex += 1;
          idle = 0;
          writeFileSync(
            resolve("scripts/_play_10_year_report.json"),
            JSON.stringify({ play }, null, 2),
          );
        } else {
          idle += 1;
        }
        continue;
      }

      if (isUserOnDraftClock(state)) {
        state = persistRng(pickBestProspect(state, log), rng);
        idle += 1;
        if (idle > 80) {
          play.issues.push(`Draft clock stuck in ${year} ${phase}`);
          break;
        }
        continue;
      }

      const deadline = state.competition.season.tradeDeadlineDate;
      const today = state.world.calendar.currentDate;
      if (deadline && today >= deadline) {
        state = gmWindow(state, rng, log, "full");
      }

      const result = advanceSimulation(state, rng, {
        days: 21,
        ...SIM_ADVANCE,
      });
      state = persistRng(result.state, rng);
      if (result.stopReason === "pending_owner_decision") {
        state = resolveIncomingOffers(state, log);
        idle = 0;
        continue;
      }
      if (result.stopReason === "draft_clock") {
        state = persistRng(pickBestProspect(state, log), rng);
        idle = 0;
        continue;
      }

      if (state.competition.season.year > year) {
        snapshotSeason(state, log);
        checkSeasonHealth(state, play, log.year);
        console.log(
          `Season ${log.year} rolled: ${log.wins}-${log.losses} ${log.playoffResult ?? ""} ${log.championship ? "CHAMPION" : ""} | trades=${log.trades.length} FA=${log.signings.length}`,
        );
        seasonIndex += 1;
        idle = 0;
        writeFileSync(
          resolve("scripts/_play_10_year_report.json"),
          JSON.stringify({ play }, null, 2),
        );
        continue;
      }

      idle += 1;
      if (idle > 500) {
        play.issues.push(
          `Idle loop at ${state.world.calendar.currentDate} phase=${getActivePhaseId(state)} season=${state.competition.season.phase} games=${gameCount}`,
        );
        snapshotSeason(state, log);
        checkSeasonHealth(state, play, log.year);
        break;
      }
      if (steps % 1 === 0) {
        process.stdout.write(
          `  ${state.world.calendar.currentDate} ${getActivePhaseId(state)} ${seasonPhase} ${live?.wins ?? 0}-${live?.losses ?? 0} games=${gameCount} arch=${archiveCount} ovr8=${topEightOverall(state, state.user.activeOwnerTeamId)}\n`,
        );
      }
    }

    if (seasonIndex < TARGET_SEASONS) {
      play.issues.push(
        `Stopped after ${seasonIndex} of ${TARGET_SEASONS} seasons (${steps} steps, date=${state.world.calendar.currentDate}, phase=${getActivePhaseId(state)}).`,
      );
    }

    if (play.seasons.length > 0) {
      const last = play.seasons[play.seasons.length - 1]!;
      if (!last.phaseAtEnd) snapshotSeason(state, last);
      checkSeasonHealth(state, play, last.year);
    }

    const history = toLeagueHistoryView(state);
    const teamId = state.user.activeOwnerTeamId;
    const titles = history.seasons.filter(
      (row) => row.championTeamId === teamId,
    );
    console.log("\n=== League champions ===");
    for (const row of [...history.seasons].reverse()) {
      const ours = row.championTeamId === teamId ? " ← US" : "";
      console.log(
        `${row.seasonYear} ${row.championName} ${row.championRecord}${ours}`,
      );
    }
    console.log(
      `\nTitles: ${titles.length}/${history.seasons.length}. Final roster:`,
    );
    console.log(
      rankedRoster(state, teamId)
        .slice(0, 10)
        .map((id) => playerLabel(state, id))
        .join("\n"),
    );

    if (titles.length === 0) {
      play.opportunities.push(
        `No championships in ${history.seasons.length} completed seasons.`,
      );
    } else {
      play.opportunities.push(
        `Won ${titles.length} of ${history.seasons.length} completed seasons.`,
      );
    }
    const relocated = play.relocationAttempts.some((row) =>
      row.outcome.includes("now "),
    );
    const completedMove = play.seasons.some(
      (season, index) =>
        index > 0 &&
        play.seasons[0] &&
        season.city !== "" &&
        play.seasons[0].city !== "" &&
        season.city.split(" ")[0] !== play.seasons[0].city.split(" ")[0],
    );
    if (!relocated && !completedMove) {
      play.issues.push(
        "Relocation did not complete. See relocationAttempts for tenure/market gates.",
      );
    }
    console.log("\n=== Relocation attempts ===");
    for (const attempt of play.relocationAttempts) {
      console.log(
        `${attempt.date} ${attempt.phase} ${attempt.stageBefore}->${attempt.stageAfter} ${attempt.outcome}`,
      );
    }
    if (play.seasons.every((season) => season.trades.length === 0)) {
      play.issues.push("Never completed a star-for-picks trade.");
      play.opportunities.push(
        "Trade market rarely accepted pick-only packages for 82+ players.",
      );
    }
    if (play.seasons.every((season) => season.signings.length === 0)) {
      play.issues.push("Never signed a free agent.");
      play.opportunities.push(
        "Cap space or FA pool quality blocked win-now signings.",
      );
    }
    play.opportunities.push(
      "Incoming trade offers were frequent enough to pause simulation; a bulk-resolve or AI-assist default would help long sims.",
    );

    const review = reviewSaveBalance(state, play, history);
    console.log("\n=== Save review ===");
    for (const line of review.lines) {
      console.log(line);
    }
    for (const flag of review.flags) {
      play.issues.push(flag);
      console.log(`FLAG: ${flag}`);
    }

    await persistSave(db, saveId, SAVE_NAME, state, false);
    const reportPath = resolve("scripts/_play_10_year_report.json");
    writeFileSync(
      reportPath,
      JSON.stringify({ play, history, review }, null, 2),
    );
    console.log(`\nSaved report ${reportPath}`);
    console.log(`Open in UI: /dashboard/${saveId}`);
  } catch (error) {
    const crash =
      error instanceof Error
        ? `${error.message}\n${error.stack ?? ""}`
        : String(error);
    play.issues.push(`CRASH: ${crash.split("\n")[0]}`);
    const reportPath = resolve("scripts/_play_10_year_report.json");
    writeFileSync(
      reportPath,
      JSON.stringify(
        {
          play,
          crash,
          date: state.world.calendar.currentDate,
          phase: getActivePhaseId(state),
        },
        null,
        2,
      ),
    );
    throw error;
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
