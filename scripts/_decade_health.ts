/**
 * 10-year Standard league health dump (30 teams / 82 games / 16 playoff teams).
 * Snapshots scoring, talent, injuries, awards, and standings at each postseason.
 *
 * Run: npx tsx scripts/_decade_health.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import { DEFAULT_GAME_SETTINGS } from "@/domain/game-settings";
import type { Game } from "@/domain/entities/game";
import type { PlayerId } from "@/domain/ids";
import { runLeagueCareer } from "@/simulation/league-sanity/run-league-career";
import { buildLeagueSanityReport } from "@/simulation/league-sanity/report";
import { listAwardResults } from "@/state/award-selectors";
import type { GameState } from "@/state/game-state";
import { getContractSalaryForYear } from "@/domain/entities/contract";
import { getTeamPayroll } from "@/systems/salary-cap";
import { getLeagueSalaryCap } from "@/systems/league-salary-cap";
import { salaryForPlayer, serviceYearsForSalary } from "@/systems/salary-scale";

const SEED = 42;
const SEASONS = 10;
const FIDELITY = "box_score" as const;
const OUT = resolve("reports/tmp-decade-health.json");

type Acc = {
  games: number;
  minutes: number;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fgMade: number;
  fgAttempted: number;
  threeMade: number;
  threeAttempted: number;
  ftMade: number;
  ftAttempted: number;
  touches: number;
};

function emptyAcc(): Acc {
  return {
    games: 0,
    minutes: 0,
    points: 0,
    rebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fgMade: 0,
    fgAttempted: 0,
    threeMade: 0,
    threeAttempted: 0,
    ftMade: 0,
    ftAttempted: 0,
    touches: 0,
  };
}

function addRow(acc: Acc, row: Game["playerStats"][number]): void {
  acc.games += 1;
  acc.minutes += row.minutes;
  acc.points += row.points;
  acc.rebounds += row.rebounds;
  acc.assists += row.assists;
  acc.steals += row.steals;
  acc.blocks += row.blocks;
  acc.turnovers += row.turnovers;
  acc.fgMade += row.fieldGoalsMade;
  acc.fgAttempted += row.fieldGoalsAttempted;
  acc.threeMade += row.threePointersMade;
  acc.threeAttempted += row.threePointersAttempted;
  acc.ftMade += row.freeThrowsMade;
  acc.ftAttempted += row.freeThrowsAttempted;
  acc.touches += row.touches;
}

function pct(made: number, attempted: number): number {
  return attempted <= 0 ? 0 : made / attempted;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor((sorted.length - 1) * p)),
  );
  return sorted[index] ?? 0;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function playerName(state: GameState, playerId: PlayerId): string {
  const player = state.world.players[playerId];
  if (!player) return playerId;
  return `${player.firstName} ${player.lastName}`;
}

function teamName(state: GameState, teamId: string): string {
  const team = state.world.teams[teamId];
  return team ? `${team.city} ${team.name}` : teamId;
}

function collectSeason(state: GameState, seasonIndex: number) {
  const year = state.competition.season.year;
  const regularGames = Object.values(state.competition.games).filter(
    (game) =>
      game.status === "final" && game.competitionType === "regular_season",
  );
  const playoffGames = Object.values(state.competition.games).filter(
    (game) => game.status === "final" && game.competitionType === "playoffs",
  );

  const scoringEnv = (games: Game[]) => {
    if (games.length === 0) {
      return {
        games: 0,
        teamPpg: 0,
        combinedPpg: 0,
        pace: 0,
        efgPct: 0,
        fgPct: 0,
        threePct: 0,
        ftPct: 0,
        ast: 0,
        reb: 0,
        tov: 0,
        stl: 0,
        blk: 0,
        bestScore: 0,
        worstScore: 0,
      };
    }
    let points = 0;
    let bestScore = 0;
    let worstScore = Number.POSITIVE_INFINITY;
    const pooled = emptyAcc();
    for (const game of games) {
      points += game.score.home + game.score.away;
      bestScore = Math.max(bestScore, game.score.home, game.score.away);
      worstScore = Math.min(worstScore, game.score.home, game.score.away);
      for (const row of game.playerStats) addRow(pooled, row);
    }
    const teamGames = games.length * 2;
    const estimatedPossessions =
      pooled.fgAttempted +
      0.44 * pooled.ftAttempted -
      pooled.rebounds * 0.3 +
      pooled.turnovers;
    return {
      games: games.length,
      teamPpg: round1(points / games.length / 2),
      combinedPpg: round1(points / games.length),
      pace: round1(estimatedPossessions / teamGames),
      efgPct: round3(
        pct(pooled.fgMade + 0.5 * pooled.threeMade, pooled.fgAttempted),
      ),
      fgPct: round3(pct(pooled.fgMade, pooled.fgAttempted)),
      threePct: round3(pct(pooled.threeMade, pooled.threeAttempted)),
      ftPct: round3(pct(pooled.ftMade, pooled.ftAttempted)),
      ast: round1(pooled.assists / teamGames),
      reb: round1(pooled.rebounds / teamGames),
      tov: round1(pooled.turnovers / teamGames),
      stl: round1(pooled.steals / teamGames),
      blk: round1(pooled.blocks / teamGames),
      bestScore,
      worstScore: Number.isFinite(worstScore) ? worstScore : 0,
    };
  };

  const byPlayer = new Map<PlayerId, Acc>();
  for (const game of regularGames) {
    for (const row of game.playerStats) {
      const acc = byPlayer.get(row.playerId) ?? emptyAcc();
      addRow(acc, row);
      byPlayer.set(row.playerId, acc);
    }
  }

  const qualified: Array<{
    playerId: PlayerId;
    name: string;
    overall: number;
    age: number;
    position: string;
    team: string;
    games: number;
    mpg: number;
    ppg: number;
    rpg: number;
    apg: number;
    spg: number;
    bpg: number;
    topg: number;
    fgPct: number;
    threePct: number;
    ftPct: number;
    touches: number;
  }> = [];

  for (const [playerId, acc] of byPlayer) {
    if (acc.games < 20) continue;
    const player = state.world.players[playerId];
    const ovr = player
      ? calculatePlayerOverall(player.position, player.attributes)
      : 0;
    qualified.push({
      playerId,
      name: playerName(state, playerId),
      overall: ovr,
      age: player?.age ?? 0,
      position: player?.position ?? "?",
      team: player?.teamId ? teamName(state, player.teamId) : "FA",
      games: acc.games,
      mpg: round1(acc.minutes / acc.games),
      ppg: round1(acc.points / acc.games),
      rpg: round1(acc.rebounds / acc.games),
      apg: round1(acc.assists / acc.games),
      spg: round1(acc.steals / acc.games),
      bpg: round1(acc.blocks / acc.games),
      topg: round1(acc.turnovers / acc.games),
      fgPct: round3(pct(acc.fgMade, acc.fgAttempted)),
      threePct: round3(pct(acc.threeMade, acc.threeAttempted)),
      ftPct: round3(pct(acc.ftMade, acc.ftAttempted)),
      touches: round1(acc.touches / acc.games),
    });
  }
  qualified.sort((a, b) => b.ppg - a.ppg);
  const ppgs = qualified.map((row) => row.ppg);

  const rostered = Object.values(state.world.teams).flatMap((team) =>
    team.roster
      .map((playerId) => state.world.players[playerId])
      .filter((player) => player != null),
  );
  const overalls = rostered.map((player) =>
    calculatePlayerOverall(player.position, player.attributes),
  );
  const ages = rostered.map((player) => player.age);
  const injured = rostered.filter(
    (player) => player.availability !== "available",
  );
  const retired = Object.values(state.world.players).filter(
    (player) => player.retired,
  );

  const ovrBuckets = {
    below60: overalls.filter((value) => value < 60).length,
    from60to69: overalls.filter((value) => value >= 60 && value < 70).length,
    from70to79: overalls.filter((value) => value >= 70 && value < 80).length,
    from80to84: overalls.filter((value) => value >= 80 && value < 85).length,
    from85to89: overalls.filter((value) => value >= 85 && value < 90).length,
    from90: overalls.filter((value) => value >= 90).length,
  };

  const standings = Object.values(state.competition.standings.byTeamId)
    .map((row) => {
      const games = row.wins + row.losses;
      return {
        team: teamName(state, row.teamId),
        wins: row.wins,
        losses: row.losses,
        winPct: round3(row.winPercentage),
        ppg: games > 0 ? round1(row.pointsFor / games) : 0,
        oppg: games > 0 ? round1(row.pointsAgainst / games) : 0,
        diff: row.pointDifferential,
        payrollM: round1(getTeamPayroll(row.teamId, year, state) / 1_000_000),
        rosterSize: state.world.teams[row.teamId]?.roster.length ?? 0,
        meanOvr: round1(
          mean(
            (state.world.teams[row.teamId]?.roster ?? [])
              .map((id) => state.world.players[id])
              .filter((player) => player != null)
              .map((player) =>
                calculatePlayerOverall(player.position, player.attributes),
              ),
          ),
        ),
      };
    })
    .sort((a, b) => b.wins - a.wins || b.diff - a.diff);

  const yearlyAwards = listAwardResults(state, {
    seasonYear: year,
    cadence: "yearly",
  }).map((award) => ({
    awardId: award.awardId,
    winner:
      award.winner.subjectType === "player"
        ? playerName(state, award.winner.subjectId as PlayerId)
        : award.winner.subjectId,
    team: award.winner.teamId ? teamName(state, award.winner.teamId) : null,
    ppg: round1(award.context.statSnapshot.perGame.points),
    rpg: round1(award.context.statSnapshot.perGame.rebounds),
    apg: round1(award.context.statSnapshot.perGame.assists),
    spg: round1(award.context.statSnapshot.perGame.steals),
    bpg: round1(award.context.statSnapshot.perGame.blocks),
    tsPct: award.context.statSnapshot.efficiency.tsPct,
    games: award.context.statSnapshot.games,
  }));

  const championId = state.competition.playoffs.championTeamId;
  const flags: string[] = [];
  const regular = scoringEnv(regularGames);
  if (regular.teamPpg < 100)
    flags.push(`Scoring low: ${regular.teamPpg} team PPG`);
  if (regular.teamPpg > 122)
    flags.push(`Scoring high: ${regular.teamPpg} team PPG`);
  if (regular.fgPct < 0.42 || regular.fgPct > 0.48) {
    flags.push(`FG% ${regular.fgPct} outside 42–48%`);
  }
  if (regular.threePct < 0.33 || regular.threePct > 0.38) {
    flags.push(`3P% ${regular.threePct} outside 33–38%`);
  }
  if (regular.ftPct < 0.72 || regular.ftPct > 0.8) {
    flags.push(`FT% ${regular.ftPct} outside 72–80%`);
  }
  const best = standings[0];
  const worst = standings[standings.length - 1];
  if (best && best.wins >= 70)
    flags.push(`Best record ${best.wins}-${best.losses} is historic`);
  if (worst && worst.wins <= 10)
    flags.push(`Worst record ${worst.wins}-${worst.losses} is tanked`);
  if (ovrBuckets.from90 > 30)
    flags.push(`${ovrBuckets.from90} rostered 90+ players`);
  const mvp = yearlyAwards.find((row) => row.awardId === "mvp");
  if (mvp && mvp.ppg < 22)
    flags.push(`MVP scored ${mvp.ppg} PPG (usage too even)`);
  if (mvp && mvp.ppg > 36)
    flags.push(`MVP scored ${mvp.ppg} PPG (usage too concentrated)`);
  if (ppgs[0] != null && ppgs[0] < 22)
    flags.push(`Scoring leader ${ppgs[0]} PPG`);
  if (ppgs[0] != null && ppgs[0] > 38)
    flags.push(`Scoring leader ${ppgs[0]} PPG`);

  return {
    seasonIndex,
    year,
    champion: championId ? teamName(state, championId) : null,
    regular,
    playoffs: scoringEnv(playoffGames),
    standings,
    talent: {
      rostered: rostered.length,
      retired: retired.length,
      meanOvr: round1(mean(overalls)),
      p50Ovr: percentile(overalls, 0.5),
      p90Ovr: percentile(overalls, 0.9),
      maxOvr: overalls.length === 0 ? 0 : Math.max(...overalls),
      meanAge: round1(mean(ages)),
      injured: injured.length,
      injuredPct: round3(
        rostered.length === 0 ? 0 : injured.length / rostered.length,
      ),
      ovrBuckets,
    },
    scoringLeaders: qualified.slice(0, 10),
    scoringDist: {
      n: ppgs.length,
      max: ppgs[0] ?? 0,
      p90: round1(percentile(ppgs, 0.9)),
      p50: round1(percentile(ppgs, 0.5)),
      seasons30ppg: ppgs.filter((value) => value >= 30).length,
      seasons25ppg: ppgs.filter((value) => value >= 25).length,
    },
    awards: yearlyAwards,
    capM: round1(getLeagueSalaryCap(state) / 1_000_000),
    events: collectLeagueEvents(state, year),
    starPay: collectStarPay(state, year),
    flags,
  };
}

function collectLeagueEvents(state: GameState, year: number) {
  let trades = 0;
  let faSignings = 0;
  for (const franchise of Object.values(state.user.ownedFranchises)) {
    for (const event of franchise.eventLog) {
      if (!event.occurredOn.startsWith(String(year))) continue;
      if (event.type === "PlayerTraded") trades += 1;
      if (event.type === "FreeAgentSigned") faSignings += 1;
    }
  }
  return { trades, faSignings };
}

function collectStarPay(state: GameState, year: number) {
  const cap = getLeagueSalaryCap(state);
  const rows: Array<{
    name: string;
    overall: number;
    salaryM: number;
    marketM: number;
  }> = [];
  for (const player of Object.values(state.world.players)) {
    if (player.retired || player.teamId == null) continue;
    const overall = calculatePlayerOverall(player.position, player.attributes);
    if (overall < 90) continue;
    const contract = player.contractId
      ? state.business.contracts[player.contractId]
      : undefined;
    const salary = contract
      ? (getContractSalaryForYear(contract, year) ?? 0)
      : 0;
    const market = salaryForPlayer({
      overall,
      age: player.age,
      years: serviceYearsForSalary({
        age: player.age,
        seasonYear: year,
        draftSeasonYear: player.developmentLeague?.draftSeasonYear ?? null,
        seasonsPlayed:
          state.business.playerHistory[player.id]?.seasons.length ?? 0,
      }),
      cap,
      kind: "fa",
    });
    rows.push({
      name: playerName(state, player.id),
      overall,
      salaryM: round1(salary / 1_000_000),
      marketM: round1(market / 1_000_000),
    });
  }
  rows.sort((a, b) => b.overall - a.overall);
  return {
    count: rows.length,
    underMarket: rows.filter((row) => row.salaryM + 4 < row.marketM).length,
    sample: rows.slice(0, 8),
  };
}

function main(): void {
  const seasons: ReturnType<typeof collectSeason>[] = [];
  console.error(
    `Decade health: seasons=${SEASONS} seed=${SEED} fidelity=${FIDELITY}`,
  );
  const started = Date.now();
  const career = runLeagueCareer({
    seed: SEED,
    seasons: SEASONS,
    gameSettings: DEFAULT_GAME_SETTINGS,
    gameFidelity: FIDELITY,
    skipOwnerGameplay: true,
    saveId: "decade_health",
    onSeasonComplete: (state, seasonIndex) => {
      const snap = collectSeason(state, seasonIndex);
      seasons.push(snap);
      const best = snap.standings[0];
      const worst = snap.standings[snap.standings.length - 1];
      console.error(
        `  ${snap.year} champ=${snap.champion} ${best?.wins}-${best?.losses}..${worst?.wins}-${worst?.losses} PPG=${snap.regular.teamPpg} FG=${snap.regular.fgPct} 3P=${snap.regular.threePct} 90+=${snap.talent.ovrBuckets.from90} leader=${snap.scoringLeaders[0]?.ppg ?? 0} ${snap.flags.length > 0 ? `FLAGS=${snap.flags.join(" | ")}` : "ok"}`,
      );
    },
  });

  const sanity = buildLeagueSanityReport({
    simulations: 1,
    seasonsPerSimulation: SEASONS,
    seed: SEED,
    gameSettings: DEFAULT_GAME_SETTINGS,
    careers: [career],
  });

  const allFlags = seasons.flatMap((season) =>
    season.flags.map((flag) => `${season.year}: ${flag}`),
  );
  const uniqueChamps = [...new Set(seasons.map((season) => season.champion))];
  const payload = {
    meta: {
      seed: SEED,
      seasons: SEASONS,
      fidelity: FIDELITY,
      skipOwnerGameplay: true,
      elapsedSec: round1((Date.now() - started) / 1000),
      teamCount: career.teamCount,
    },
    summary: {
      uniqueChampions: uniqueChamps.length,
      champions: uniqueChamps,
      meanTeamPpg: round1(mean(seasons.map((s) => s.regular.teamPpg))),
      meanFgPct: round3(mean(seasons.map((s) => s.regular.fgPct))),
      meanThreePct: round3(mean(seasons.map((s) => s.regular.threePct))),
      meanFtPct: round3(mean(seasons.map((s) => s.regular.ftPct))),
      meanAst: round1(mean(seasons.map((s) => s.regular.ast))),
      meanReb: round1(mean(seasons.map((s) => s.regular.reb))),
      meanStl: round1(mean(seasons.map((s) => s.regular.stl))),
      meanBlk: round1(mean(seasons.map((s) => s.regular.blk))),
      meanRostered90: round1(
        mean(seasons.map((s) => s.talent.ovrBuckets.from90)),
      ),
      meanInjuredPct: round3(mean(seasons.map((s) => s.talent.injuredPct))),
      peakPpg: Math.max(...seasons.map((s) => s.scoringDist.max)),
      flags: allFlags,
    },
    seasons,
    sanity: {
      warnings: sanity.warnings,
      championshipHhi: sanity.aggregates.championshipHhi,
      playoffAppearanceRate: sanity.aggregates.playoffAppearanceRate,
      rankPersistence: sanity.aggregates.competitiveMobility.rankPersistence,
      bottomToPlayoffRate:
        sanity.aggregates.competitiveMobility.bottomToPlayoffRate,
      championToNonPlayoffRate:
        sanity.aggregates.competitiveMobility.championToNonPlayoffRate,
      winPct: sanity.aggregates.winPct,
      payroll: sanity.aggregates.payroll,
      cash: sanity.aggregates.cash,
      franchiseValue: sanity.aggregates.franchiseValue,
      meanRosterAge: sanity.aggregates.meanRosterAge,
      tenure: sanity.aggregates.tenure,
      relationships: sanity.relationships.map((rel) => ({
        name: rel.name,
        r: rel.r,
        diagnostic: rel.diagnostic ?? null,
      })),
    },
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(payload, null, 2), "utf8");
  console.error(`Wrote ${OUT} in ${payload.meta.elapsedSec}s`);
}

main();
