import type {
  OwnerDashboardHealth,
  OwnerDashboardInsight,
} from "@/state/owner-dashboard";
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

export function FranchiseHealthPanel(props: {
  health: OwnerDashboardHealth;
  insights: OwnerDashboardInsight[];
}) {
  const { health } = props;
  const ticketContext =
    health.ticketPriceVsLeaguePct !== null
      ? `${health.ticketPriceVsLeaguePct >= 0 ? "+" : ""}${Math.round(health.ticketPriceVsLeaguePct)}% vs league average`
      : null;

  return (
    <section aria-label="Franchise health" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-amber-500">
            Franchise health
          </p>
          <h2 className="mt-1 text-lg font-medium text-zinc-50">
            How the business is doing
          </h2>
        </div>
        <HealthToneBadge health={health.financialHealth} />
      </div>

      {health.financialHealth === "insolvent" ? (
        <p
          role="alert"
          className="rounded-md border border-rose-800/60 bg-rose-950/40 px-4 py-3 text-sm text-rose-200"
        >
          The franchise is insolvent. Cash is at or below zero — review finances
          before making capital decisions.
        </p>
      ) : null}

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
      </p>
    </section>
  );
}
