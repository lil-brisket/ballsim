"use client";

import { useState } from "react";
import type {
  OwnerDashboardHealth,
  OwnerDashboardInsight,
} from "@/state/owner-dashboard";
import type {
  DimensionHealth,
  FranchiseHealthDimensionKey,
  FranchiseHealthView,
  HealthDriver,
} from "@/state/franchise-health";
import {
  formatDimensionStatus,
  trendSymbol,
} from "@/state/franchise-health";
import type { FranchiseValueDriverKey } from "@/state/franchise-value";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import {
  HealthToneBadge,
  MetricBlock,
  MoneyMetric,
} from "@/components/owner/dashboard/MetricBlock";

const STANDING_LABEL: Record<string, string> = {
  emerging: "Emerging",
  established: "Established",
  major: "Major",
  elite: "Elite",
  legacy: "Legacy",
};

const DRIVER_LABEL: Record<FranchiseValueDriverKey, string> = {
  market: "Market",
  facilities: "Facilities",
  brand: "Brand",
  fanBase: "Fan base",
  revenue: "Revenue",
  profitability: "Profitability",
  cash: "Cash",
  performance: "Performance",
  championships: "Championships",
};

const DIMENSION_ORDER: FranchiseHealthDimensionKey[] = [
  "competitive",
  "financial",
  "commercial",
  "fan",
  "organizational",
  "strategic",
];

const DIMENSION_TITLE: Record<FranchiseHealthDimensionKey, string> = {
  competitive: "Competitive",
  financial: "Financial",
  commercial: "Commercial",
  fan: "Fan",
  organizational: "Organizational",
  strategic: "Strategic",
};

function franchiseValueContext(health: OwnerDashboardHealth): string {
  const standing =
    STANDING_LABEL[health.franchiseStanding] ?? health.franchiseStanding;
  const parts = [standing];
  if (health.topPositiveDriver) {
    parts.push(`Strength: ${DRIVER_LABEL[health.topPositiveDriver]}`);
  }
  if (health.topNegativeDriver) {
    parts.push(`Weakness: ${DRIVER_LABEL[health.topNegativeDriver]}`);
  }
  return parts.join(" · ");
}

function conditionToneClass(condition: FranchiseHealthView["condition"]): string {
  if (condition === "excellent" || condition === "strong") {
    return "text-emerald-400";
  }
  if (condition === "adequate") {
    return "text-zinc-200";
  }
  if (condition === "concerning") {
    return "text-amber-400";
  }
  return "text-rose-400";
}

function DimensionRow(props: {
  dimensionKey: FranchiseHealthDimensionKey;
  dimension: DimensionHealth;
  selected: boolean;
  onSelect: () => void;
}) {
  const { dimension } = props;
  const symbol = trendSymbol(dimension.trend);
  return (
    <button
      type="button"
      onClick={props.onSelect}
      className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
        props.selected
          ? "bg-zinc-800/80 ring-1 ring-amber-500/40"
          : "hover:bg-zinc-800/40"
      }`}
    >
      <span className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-zinc-400">
        {DIMENSION_TITLE[props.dimensionKey]}
      </span>
      <span className="flex items-baseline gap-2 tabular-nums">
        <span className="text-lg text-zinc-50">{dimension.score}</span>
        {symbol ? (
          <span
            className={
              symbol === "↑"
                ? "text-emerald-400"
                : symbol === "↓"
                  ? "text-rose-400"
                  : "text-zinc-500"
            }
            aria-label={dimension.trend ?? undefined}
          >
            {symbol}
          </span>
        ) : (
          <span className="w-3 text-zinc-600" aria-hidden>
            ·
          </span>
        )}
      </span>
    </button>
  );
}

function DriverList(props: { drivers: HealthDriver[] }) {
  const positive = props.drivers.filter((d) => d.direction === "positive");
  const negative = props.drivers.filter((d) => d.direction === "negative");
  if (props.drivers.length === 0) {
    return (
      <p className="text-sm text-zinc-500">No specific drivers available.</p>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {positive.length > 0 ? (
        <div>
          <p className="mb-1.5 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-emerald-500/80">
            Positive
          </p>
          <ul className="space-y-2">
            {positive.map((driver) => (
              <li key={driver.key} className="text-sm text-zinc-300">
                <span className="text-zinc-100">{driver.label}</span>
                <span className="mt-0.5 block text-xs text-zinc-500">
                  {driver.explanation}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {negative.length > 0 ? (
        <div>
          <p className="mb-1.5 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-rose-400/80">
            Negative
          </p>
          <ul className="space-y-2">
            {negative.map((driver) => (
              <li key={driver.key} className="text-sm text-zinc-300">
                <span className="text-zinc-100">{driver.label}</span>
                <span className="mt-0.5 block text-xs text-zinc-500">
                  {driver.explanation}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function FranchiseHealthPanel(props: {
  health: OwnerDashboardHealth;
  insights: OwnerDashboardInsight[];
}) {
  const { health } = props;
  const fh = health.franchiseHealth;
  const [selected, setSelected] = useState<FranchiseHealthDimensionKey | null>(
    fh.biggestRisk?.dimension ?? "financial",
  );
  const selectedDimension = selected ? fh.dimensions[selected] : null;

  const ticketContext =
    health.ticketPriceVsLeaguePct !== null
      ? `${health.ticketPriceVsLeaguePct >= 0 ? "+" : ""}${Math.round(health.ticketPriceVsLeaguePct)}% vs league average`
      : null;

  return (
    <section aria-label="Franchise health" className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-amber-500">
            Franchise health
          </p>
          <h2
            className={`mt-1 text-2xl font-medium ${conditionToneClass(fh.condition)}`}
          >
            {formatDimensionStatus(fh.condition)}
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">
            {fh.summary}
          </p>
        </div>
        <HealthToneBadge health={health.financialHealth} />
      </div>

      {health.financialHealth === "critical" ? (
        <p
          role="status"
          className="rounded-md border border-amber-800/60 bg-amber-950/40 px-4 py-3 text-sm text-amber-200"
        >
          Business funds are low. Major facility investments may be difficult —
          review Finances before large capital decisions.
        </p>
      ) : null}

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
        <div className="grid gap-1 sm:grid-cols-2">
          {DIMENSION_ORDER.map((key) => (
            <DimensionRow
              key={key}
              dimensionKey={key}
              dimension={fh.dimensions[key]}
              selected={selected === key}
              onSelect={() =>
                setSelected((current) => (current === key ? null : key))
              }
            />
          ))}
        </div>
        {selected && selectedDimension ? (
          <div className="mt-4 border-t border-zinc-800 pt-4">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-zinc-500">
                {DIMENSION_TITLE[selected]} — {selectedDimension.score}{" "}
                {trendSymbol(selectedDimension.trend)}
              </p>
              <p className="text-xs text-zinc-500">
                {formatDimensionStatus(selectedDimension.status)}
              </p>
            </div>
            <DriverList drivers={selectedDimension.drivers} />
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-zinc-500">
            Biggest strength
          </p>
          <p className="mt-1 text-sm text-zinc-100">
            {fh.biggestStrength?.label ?? "—"}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-zinc-500">
            Biggest risk
          </p>
          <p className="mt-1 text-sm text-zinc-100">
            {fh.biggestRisk?.label ?? "—"}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3 sm:col-span-1">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-zinc-500">
            Primary driver
          </p>
          <p className="mt-1 text-sm leading-snug text-zinc-300">
            {fh.primaryDriver ?? "—"}
          </p>
        </div>
      </div>

      <details className="group rounded-xl border border-zinc-800 bg-zinc-900/30">
        <summary className="cursor-pointer list-none px-4 py-3 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-zinc-500 marker:content-none [&::-webkit-details-marker]:hidden">
          Supporting metrics
          <span className="ml-2 text-zinc-600 group-open:hidden">Show</span>
          <span className="ml-2 hidden text-zinc-600 group-open:inline">
            Hide
          </span>
        </summary>
        <div className="space-y-4 border-t border-zinc-800 px-4 py-4">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
              Financial
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <MoneyMetric
                label="Cash"
                amount={health.cash}
                context={health.cashContext?.text}
                direction={health.cashContext?.direction}
              />
              <MoneyMetric label="Revenue" amount={health.revenue} />
              <MoneyMetric label="Expenses" amount={health.expenses} />
              <MoneyMetric label="Profit / loss" amount={health.netIncome} />
              <MoneyMetric
                label="Franchise value"
                amount={health.franchiseValue}
                context={franchiseValueContext(health)}
              />
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
              Demand / fans
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <MetricBlock
                label="Attendance"
                value={
                  health.attendance !== null
                    ? health.attendance.toLocaleString()
                    : "—"
                }
                context={
                  health.attendanceTrend?.text ??
                  (health.attendanceFillRatePct !== null
                    ? `Fill rate ${health.attendanceFillRatePct}%`
                    : "No home game settled yet")
                }
                direction={health.attendanceTrend?.direction}
              />
              <MetricBlock
                label="Ticket price"
                value={`$${health.ticketPrice}`}
                context={ticketContext}
              />
              <MetricBlock label="Fan sentiment" value={health.fanSentiment} />
              <MetricBlock
                label="Franchise reputation"
                value={health.franchiseReputation}
              />
              <MetricBlock label="Market size" value={health.marketSize} />
              <MetricBlock label="Awareness" value={health.awareness} />
            </div>
          </div>
        </div>
      </details>

      {props.insights.length > 0 ? (
        <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-zinc-500">
            Observations
          </p>
          <ul className="space-y-2">
            {props.insights.map((insight) => (
              <li key={insight.id} className="text-sm text-zinc-300">
                {insight.text}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="sr-only">
        Franchise value <MoneyDisplay amount={health.franchiseValue} />
        Standing {STANDING_LABEL[health.franchiseStanding]}
        Condition {formatDimensionStatus(fh.condition)}
      </p>
    </section>
  );
}
