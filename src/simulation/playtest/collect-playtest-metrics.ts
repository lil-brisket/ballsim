/**
 * Playtest metrics collector — active players only (retired excluded).
 * Deterministic given the same GameState. No RNG.
 */

import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { GameState } from "@/state/game-state";
import { getContractSalaryForYear } from "@/domain/entities/contract";
import { getLeagueSalaryCap } from "@/systems/league-salary-cap";
import { getTeamPayroll } from "@/systems/salary-cap";

export type OvrBucketCounts = {
  below60: number;
  from60to69: number;
  from70to79: number;
  from80to84: number;
  from85to89: number;
  from90: number;
};

export type DraftPickBandMetrics = {
  band: string;
  count: number;
  meanOvr: number;
  meanPotential: number;
};

export type SalaryByOvrBand = {
  band: string;
  count: number;
  meanSalary: number;
  maxSalary: number;
};

export type PlaytestTalentMetrics = {
  activePlayers: number;
  retiredPlayers: number;
  ovrBuckets: OvrBucketCounts;
  ovr80: number;
  ovr85: number;
  ovr90: number;
  medianOvr: number;
  meanOvr: number;
  medianAge: number;
  meanAge: number;
  overStoredPotential: number;
};

export type PlaytestEconomyMetrics = {
  salaryByOvrBand: SalaryByOvrBand[];
  maxSalary: number;
  meanSalaryPctCap: number;
  teamCashMean: number;
  teamCashMax: number;
};

export type PlaytestTradeMetrics = {
  playerTradedEvents: number;
  moved85: number;
  moved90: number;
  firstsExchanged: number;
  pendingOwnerTradeOffers: number;
};

export type PlaytestGameplayMetrics = {
  ppgByOvrBand: Array<{ band: string; games: number; meanPpg: number }>;
  meanPpgActive: number;
};

export type PlaytestPersistenceMetrics = {
  gameArchiveCount: number;
  gameArchiveBytes: number;
  eventLogCount: number;
};

export type PlaytestMetrics = {
  seasonYear: number;
  schemaVersion: number;
  rngSeed: number;
  talent: PlaytestTalentMetrics;
  draft: { byPickBand: DraftPickBandMetrics[] };
  economy: PlaytestEconomyMetrics;
  trades: PlaytestTradeMetrics;
  gameplay: PlaytestGameplayMetrics;
  persistence: PlaytestPersistenceMetrics;
};

const OVR_BANDS: ReadonlyArray<{ band: string; min: number; max: number }> = [
  { band: "90+", min: 90, max: 99 },
  { band: "85-89", min: 85, max: 89 },
  { band: "80-84", min: 80, max: 84 },
  { band: "70-79", min: 70, max: 79 },
  { band: "60-69", min: 60, max: 69 },
  { band: "<60", min: 0, max: 59 },
];

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function bucketOvr(ovr: number, buckets: OvrBucketCounts): void {
  if (ovr >= 90) buckets.from90 += 1;
  else if (ovr >= 85) buckets.from85to89 += 1;
  else if (ovr >= 80) buckets.from80to84 += 1;
  else if (ovr >= 70) buckets.from70to79 += 1;
  else if (ovr >= 60) buckets.from60to69 += 1;
  else buckets.below60 += 1;
}

function activePlayersOf(state: GameState) {
  return Object.values(state.world.players).filter(
    (player) => player.retired !== true,
  );
}

/**
 * Collects a JSON-serializable snapshot of talent, economy, trades,
 * scoring, and archive size from the current save.
 */
export function collectPlaytestMetrics(state: GameState): PlaytestMetrics {
  const year = state.competition.season.year;
  const cap = getLeagueSalaryCap(state);
  const active = activePlayersOf(state);
  const retiredCount = Object.values(state.world.players).length - active.length;

  const ovrs: number[] = [];
  const ages: number[] = [];
  const buckets: OvrBucketCounts = {
    below60: 0,
    from60to69: 0,
    from70to79: 0,
    from80to84: 0,
    from85to89: 0,
    from90: 0,
  };
  let overPotential = 0;
  let ovr80 = 0;
  let ovr85 = 0;
  let ovr90 = 0;

  for (const player of active) {
    const ovr = calculatePlayerOverall(player.position, player.attributes);
    ovrs.push(ovr);
    ages.push(player.age);
    bucketOvr(ovr, buckets);
    if (ovr >= 80) ovr80 += 1;
    if (ovr >= 85) ovr85 += 1;
    if (ovr >= 90) ovr90 += 1;
    if (ovr > player.potential.overall) {
      overPotential += 1;
    }
  }

  const salaryByOvrBand: SalaryByOvrBand[] = OVR_BANDS.map((band) => {
    const salaries: number[] = [];
    for (const player of active) {
      const ovr = calculatePlayerOverall(player.position, player.attributes);
      if (ovr < band.min || ovr > band.max) {
        continue;
      }
      if (player.contractId == null) {
        continue;
      }
      const contract = state.business.contracts[player.contractId];
      if (!contract) {
        continue;
      }
      const salary = getContractSalaryForYear(contract, year) ?? 0;
      salaries.push(salary);
    }
    return {
      band: band.band,
      count: salaries.length,
      meanSalary: Math.round(mean(salaries)),
      maxSalary: salaries.length === 0 ? 0 : Math.max(...salaries),
    };
  });

  const allSalaries: number[] = [];
  for (const player of active) {
    if (player.contractId == null) continue;
    const contract = state.business.contracts[player.contractId];
    if (!contract) continue;
    const salary = getContractSalaryForYear(contract, year);
    if (salary != null) allSalaries.push(salary);
  }

  const teamCash = Object.values(state.business.finances).map(
    (finances) => finances.businessFunds,
  );
  const teamIds = Object.keys(state.world.teams);
  const salaryPcts = teamIds.map((teamId) => {
    const payroll = getTeamPayroll(teamId as never, year, state);
    return cap > 0 ? payroll / cap : 0;
  });

  let playerTradedEvents = 0;
  let moved85 = 0;
  let moved90 = 0;
  let firstsExchanged = 0;
  for (const event of state.competition.seasonEventLog) {
    if (event.type === "PlayerTraded") {
      playerTradedEvents += 1;
      const playerId = event.payload.playerId as string | undefined;
      if (playerId) {
        const player = state.world.players[playerId];
        if (player && player.retired !== true) {
          const ovr = calculatePlayerOverall(player.position, player.attributes);
          if (ovr >= 85) moved85 += 1;
          if (ovr >= 90) moved90 += 1;
        }
      }
    }
    if (event.type === "DraftPickTraded") {
      const round = event.payload.round as number | undefined;
      if (round === 1) firstsExchanged += 1;
    }
  }

  const pendingOwnerTradeOffers = state.user.pendingOwnerDecisions.filter(
    (decision) =>
      decision.type === "trade_offer" &&
      (decision.payload.status === "pending" ||
        decision.payload.status === "negotiating"),
  ).length;

  const draftBands: DraftPickBandMetrics[] = [
    { band: "picks 1-14", min: 1, max: 14 },
    { band: "picks 15-30", min: 15, max: 30 },
    { band: "picks 31-45", min: 31, max: 45 },
    { band: "picks 46-60", min: 46, max: 60 },
  ].map((band) => {
    const ovrsInBand: number[] = [];
    const pots: number[] = [];
    for (const draft of Object.values(state.world.drafts)) {
      for (const prospect of Object.values(draft.prospects)) {
        const ranking = prospect.ranking;
        if (ranking < band.min || ranking > band.max) continue;
        const ovr = calculatePlayerOverall(
          prospect.player.position,
          prospect.player.attributes,
        );
        ovrsInBand.push(ovr);
        pots.push(prospect.player.potential.overall);
      }
    }
    return {
      band: band.band,
      count: ovrsInBand.length,
      meanOvr: round1(mean(ovrsInBand)),
      meanPotential: round1(mean(pots)),
    };
  });

  const ppgByOvrBand = OVR_BANDS.map((band) => {
    const ppgs: number[] = [];
    for (const player of active) {
      const ovr = calculatePlayerOverall(player.position, player.attributes);
      if (ovr < band.min || ovr > band.max) continue;
      const history = state.business.playerHistory[player.id];
      const season = history?.seasons.find((row) => row.seasonYear === year);
      if (!season || season.stats.games <= 0) continue;
      ppgs.push(season.stats.points / season.stats.games);
    }
    return {
      band: band.band,
      games: ppgs.length,
      meanPpg: round1(mean(ppgs)),
    };
  });

  const allPpg: number[] = [];
  for (const player of active) {
    const history = state.business.playerHistory[player.id];
    const season = history?.seasons.find((row) => row.seasonYear === year);
    if (!season || season.stats.games <= 0) continue;
    allPpg.push(season.stats.points / season.stats.games);
  }

  const archiveJson = JSON.stringify(state.business.gameArchive);
  const eventLogCount = Object.values(state.user.ownedFranchises).reduce(
    (sum, franchise) => sum + franchise.eventLog.length,
    0,
  );

  return {
    seasonYear: year,
    schemaVersion: state.meta.schemaVersion,
    rngSeed: state.meta.rngSeed,
    talent: {
      activePlayers: active.length,
      retiredPlayers: retiredCount,
      ovrBuckets: buckets,
      ovr80,
      ovr85,
      ovr90,
      medianOvr: round1(median(ovrs)),
      meanOvr: round1(mean(ovrs)),
      medianAge: round1(median(ages)),
      meanAge: round1(mean(ages)),
      overStoredPotential: overPotential,
    },
    draft: { byPickBand: draftBands },
    economy: {
      salaryByOvrBand,
      maxSalary: allSalaries.length === 0 ? 0 : Math.max(...allSalaries),
      meanSalaryPctCap: round1(mean(salaryPcts) * 100),
      teamCashMean: Math.round(mean(teamCash)),
      teamCashMax: teamCash.length === 0 ? 0 : Math.max(...teamCash),
    },
    trades: {
      playerTradedEvents,
      moved85,
      moved90,
      firstsExchanged,
      pendingOwnerTradeOffers,
    },
    gameplay: {
      ppgByOvrBand,
      meanPpgActive: round1(mean(allPpg)),
    },
    persistence: {
      gameArchiveCount: Object.keys(state.business.gameArchive).length,
      gameArchiveBytes: new TextEncoder().encode(archiveJson).length,
      eventLogCount,
    },
  };
}
