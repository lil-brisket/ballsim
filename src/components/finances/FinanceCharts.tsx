"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney } from "@/components/owner/MoneyDisplay";
import {
  chartTheme,
  chartTick,
  chartTooltipStyle,
} from "@/components/ui/chart-theme";

export type WaterfallInput = {
  revenue: number;
  expenses: readonly { label: string; amount: number }[];
};

export type WaterfallStep = {
  label: string;
  /** Signed contribution (revenue +, expense -, net = total). */
  amount: number;
  /** [low, high] of the floating bar. */
  range: [number, number];
  kind: "revenue" | "expense" | "net";
};

/** Pure step builder: revenue up, each expense down, net at the end. */
export function buildWaterfall(input: WaterfallInput): WaterfallStep[] {
  const steps: WaterfallStep[] = [
    {
      label: "Revenue",
      amount: input.revenue,
      range: [Math.min(0, input.revenue), Math.max(0, input.revenue)],
      kind: "revenue",
    },
  ];
  let running = input.revenue;
  for (const expense of input.expenses) {
    if (expense.amount === 0) continue;
    const next = running - expense.amount;
    steps.push({
      label: expense.label,
      amount: -expense.amount,
      range: [Math.min(running, next), Math.max(running, next)],
      kind: "expense",
    });
    running = next;
  }
  steps.push({
    label: "Net",
    amount: running,
    range: [Math.min(0, running), Math.max(0, running)],
    kind: "net",
  });
  return steps;
}

function stepColor(step: WaterfallStep): string {
  if (step.kind === "revenue") return chartTheme.win;
  if (step.kind === "expense") return chartTheme.loss;
  return step.amount >= 0 ? chartTheme.win : chartTheme.loss;
}

export function RevenueExpenseWaterfall(props: WaterfallInput) {
  const steps = buildWaterfall(props);
  const summary = steps
    .map((s) => `${s.label} ${formatMoney(s.amount)}`)
    .join(", ");
  return (
    <figure className="m-0">
      <div
        role="img"
        aria-label={`Season revenue and expenses waterfall: ${summary}`}
        className="h-64 w-full"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={steps}
            margin={{ top: 8, right: 8, bottom: 8, left: 0 }}
          >
            <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              interval={0}
              stroke={chartTheme.axis}
              tick={chartTick}
            />
            <YAxis
              stroke={chartTheme.axis}
              tick={chartTick}
              width={52}
              tickFormatter={(v: number) => formatMoney(v)}
            />
            <Tooltip
              {...chartTooltipStyle}
              cursor={false}
              formatter={(_value, _name, item) => [
                formatMoney((item.payload as WaterfallStep).amount),
                "Amount",
              ]}
            />
            <ReferenceLine y={0} stroke={chartTheme.neutralDim} />
            <Bar dataKey="range" isAnimationActive={false}>
              {steps.map((step) => (
                <Cell key={step.label} fill={stepColor(step)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">Season revenue and expenses</figcaption>
      <table className="sr-only">
        <caption>Season revenue, expenses and net income</caption>
        <thead>
          <tr>
            <th scope="col">Item</th>
            <th scope="col">Amount</th>
          </tr>
        </thead>
        <tbody>
          {steps.map((s) => (
            <tr key={s.label}>
              <th scope="row">{s.label}</th>
              <td>{formatMoney(s.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export type CashPoint = { week: number; cash: number };

/** Cash projected week by week at the current net burn rate. */
export function projectCashLine(input: {
  cash: number;
  netWeeklyBurn: number;
  runwayWeeks: number | null;
}): CashPoint[] {
  const weeks =
    input.runwayWeeks === null
      ? 26
      : Math.max(8, Math.min(52, input.runwayWeeks + 4));
  const points: CashPoint[] = [];
  for (let week = 0; week <= weeks; week++) {
    points.push({ week, cash: input.cash - input.netWeeklyBurn * week });
  }
  return points;
}

export function CashRunwayChart(props: {
  cash: number;
  netWeeklyBurn: number;
  runwayWeeks: number | null;
}) {
  const points = projectCashLine(props);
  const last = points[points.length - 1]!;
  const label = `Projected business funds at the current burn rate: ${formatMoney(props.cash)} now, ${formatMoney(last.cash)} in ${last.week} weeks.`;
  return (
    <figure className="m-0">
      <div role="img" aria-label={label} className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={points}
            margin={{ top: 8, right: 8, bottom: 8, left: 0 }}
          >
            <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" />
            <XAxis
              dataKey="week"
              stroke={chartTheme.axis}
              tick={chartTick}
              tickFormatter={(w: number) => `${w}w`}
            />
            <YAxis
              stroke={chartTheme.axis}
              tick={chartTick}
              width={52}
              tickFormatter={(v: number) => formatMoney(v)}
              domain={["auto", "auto"]}
            />
            <Tooltip
              {...chartTooltipStyle}
              formatter={(value) => [formatMoney(Number(value)), "Funds"]}
              labelFormatter={(w) => `Week ${w}`}
            />
            <ReferenceLine
              y={0}
              stroke={chartTheme.loss}
              strokeDasharray="4 4"
            />
            <Line
              type="linear"
              dataKey="cash"
              stroke={chartTheme.ink}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-1 text-sm text-muted">
        {props.runwayWeeks === null
          ? "Funds stay positive through the projection."
          : `Funds run out in about ${props.runwayWeeks} weeks at the current burn rate.`}
      </figcaption>
    </figure>
  );
}
