import { createGame } from "@/domain/entities/game";
import type { Player } from "@/domain/entities/player";
import {
  asGameId,
  asPlayerId,
  asSeasonId,
  asTeamId,
  type TeamId,
} from "@/domain/ids";
import { createSeededRng, type Rng } from "@/domain/rng";
import { DEFAULT_ROSTER_SIZE, rosterPositionForSlot } from "@/systems/roster-generation-config";
import { generatePlayerWithRng } from "@/systems/player-generation";
import { simulateGame } from "@/systems/game-simulation";
import { aggregateSnapshots } from "@/simulation/validation/aggregate";
import { computeValidationChecksum } from "@/simulation/validation/checksum";
import { collectGameSnapshot } from "@/simulation/validation/collect-game-stats";
import { evaluatePlayerCorrelations } from "@/simulation/validation/correlations";
import { checkGameInvariants } from "@/simulation/validation/invariants";
import { buildMatchupRosters } from "@/simulation/validation/matchup-rosters";
import {
  combineVerdicts,
  evaluatePlausibility,
} from "@/simulation/validation/plausibility";
import type {
  GameSnapshot,
  InvariantFailure,
  MatchupDiagnosticResult,
  ValidationRunResult,
  ValidationVerdict,
} from "@/simulation/validation/types";

export type RunValidationOptions = {
  games: number;
  seed: number | string;
  /** Secondary diagnostic only; not mixed into primary aggregates. */
  matchupGames?: number;
  rosterSize?: number;
};

const HOME_TEAM_ID = asTeamId("team_validation_home");
const AWAY_TEAM_ID = asTeamId("team_validation_away");
const SEASON_ID = asSeasonId("season_validation");

/**
 * Validation treats Player[] / roster data as immutable inputs.
 * If simulateGame mutates them, that is a production bug — do not clone around it.
 */
export function generateValidationRosters(
  rng: Rng,
  rosterSize: number = DEFAULT_ROSTER_SIZE,
): { homePlayers: Player[]; awayPlayers: Player[] } {
  const homePlayers: Player[] = [];
  const awayPlayers: Player[] = [];
  for (let slot = 0; slot < rosterSize; slot += 1) {
    homePlayers.push(
      generatePlayerWithRng(rng, {
        id: asPlayerId(`val_home_${slot}`),
        teamId: HOME_TEAM_ID,
        position: rosterPositionForSlot(slot),
      }),
    );
  }
  for (let slot = 0; slot < rosterSize; slot += 1) {
    awayPlayers.push(
      generatePlayerWithRng(rng, {
        id: asPlayerId(`val_away_${slot}`),
        teamId: AWAY_TEAM_ID,
        position: rosterPositionForSlot(slot),
      }),
    );
  }
  return { homePlayers, awayPlayers };
}

function scheduledGame(
  gameIndex: number,
  homeTeamId: TeamId,
  awayTeamId: TeamId,
) {
  return createGame({
    id: asGameId(`val_game_${gameIndex}`),
    seasonId: SEASON_ID,
    homeTeamId,
    awayTeamId,
    date: "2026-10-15",
    status: "scheduled",
    score: { home: 0, away: 0 },
    periodScores: [],
    events: [],
    playerStats: [],
  });
}

function playerStatsMap(
  result: { playerStats: readonly { playerId: string; points: number; rebounds: number; assists: number }[] },
): Map<string, { points: number; rebounds: number; assists: number }> {
  const map = new Map<
    string,
    { points: number; rebounds: number; assists: number }
  >();
  for (const row of result.playerStats) {
    map.set(row.playerId, {
      points: row.points,
      rebounds: row.rebounds,
      assists: row.assists,
    });
  }
  return map;
}

/**
 * Primary statistical validation run using production simulateGame.
 */
export function runSimulationValidation(
  options: RunValidationOptions,
): ValidationRunResult {
  if (!Number.isInteger(options.games) || options.games < 1) {
    throw new Error("games must be a positive integer.");
  }

  const rng = createSeededRng(options.seed);
  const rosterSize = options.rosterSize ?? DEFAULT_ROSTER_SIZE;
  const { homePlayers, awayPlayers } = generateValidationRosters(
    rng,
    rosterSize,
  );

  const homeIds = new Set(homePlayers.map((player) => player.id as string));
  const awayIds = new Set(awayPlayers.map((player) => player.id as string));

  const snapshots: GameSnapshot[] = [];
  const invariantFailures: InvariantFailure[] = [];
  const playerGameStats: Map<
    string,
    { points: number; rebounds: number; assists: number }
  >[] = [];

  for (let gameIndex = 0; gameIndex < options.games; gameIndex += 1) {
    // Alternate venue assignment so home/away splits measure neutrality,
    // not fixed roster strength from sequential generation. Player objects
    // are reused as-is (immutable); only which side of the Game they occupy changes.
    const homeFirst = gameIndex % 2 === 0;
    const venueHomeId = homeFirst ? HOME_TEAM_ID : AWAY_TEAM_ID;
    const venueAwayId = homeFirst ? AWAY_TEAM_ID : HOME_TEAM_ID;
    const gameHomePlayers = homeFirst ? homePlayers : awayPlayers;
    const gameAwayPlayers = homeFirst ? awayPlayers : homePlayers;
    const gameHomeIds = homeFirst ? homeIds : awayIds;
    const gameAwayIds = homeFirst ? awayIds : homeIds;

    const result = simulateGame(
      scheduledGame(gameIndex, venueHomeId, venueAwayId),
      { homePlayers: gameHomePlayers, awayPlayers: gameAwayPlayers },
      rng,
    );
    const snapshot = collectGameSnapshot(result);
    snapshots.push(snapshot);
    playerGameStats.push(playerStatsMap(result));

    const failures = checkGameInvariants(
      result,
      snapshot,
      gameHomeIds,
      gameAwayIds,
    );
    for (const failure of failures) {
      invariantFailures.push(failure);
    }
  }

  if (invariantFailures.length > 0) {
    const first = invariantFailures[0]!;
    throw new Error(
      `Invariant FAIL (${invariantFailures.length}): ${first.gameId} ${first.side ?? ""} ${first.rule}: ${first.detail}`,
    );
  }

  const aggregates = aggregateSnapshots(snapshots, options.seed);
  const plausibilityChecks = evaluatePlausibility(aggregates);
  const correlations = evaluatePlayerCorrelations(
    homePlayers,
    awayPlayers,
    snapshots,
    playerGameStats,
  );

  const overallVerdict = combineVerdicts([
    ...plausibilityChecks.map((check) => check.verdict),
    ...correlations.map((corr) => corr.verdict),
  ]);

  const checksum = computeValidationChecksum({
    seed: options.seed,
    gamesSimulated: options.games,
    aggregates,
    invariantFailureCount: 0,
    plausibilityChecks,
    correlations,
    overallVerdict,
  });

  const runResult: ValidationRunResult = {
    seed: options.seed,
    gamesSimulated: options.games,
    aggregates,
    invariantFailures: [],
    plausibilityChecks,
    correlations,
    overallVerdict,
    checksum,
  };

  if (options.matchupGames != null && options.matchupGames > 0) {
    runResult.matchup = runMatchupDiagnostic(
      rng,
      homePlayers,
      options.matchupGames,
    );
  }

  return runResult;
}

function mean(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Secondary constructed-matchup diagnostic. Uses fresh Game entities and
 * copied players; does not mutate primary rosters or primary aggregates.
 */
export function runMatchupDiagnostic(
  rng: Rng,
  template: readonly Player[],
  games: number,
): MatchupDiagnosticResult {
  const strongHome = asTeamId("team_matchup_home");
  const weakAway = asTeamId("team_matchup_away");
  const matchups = buildMatchupRosters(template, strongHome, weakAway);
  const strongOffPts: number[] = [];
  const weakOffPts: number[] = [];
  const strongDefOpp: number[] = [];
  const weakDefOpp: number[] = [];

  for (let index = 0; index < games; index += 1) {
    const offenseGame = simulateGame(
      createGame({
        id: asGameId(`matchup_off_${index}`),
        seasonId: SEASON_ID,
        homeTeamId: strongHome,
        awayTeamId: weakAway,
        date: "2026-10-15",
        status: "scheduled",
        score: { home: 0, away: 0 },
        periodScores: [],
        events: [],
        playerStats: [],
      }),
      {
        homePlayers: matchups.strongOffense,
        awayPlayers: matchups.weakOffense,
      },
      rng,
    );
    strongOffPts.push(offenseGame.score.home);
    weakOffPts.push(offenseGame.score.away);

    const defenseGame = simulateGame(
      createGame({
        id: asGameId(`matchup_def_${index}`),
        seasonId: SEASON_ID,
        homeTeamId: strongHome,
        awayTeamId: weakAway,
        date: "2026-10-15",
        status: "scheduled",
        score: { home: 0, away: 0 },
        periodScores: [],
        events: [],
        playerStats: [],
      }),
      {
        homePlayers: matchups.strongDefense,
        awayPlayers: matchups.weakDefense,
      },
      rng,
    );
    // Strong defense (home) allows away points; weak defense (away) allows home points.
    strongDefOpp.push(defenseGame.score.away);
    weakDefOpp.push(defenseGame.score.home);
  }

  const offenseStrongMeanPoints = mean(strongOffPts);
  const offenseWeakMeanPoints = mean(weakOffPts);
  const defenseStrongOpponentPoints = mean(strongDefOpp);
  const defenseWeakOpponentPoints = mean(weakDefOpp);
  const offenseAdvantage = offenseStrongMeanPoints - offenseWeakMeanPoints;
  const defenseAdvantage =
    defenseWeakOpponentPoints - defenseStrongOpponentPoints;

  let verdict: ValidationVerdict = "PASS";
  const messages: string[] = [];
  if (offenseAdvantage <= 0) {
    verdict = "WARNING";
    messages.push(
      `Strong offense did not outscore weak offense (Δ=${offenseAdvantage.toFixed(1)})`,
    );
  }
  if (defenseAdvantage <= 0) {
    verdict = "WARNING";
    messages.push(
      `Strong defense did not allow fewer points (Δ=${defenseAdvantage.toFixed(1)})`,
    );
  }
  if (messages.length === 0) {
    messages.push(
      "Higher offensive ratings scored more; higher defensive ratings allowed fewer points.",
    );
  }

  return {
    games,
    offenseStrongMeanPoints,
    offenseWeakMeanPoints,
    defenseStrongOpponentPoints,
    defenseWeakOpponentPoints,
    offenseAdvantage,
    defenseAdvantage,
    verdict,
    message: messages.join(" "),
  };
}
