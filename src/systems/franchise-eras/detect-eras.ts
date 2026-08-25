/**
 * Deterministic franchise era detection (v1).
 * Derived from FranchiseHistory — not stored inside history.
 */

import {
  isPlayoffAppearance,
  type FranchiseSeasonRecord,
} from "@/domain/entities/franchise-history";
import {
  FRANCHISE_ERA_LABELS,
  type EraDriver,
  type EraStrength,
  type FranchiseEra,
  type FranchiseEraClassification,
  type FranchiseEraTransition,
} from "@/domain/entities/franchise-era";

const MIN_ERA_LENGTH = 2;

type SeasonSignals = {
  seasonYear: number;
  winPct: number;
  playoff: boolean;
  championship: boolean;
  netIncome: number;
  cash: number;
  franchiseValue: number;
  meanFacility: number;
  attendance: number | null;
  financialStress: boolean;
};

function winPct(wins: number, losses: number): number {
  const games = wins + losses;
  return games === 0 ? 0 : wins / games;
}

function meanFacility(levels: FranchiseSeasonRecord["facilityLevels"]): number {
  const values = Object.values(levels);
  if (values.length === 0) return 1;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function toSignals(season: FranchiseSeasonRecord): SeasonSignals {
  return {
    seasonYear: season.seasonYear,
    winPct: winPct(season.wins, season.losses),
    playoff: isPlayoffAppearance(season.playoffResult),
    championship: season.championship,
    netIncome: season.netIncome,
    cash: season.cash,
    franchiseValue: season.franchiseValue,
    meanFacility: meanFacility(season.facilityLevels),
    attendance: season.attendance,
    financialStress: season.cash <= 0 || season.netIncome < -20_000_000,
  };
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function classifyWindow(
  window: SeasonSignals[],
  priorWinPct: number | null,
  franchiseAge: number,
): { classification: FranchiseEraClassification; confidence: number; drivers: EraDriver[]; signals: Record<string, number> } {
  const win = mean(window.map((s) => s.winPct));
  const playoffRate =
    window.filter((s) => s.playoff).length / Math.max(1, window.length);
  const titles = window.filter((s) => s.championship).length;
  const stressRate =
    window.filter((s) => s.financialStress).length / Math.max(1, window.length);
  const valueTrend =
    window.length >= 2
      ? window[window.length - 1]!.franchiseValue /
          Math.max(1, window[0]!.franchiseValue) -
        1
      : 0;

  const signals = {
    winPct: win,
    playoffRate,
    titles,
    stressRate,
    valueTrend,
    franchiseAge,
  };

  if (franchiseAge <= 2 && window[0]!.seasonYear === window[window.length - 1]!.seasonYear || franchiseAge <= 2) {
    // Prefer new_franchise for earliest seasons only when age is small
  }

  if (stressRate >= 0.5) {
    return {
      classification: "financial_crisis",
      confidence: Math.min(1, 0.55 + stressRate * 0.4),
      drivers: [
        {
          signal: "financial_stress_rate",
          value: stressRate,
          description: `${Math.round(stressRate * 100)}% of seasons under financial stress`,
        },
      ],
      signals,
    };
  }

  if (franchiseAge <= 2 && win < 0.45) {
    return {
      classification: "new_franchise",
      confidence: 0.7,
      drivers: [
        {
          signal: "franchise_age",
          value: franchiseAge,
          description: `Franchise age ${franchiseAge} seasons`,
        },
      ],
      signals,
    };
  }

  if (titles >= 1 && playoffRate >= 0.75 && win >= 0.55) {
    const confidence = Math.min(
      1,
      0.55 + titles * 0.15 + (win - 0.55) + playoffRate * 0.2,
    );
    return {
      classification: "golden_era",
      confidence,
      drivers: [
        {
          signal: "championships",
          value: titles,
          description: `${titles} championship(s) in window`,
        },
        {
          signal: "playoff_rate",
          value: playoffRate,
          description: `${Math.round(playoffRate * 100)}% playoff rate`,
        },
        {
          signal: "win_pct",
          value: win,
          description: `Mean win% ${win.toFixed(3)}`,
        },
      ],
      signals,
    };
  }

  if (playoffRate >= 0.6 && win >= 0.55) {
    return {
      classification: "contender",
      confidence: Math.min(1, 0.5 + playoffRate * 0.3 + (win - 0.5)),
      drivers: [
        {
          signal: "win_pct",
          value: win,
          description: `Mean win% ${win.toFixed(3)}`,
        },
        {
          signal: "playoff_rate",
          value: playoffRate,
          description: `${Math.round(playoffRate * 100)}% playoff appearances`,
        },
      ],
      signals,
    };
  }

  if (playoffRate >= 0.4 && win >= 0.48) {
    return {
      classification: "competitive_window",
      confidence: Math.min(1, 0.45 + playoffRate * 0.35),
      drivers: [
        {
          signal: "playoff_rate",
          value: playoffRate,
          description: `${Math.round(playoffRate * 100)}% playoff rate`,
        },
      ],
      signals,
    };
  }

  if (priorWinPct !== null && win <= priorWinPct - 0.08 && win < 0.48) {
    return {
      classification: "decline",
      confidence: Math.min(1, 0.5 + (priorWinPct - win)),
      drivers: [
        {
          signal: "win_pct_drop",
          value: priorWinPct - win,
          description: `Win% dropped ${(priorWinPct - win).toFixed(3)} from prior window`,
        },
      ],
      signals,
    };
  }

  if (win < 0.4) {
    return {
      classification: "rebuilding",
      confidence: Math.min(1, 0.5 + (0.4 - win)),
      drivers: [
        {
          signal: "win_pct",
          value: win,
          description: `Sub-.400 win% (${win.toFixed(3)})`,
        },
      ],
      signals,
    };
  }

  if (
    priorWinPct !== null &&
    (priorWinPct < 0.42 || stressRate > 0) &&
    win >= priorWinPct + 0.06
  ) {
    return {
      classification: "recovery",
      confidence: Math.min(1, 0.5 + (win - priorWinPct)),
      drivers: [
        {
          signal: "win_pct_rise",
          value: win - priorWinPct,
          description: `Win% improved ${(win - priorWinPct).toFixed(3)}`,
        },
      ],
      signals,
    };
  }

  // Default: competitive window if playoffs at all, else rebuilding-ish middle
  if (playoffRate > 0) {
    return {
      classification: "competitive_window",
      confidence: 0.4,
      drivers: [
        {
          signal: "playoff_rate",
          value: playoffRate,
          description: "Some playoff appearances",
        },
      ],
      signals,
    };
  }

  return {
    classification: "rebuilding",
    confidence: 0.35,
    drivers: [
      {
        signal: "win_pct",
        value: win,
        description: `Modest win% without playoffs (${win.toFixed(3)})`,
      },
    ],
    signals,
  };
}

function strengthFromConfidence(confidence: number): EraStrength {
  if (confidence >= 0.75) return "strong";
  if (confidence >= 0.55) return "moderate";
  return "weak";
}

/** Hysteresis: ending a strong era requires clearer contrary evidence. */
function shouldEndEra(
  current: FranchiseEraClassification,
  next: FranchiseEraClassification,
  currentConfidence: number,
  nextConfidence: number,
): boolean {
  if (current === next) return false;
  // Strong eras harder to leave
  if (currentConfidence >= 0.7 && nextConfidence < currentConfidence - 0.15) {
    return false;
  }
  // Golden / contender need stronger drop
  if (
    (current === "golden_era" || current === "contender") &&
    nextConfidence < 0.55 &&
    next !== "financial_crisis" &&
    next !== "decline"
  ) {
    return false;
  }
  return true;
}

/**
 * Detect eras across completed franchise history.
 */
export function detectFranchiseEras(
  seasons: readonly FranchiseSeasonRecord[],
  options: { foundedSeasonYear?: number } = {},
): { eras: FranchiseEra[]; transitions: FranchiseEraTransition[] } {
  if (seasons.length === 0) {
    return { eras: [], transitions: [] };
  }
  const ordered = [...seasons].sort((a, b) => a.seasonYear - b.seasonYear);
  const signals = ordered.map(toSignals);
  const founded = options.foundedSeasonYear ?? ordered[0]!.seasonYear;

  const eras: FranchiseEra[] = [];
  const transitions: FranchiseEraTransition[] = [];

  let windowStart = 0;
  let currentClass: FranchiseEraClassification | null = null;
  let currentConfidence = 0;
  let currentDrivers: EraDriver[] = [];
  let currentSignals: Record<string, number> = {};

  const flush = (endIndex: number, open: boolean) => {
    if (currentClass === null) return;
    const slice = signals.slice(windowStart, endIndex + 1);
    if (slice.length === 0) return;
    // Enforce min length except new_franchise / financial_crisis single championship edges
    if (
      slice.length < MIN_ERA_LENGTH &&
      currentClass !== "new_franchise" &&
      currentClass !== "financial_crisis" &&
      !slice.some((s) => s.championship)
    ) {
      return;
    }
    eras.push({
      classification: currentClass,
      label: FRANCHISE_ERA_LABELS[currentClass],
      confidence: currentConfidence,
      strength: strengthFromConfidence(currentConfidence),
      startSeasonYear: slice[0]!.seasonYear,
      endSeasonYear: open ? null : slice[slice.length - 1]!.seasonYear,
      drivers: currentDrivers,
      explanation: currentDrivers.map((d) => d.description),
      signals: currentSignals,
    });
  };

  for (let i = 0; i < signals.length; i += 1) {
    const lookbackStart = Math.max(0, i - 2);
    const window = signals.slice(lookbackStart, i + 1);
    const priorWindow =
      lookbackStart > 0
        ? signals.slice(Math.max(0, lookbackStart - 3), lookbackStart)
        : [];
    const priorWin =
      priorWindow.length > 0
        ? mean(priorWindow.map((s) => s.winPct))
        : null;
    const age = signals[i]!.seasonYear - founded + 1;
    const classified = classifyWindow(window, priorWin, age);

    if (currentClass === null) {
      currentClass = classified.classification;
      currentConfidence = classified.confidence;
      currentDrivers = classified.drivers;
      currentSignals = classified.signals;
      windowStart = i;
      continue;
    }

    if (
      classified.classification !== currentClass &&
      shouldEndEra(
        currentClass,
        classified.classification,
        currentConfidence,
        classified.confidence,
      )
    ) {
      // Close previous era at i-1
      flush(i - 1, false);
      transitions.push({
        from: currentClass,
        to: classified.classification,
        seasonYear: signals[i]!.seasonYear,
        message: `${FRANCHISE_ERA_LABELS[currentClass]} → ${FRANCHISE_ERA_LABELS[classified.classification]}`,
        drivers: classified.drivers,
      });
      currentClass = classified.classification;
      currentConfidence = classified.confidence;
      currentDrivers = classified.drivers;
      currentSignals = classified.signals;
      windowStart = i;
    } else if (classified.classification === currentClass) {
      // Reinforce
      currentConfidence = Math.max(currentConfidence, classified.confidence);
      currentDrivers = classified.drivers;
      currentSignals = classified.signals;
    }
  }

  flush(signals.length - 1, true);

  // Merge adjacent same classification (hysteresis residue)
  const merged: FranchiseEra[] = [];
  for (const era of eras) {
    const last = merged[merged.length - 1];
    if (last && last.classification === era.classification) {
      last.endSeasonYear = era.endSeasonYear;
      last.confidence = Math.max(last.confidence, era.confidence);
      last.strength = strengthFromConfidence(last.confidence);
      last.drivers = era.drivers;
      last.explanation = era.explanation;
      last.signals = era.signals;
    } else {
      merged.push({ ...era });
    }
  }

  return { eras: merged, transitions };
}

export function currentFranchiseEra(
  seasons: readonly FranchiseSeasonRecord[],
  options: { foundedSeasonYear?: number } = {},
): FranchiseEra | null {
  const { eras } = detectFranchiseEras(seasons, options);
  return eras.length === 0 ? null : eras[eras.length - 1]!;
}
