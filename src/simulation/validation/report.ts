import type {
  CheckResult,
  CorrelationResult,
  MatchupDiagnosticResult,
  MetricSummary,
  ValidationAggregates,
  ValidationRunResult,
  ValidationVerdict,
} from "@/simulation/validation/types";

function fmt(n: number, digits = 1): string {
  return n.toFixed(digits);
}

function fmtPct(rate: number | null, digits = 1): string {
  if (rate === null) {
    return "n/a";
  }
  return `${(rate * 100).toFixed(digits)}%`;
}

function lineMetric(label: string, summary: MetricSummary, asPct = false): string {
  const mean = asPct ? fmtPct(summary.mean) : fmt(summary.mean);
  const median = asPct ? fmtPct(summary.median) : fmt(summary.median);
  const stdev = asPct ? fmtPct(summary.stdev) : fmt(summary.stdev);
  return [
    `${label.padEnd(24)} mean=${mean}  median=${median}  stdev=${stdev}`,
    `${"".padEnd(24)} min=${asPct ? fmtPct(summary.min) : fmt(summary.min)}  max=${asPct ? fmtPct(summary.max) : fmt(summary.max)}`,
  ].join("\n");
}

function section(title: string): string {
  return `${title}\n${"-".repeat(40)}`;
}

function verdictLine(check: CheckResult): string {
  return `${check.name.padEnd(24)} ${check.verdict.padEnd(7)} ${check.message}`;
}

export function formatValidationReport(result: ValidationRunResult): string {
  const a = result.aggregates;
  const lines: string[] = [
    "========================================",
    "SIMULATION STATISTICAL VALIDATION",
    "========================================",
    "",
    `Games simulated: ${result.gamesSimulated.toLocaleString()}`,
    `Seed: ${result.seed}`,
    `Checksum: ${result.checksum}`,
    "",
    section("SCORING"),
    lineMetric("Avg team points", a.teamPoints),
    lineMetric("Avg game total", a.gameTotals),
    lineMetric("Abs differential", a.absoluteDifferentials),
    "",
    section("PACE"),
    lineMetric("Possessions/team", a.possessionsPerTeam),
    lineMetric("PPP (diagnostic)", a.pointsPerPossession),
    "(PPP has no PASS/WARNING/FAIL band — separates pace vs efficiency.)",
    "",
    section("SHOOTING"),
    lineMetric("FG% (per game)", a.fieldGoalPct, true),
    lineMetric("3PT% (per game)", a.threePointPct, true),
    lineMetric("FT% (per game)", a.freeThrowPct, true),
    `Pooled FG%:             ${fmtPct(a.pooledShooting.fieldGoalPct)} (${a.pooledShooting.fieldGoalsMade}/${a.pooledShooting.fieldGoalsAttempted})`,
    `Pooled 3PT%:            ${fmtPct(a.pooledShooting.threePointPct)} (${a.pooledShooting.threePointersMade}/${a.pooledShooting.threePointersAttempted})`,
    `Pooled FT%:             ${fmtPct(a.pooledShooting.freeThrowPct)} (${a.pooledShooting.freeThrowsMade}/${a.pooledShooting.freeThrowsAttempted})`,
    "",
    section("REBOUNDING"),
    lineMetric("Offensive rebounds", a.offensiveRebounds),
    lineMetric("Defensive rebounds", a.defensiveRebounds),
    lineMetric("Total rebounds", a.totalRebounds),
    "",
    section("PLAYMAKING / POSSESSION"),
    lineMetric("Assists", a.assists),
    lineMetric("Turnovers", a.turnovers),
    lineMetric("AST/FGM", a.assistToFgmRatio),
    "",
    section("FOULS"),
    lineMetric("Fouls", a.fouls),
    lineMetric("FTA", a.freeThrowAttempts),
    "",
    section("HOME / AWAY"),
    `Home win rate:          ${fmtPct(a.homeAway.homeWinRate)} (${a.homeAway.homeWins}-${a.homeAway.awayWins})`,
    `Home points:            ${fmt(a.homeAway.homePoints.mean)}`,
    `Away points:            ${fmt(a.homeAway.awayPoints.mean)}`,
    `Home FG%:               ${fmtPct(a.homeAway.homeFieldGoalPct.mean)}`,
    `Away FG%:               ${fmtPct(a.homeAway.awayFieldGoalPct.mean)}`,
    `Home 3PT%:              ${fmtPct(a.homeAway.homeThreePointPct.mean)}`,
    `Away 3PT%:              ${fmtPct(a.homeAway.awayThreePointPct.mean)}`,
    `Home turnovers:         ${fmt(a.homeAway.homeTurnovers.mean)}`,
    `Away turnovers:         ${fmt(a.homeAway.awayTurnovers.mean)}`,
    "",
    section("CORRELATIONS (player-level; weak r never FAILs)"),
    ...result.correlations.map((c) => formatCorrelation(c)),
    "",
    section("VALIDATION"),
    `Internal consistency:   ${result.invariantFailures.length === 0 ? "PASS" : "FAIL"} (${result.invariantFailures.length} failures)`,
    ...result.plausibilityChecks.map((check) => verdictLine(check)),
    "",
    section("OVERALL"),
    result.overallVerdict,
  ];

  if (result.matchup) {
    lines.push("", formatMatchupSection(result.matchup));
  }

  if (result.invariantFailures.length > 0) {
    lines.push(
      "",
      section("INVARIANT FAILURES (sample)"),
      ...result.invariantFailures.slice(0, 20).map(
        (failure) =>
          `${failure.gameId} ${failure.side ?? ""} ${failure.rule}: ${failure.detail}`,
      ),
    );
  }

  return lines.join("\n");
}

function formatCorrelation(corr: CorrelationResult): string {
  const r =
    corr.pearsonR === null ? "n/a" : corr.pearsonR.toFixed(3);
  return `${corr.name.padEnd(32)} r=${r.padStart(7)}  ${corr.verdict}  ${corr.message}`;
}

function formatMatchupSection(matchup: MatchupDiagnosticResult): string {
  return [
    "========================================",
    "SECONDARY DIAGNOSTIC (constructed matchup)",
    "Not pooled into primary aggregates.",
    "========================================",
    `Games:                  ${matchup.games}`,
    `Strong offense PTS:     ${fmt(matchup.offenseStrongMeanPoints)}`,
    `Weak offense PTS:       ${fmt(matchup.offenseWeakMeanPoints)}`,
    `Offense advantage:      ${fmt(matchup.offenseAdvantage)}`,
    `Strong defense opp PTS: ${fmt(matchup.defenseStrongOpponentPoints)}`,
    `Weak defense opp PTS:   ${fmt(matchup.defenseWeakOpponentPoints)}`,
    `Defense advantage:      ${fmt(matchup.defenseAdvantage)} (lower opp pts is better)`,
    `Verdict:                ${matchup.verdict}`,
    matchup.message,
  ].join("\n");
}

export function formatAggregatesBrief(aggregates: ValidationAggregates): string {
  return `games=${aggregates.gamesSimulated} teamPts=${fmt(aggregates.teamPoints.mean)} poss=${fmt(aggregates.possessionsPerTeam.mean)} FG%=${fmtPct(aggregates.fieldGoalPct.mean)}`;
}
