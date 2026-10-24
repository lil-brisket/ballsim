/**
 * Pure part of the offseason balance bands: raw sample types, aggregation,
 * the tolerance rule and the baseline comparison. No engine imports, so the
 * unit tests stay fast. See `metrics.ts` for the collection from real runs.
 */

export const OVERALL_AGE_BUCKETS = [
  "<=22",
  "23-26",
  "27-30",
  "31-33",
  "34+",
] as const;
export const SALARY_TIERS = ["<60", "60-69", "70-79", "80+"] as const;
export const PICK_GROUPS = ["1-3", "4-8", "9-14", "15-24"] as const;

/** Annual overall change cap of the development system. */
export const ANNUAL_OVERALL_CAP = 5;

export type SalaryTier = (typeof SALARY_TIERS)[number];
export type PickGroup = (typeof PICK_GROUPS)[number];

export type TeamSeasonSample = {
  /** Regular-season win percentage at postseason.season_review. */
  winPct: number;
  /** Payroll in dollars for that season. */
  payroll: number;
  /** Business funds in dollars at postseason.season_review. */
  cash: number;
};

/** One full season plus the offseason that follows it. */
export type SeasonSample = {
  /** 1-based. */
  seasonIndex: number;
  seasonYear: number;
  /** Players present at season_transition and roster_decisions. */
  development: Array<{ bucket: string; change: number }>;
  /** Team-seasons at postseason.season_review. */
  teams: TeamSeasonSample[];
  /** Each team's business funds ($) at the start of preseason.preparation. */
  cashAfterOffseason: number[];
  /** Free agents when preseason.preparation starts, and those with overall >= 60. */
  unsignedAtPreseason: number;
  unsignedAtPreseason60Plus: number;
  /** Players signed out of the pool in free agency: tier and new-season salary ($). */
  faSignings: Array<{ tier: string; salary: number }>;
  /**
   * Best free agent at free_agency start: whether he was signed by
   * staff_development start and, if so, whether his team had the highest
   * payroll at free_agency start. null: no free agents.
   */
  topFa: { signed: boolean; toHighestPayroll: boolean } | null;
  /** Players with overall >= 80 at the next preseason start. */
  starTotal: number;
  starMaxOnOneTeam: number;
  /** Players with overall >= 80 held by the four teams holding the most. */
  starTop4Count: number;
  /** Per team: share of the previous preseason roster no longer on that team. */
  rosterTurnover: number[];
  /** Overall of each player picked, by overall pick, when drafted. */
  rookies: Array<{ pick: number; overall: number }>;
  /** Picks 1-5: still on the drafting team and in its top 5 by overall at the next preseason start. */
  top5Picks: Array<{ pick: number; starter: boolean }>;
};

export type SeedSamples = {
  seed: number;
  /** Players with overall >= 90 at each preseason start (length seasons + 1). */
  overall90PlusSeries: number[];
  seasons: SeasonSample[];
};

export type MetricUnit = "overall" | "share" | "count" | "$M" | "r";

export type MetricValues = Record<string, number>;

export type MetricSpec = {
  name: string;
  unit: MetricUnit;
  /** Absolute tolerance floor. Raise it only with a justification in `floorNote`. */
  floor: number;
  description: string;
  floorNote?: string;
  /**
   * The metric needs a rare event (for example an 80+ free agent signing), so
   * a run without one measures nothing. Missing is then skipped, not a failure.
   */
  sparse?: boolean;
};

// ---------------------------------------------------------------------------
// Numeric helpers

export function mean(values: readonly number[]): number {
  if (values.length === 0) return Number.NaN;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Sample standard deviation (n - 1); 0 for fewer than two values. */
export function stdev(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance =
    values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/** Pearson correlation; NaN when undefined (fewer than 2 points or no variance). */
export function pearson(xs: readonly number[], ys: readonly number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return Number.NaN;
  const mx = mean(xs.slice(0, n));
  const my = mean(ys.slice(0, n));
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i]! - mx;
    const dy = ys[i]! - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return Number.NaN;
  return sxy / Math.sqrt(sxx * syy);
}

export function salaryTier(overall: number): SalaryTier {
  if (overall < 60) return "<60";
  if (overall < 70) return "60-69";
  if (overall < 80) return "70-79";
  return "80+";
}

export function pickGroup(overallPick: number): PickGroup | null {
  if (overallPick >= 1 && overallPick <= 3) return "1-3";
  if (overallPick <= 8 && overallPick >= 4) return "4-8";
  if (overallPick <= 14 && overallPick >= 9) return "9-14";
  if (overallPick <= 24 && overallPick >= 15) return "15-24";
  return null;
}

// ---------------------------------------------------------------------------
// Metric catalogue

export const METRIC_SPECS: readonly MetricSpec[] = [
  ...OVERALL_AGE_BUCKETS.map((bucket): MetricSpec => ({
    name: `meanOverallChange[${bucket}]`,
    unit: "overall",
    floor: 0.25,
    description: `Mean overall change through one development step for players aged ${bucket} (age before).`,
  })),
  {
    name: "shareGain3Plus",
    unit: "share",
    floor: 0.05,
    description: "Share of developing players with overall change >= +3.",
  },
  {
    name: "shareLose3Plus",
    unit: "share",
    floor: 0.05,
    description: "Share of developing players with overall change <= -3.",
  },
  {
    name: "shareGainAtCap",
    unit: "share",
    floor: 0.05,
    description: `Share of developing players at exactly +${ANNUAL_OVERALL_CAP} (the annual cap).`,
  },
  {
    name: "shareLoseAtCap",
    unit: "share",
    floor: 0.05,
    description: `Share of developing players at exactly -${ANNUAL_OVERALL_CAP} (the annual cap).`,
  },
  {
    name: "overall90Plus[first]",
    unit: "count",
    floor: 1,
    description: "Players with overall >= 90 at the first preseason start.",
  },
  {
    name: "overall90Plus[last]",
    unit: "count",
    floor: 1,
    description: "Players with overall >= 90 at the last preseason start.",
  },
  {
    name: "overall90Plus[max]",
    unit: "count",
    floor: 1,
    description: "Most players with overall >= 90 at any preseason start.",
  },
  {
    name: "unsignedAtPreseason",
    unit: "count",
    floor: 1,
    description:
      "Free agents in the pool at the start of preseason.preparation.",
  },
  {
    name: "unsignedAtPreseason60Plus",
    unit: "count",
    floor: 1,
    description:
      "Free agents with overall >= 60 in the pool at the start of preseason.preparation.",
  },
  ...SALARY_TIERS.map((tier): MetricSpec => ({
    name: `meanSalaryByTier[${tier}]`,
    unit: "$M",
    floor: 0.25,
    sparse: true,
    floorNote:
      "Sparse: a seed with no signing in this tier measures nothing, so a run without one is skipped, not failed.",
    description: `Mean new-season salary of players signed from the pool in free agency, overall ${tier}.`,
  })),
  {
    name: "topFaSignsWithHighestPayroll",
    unit: "share",
    floor: 0.05,
    description:
      "Offseasons where the best free agent signed with the team that had the league's highest payroll at free_agency start (of offseasons where he signed).",
  },
  {
    name: "starMaxOnOneTeam",
    unit: "count",
    floor: 1,
    description:
      "Most players with overall >= 80 on one team at preseason start (mean over seasons).",
  },
  {
    name: "starTop4TeamsShare",
    unit: "share",
    floor: 0.05,
    description:
      "Share of players with overall >= 80 held by the four teams holding the most, at preseason start (an even spread over 12 teams is 0.33).",
  },
  {
    name: "meanRosterTurnover",
    unit: "share",
    floor: 0.05,
    description:
      "Per team, share of the previous preseason-start roster not on the same team at the next preseason start.",
  },
  {
    name: "payrollWinPctCorrelation",
    unit: "r",
    floor: 0.1,
    description:
      "Pearson r of payroll and regular-season win % across team-seasons (per seed, then averaged).",
  },
  {
    name: "insolvencyRate",
    unit: "share",
    floor: 0.05,
    description:
      "Share of team-seasons with business funds below 0 at postseason.season_review.",
  },
  {
    name: "meanCashAfterOffseason",
    unit: "$M",
    floor: 1,
    description:
      "Mean team business funds at the start of preseason.preparation.",
  },
  {
    name: "meanPayroll",
    unit: "$M",
    floor: 1,
    description:
      "Mean team payroll for the season at postseason.season_review.",
  },
  ...PICK_GROUPS.map((group): MetricSpec => ({
    name: `meanRookieOverall[${group}]`,
    unit: "overall",
    floor: 0.5,
    description: `Mean overall, when drafted, of overall picks ${group}.`,
  })),
  {
    name: "shareTop5PicksStarters",
    unit: "share",
    floor: 0.05,
    description:
      "Share of overall picks 1-5 still on the drafting team and in its top 5 by overall at the next preseason start.",
  },
];

export function specFor(name: string): MetricSpec | undefined {
  return METRIC_SPECS.find((spec) => spec.name === name);
}

// ---------------------------------------------------------------------------
// Aggregation

function pooled<T>(
  seasons: readonly SeasonSample[],
  pick: (s: SeasonSample) => T[],
): T[] {
  return seasons.flatMap(pick);
}

function share(values: readonly boolean[]): number {
  return values.length === 0
    ? Number.NaN
    : values.filter(Boolean).length / values.length;
}

/** Metrics of one seed (pooled over its seasons). NaN entries are dropped. */
export function metricsForSeed(samples: SeedSamples): MetricValues {
  const out: MetricValues = {};
  const set = (name: string, value: number) => {
    if (Number.isFinite(value)) out[name] = value;
  };
  const seasons = samples.seasons;

  const dev = pooled(seasons, (s) => s.development);
  for (const bucket of OVERALL_AGE_BUCKETS) {
    set(
      `meanOverallChange[${bucket}]`,
      mean(dev.filter((d) => d.bucket === bucket).map((d) => d.change)),
    );
  }
  set("shareGain3Plus", share(dev.map((d) => d.change >= 3)));
  set("shareLose3Plus", share(dev.map((d) => d.change <= -3)));
  set("shareGainAtCap", share(dev.map((d) => d.change >= ANNUAL_OVERALL_CAP)));
  set("shareLoseAtCap", share(dev.map((d) => d.change <= -ANNUAL_OVERALL_CAP)));

  const series = samples.overall90PlusSeries;
  if (series.length > 0) {
    set("overall90Plus[first]", series[0]!);
    set("overall90Plus[last]", series[series.length - 1]!);
    set("overall90Plus[max]", Math.max(...series));
  }

  set("unsignedAtPreseason", mean(seasons.map((s) => s.unsignedAtPreseason)));
  set(
    "unsignedAtPreseason60Plus",
    mean(seasons.map((s) => s.unsignedAtPreseason60Plus)),
  );

  const signings = pooled(seasons, (s) => s.faSignings);
  for (const tier of SALARY_TIERS) {
    set(
      `meanSalaryByTier[${tier}]`,
      mean(signings.filter((x) => x.tier === tier).map((x) => x.salary)) /
        1_000_000,
    );
  }
  const signedTop = seasons
    .map((s) => s.topFa)
    .filter((t): t is NonNullable<typeof t> => t !== null && t.signed);
  set(
    "topFaSignsWithHighestPayroll",
    share(signedTop.map((t) => t.toHighestPayroll)),
  );

  set("starMaxOnOneTeam", mean(seasons.map((s) => s.starMaxOnOneTeam)));
  const starTotal = seasons.reduce((sum, s) => sum + s.starTotal, 0);
  set(
    "starTop4TeamsShare",
    starTotal === 0
      ? Number.NaN
      : seasons.reduce((sum, s) => sum + s.starTop4Count, 0) / starTotal,
  );

  set("meanRosterTurnover", mean(pooled(seasons, (s) => s.rosterTurnover)));

  const teams = pooled(seasons, (s) => s.teams);
  set(
    "payrollWinPctCorrelation",
    pearson(
      teams.map((t) => t.payroll),
      teams.map((t) => t.winPct),
    ),
  );
  set("insolvencyRate", share(teams.map((t) => t.cash < 0)));
  set(
    "meanCashAfterOffseason",
    mean(pooled(seasons, (s) => s.cashAfterOffseason)) / 1_000_000,
  );
  set("meanPayroll", mean(teams.map((t) => t.payroll)) / 1_000_000);

  const rookies = pooled(seasons, (s) => s.rookies);
  for (const group of PICK_GROUPS) {
    set(
      `meanRookieOverall[${group}]`,
      mean(
        rookies
          .filter((r) => pickGroup(r.pick) === group)
          .map((r) => r.overall),
      ),
    );
  }
  set(
    "shareTop5PicksStarters",
    share(pooled(seasons, (s) => s.top5Picks).map((p) => p.starter)),
  );
  return out;
}

/** Per-seed metric values, in the order of `samplesBySeed`. */
export function metricsPerSeed(
  samplesBySeed: readonly SeedSamples[],
): MetricValues[] {
  return samplesBySeed.map(metricsForSeed);
}

function metricNames(perSeed: readonly MetricValues[]): string[] {
  const names = new Set<string>();
  for (const values of perSeed) {
    for (const name of Object.keys(values)) names.add(name);
  }
  const catalogue = METRIC_SPECS.map((spec) => spec.name);
  return [
    ...catalogue.filter((name) => names.has(name)),
    ...[...names].filter((name) => !catalogue.includes(name)).sort(),
  ];
}

/** Mean of each metric across seeds (seeds lacking the metric are skipped). */
export function aggregatePerSeed(
  perSeed: readonly MetricValues[],
): MetricValues {
  const out: MetricValues = {};
  for (const name of metricNames(perSeed)) {
    out[name] = mean(
      perSeed.map((v) => v[name]).filter((v): v is number => v !== undefined),
    );
  }
  return out;
}

/** Standard deviation of each metric across seeds. */
export function stdevPerSeed(perSeed: readonly MetricValues[]): MetricValues {
  const out: MetricValues = {};
  for (const name of metricNames(perSeed)) {
    out[name] = stdev(
      perSeed.map((v) => v[name]).filter((v): v is number => v !== undefined),
    );
  }
  return out;
}

export function aggregateMetrics(
  samplesBySeed: readonly SeedSamples[],
): MetricValues {
  return aggregatePerSeed(metricsPerSeed(samplesBySeed));
}

// ---------------------------------------------------------------------------
// Tolerance and baseline

/**
 * Half-width of a metric's band: three standard deviations across seeds,
 * never below the metric's absolute floor. Money and counts scale with the
 * league, so they also get 10% of the baseline; ratings, shares and
 * correlations do not (10% of a 73 overall would be a 7-point band).
 */
export function toleranceFor(input: {
  stdevAcrossSeeds: number;
  baseline: number;
  absoluteFloor: number;
  unit?: MetricUnit;
}): number {
  const relative =
    input.unit === "$M" || input.unit === "count"
      ? 0.1 * Math.abs(input.baseline)
      : 0;
  return Math.max(3 * input.stdevAcrossSeeds, relative, input.absoluteFloor);
}

export type BaselineMetric = {
  value: number;
  tolerance: number;
  unit: string;
  note: string;
};

export type BaselineFile = {
  generatedWith: { seeds: number; seasons: number; seedStart: number };
  metrics: Record<string, BaselineMetric>;
};

export const MIN_BASELINE_SEEDS = 3;

function round(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

export function buildBaseline(input: {
  perSeed: readonly MetricValues[];
  seeds: number;
  seasons: number;
  seedStart: number;
}): BaselineFile {
  if (input.perSeed.length < MIN_BASELINE_SEEDS) {
    throw new Error(
      `Writing a baseline needs at least ${MIN_BASELINE_SEEDS} seeds (got ${input.perSeed.length}); the tolerance comes from the spread across seeds.`,
    );
  }
  const means = aggregatePerSeed(input.perSeed);
  const sds = stdevPerSeed(input.perSeed);
  const metrics: Record<string, BaselineMetric> = {};
  for (const [name, value] of Object.entries(means)) {
    const spec = specFor(name);
    const tolerance = toleranceFor({
      stdevAcrossSeeds: sds[name] ?? 0,
      baseline: value,
      absoluteFloor: spec?.floor ?? 0,
      unit: spec?.unit,
    });
    metrics[name] = {
      value: round(value, 4),
      tolerance: round(tolerance, 4),
      unit: spec?.unit ?? "",
      note: [spec?.description ?? "", spec?.floorNote ?? ""]
        .filter((part) => part !== "")
        .join(" "),
    };
  }
  return {
    generatedWith: {
      seeds: input.seeds,
      seasons: input.seasons,
      seedStart: input.seedStart,
    },
    metrics,
  };
}

export type MetricStatus = "ok" | "outside" | "missing" | "skipped" | "new";

export type MetricComparison = {
  name: string;
  baseline: number | null;
  current: number | null;
  tolerance: number | null;
  unit: string;
  status: MetricStatus;
};

export function compareToBaseline(
  baseline: BaselineFile,
  current: MetricValues,
): MetricComparison[] {
  const rows: MetricComparison[] = [];
  for (const [name, entry] of Object.entries(baseline.metrics)) {
    const value = current[name];
    const present = value !== undefined && Number.isFinite(value);
    rows.push({
      name,
      baseline: entry.value,
      current: present ? value : null,
      tolerance: entry.tolerance,
      unit: entry.unit,
      status: !present
        ? specFor(name)?.sparse === true
          ? "skipped"
          : "missing"
        : Math.abs(value - entry.value) <= entry.tolerance
          ? "ok"
          : "outside",
    });
  }
  for (const [name, value] of Object.entries(current)) {
    if (baseline.metrics[name] !== undefined || !Number.isFinite(value)) {
      continue;
    }
    rows.push({
      name,
      baseline: null,
      current: value,
      tolerance: null,
      unit: specFor(name)?.unit ?? "",
      status: "new",
    });
  }
  return rows;
}

function fmt(value: number): string {
  return String(round(value, 3));
}

/** One readable line per failing metric. New metrics do not fail. */
export function failureMessages(
  rows: readonly MetricComparison[],
  baselinePath: string,
): string[] {
  const hint =
    "If this change is intentional, rerun with --write-baseline and commit the baseline on its own.";
  const messages: string[] = [];
  for (const row of rows) {
    if (row.status === "outside") {
      messages.push(
        `${row.name} ${fmt(row.current!)} is outside ${fmt(row.baseline!)} +/- ${fmt(row.tolerance!)} (baseline ${baselinePath}). ${hint}`,
      );
    } else if (row.status === "missing") {
      messages.push(
        `${row.name} was not measured but the baseline expects ${fmt(row.baseline!)} +/- ${fmt(row.tolerance!)} (baseline ${baselinePath}). ${hint}`,
      );
    }
  }
  return messages;
}
