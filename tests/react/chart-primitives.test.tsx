import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Gauge } from "@/components/ui/Gauge";
import { ResultSparkline } from "@/components/ui/Sparkline";
import {
  buildWaterfall,
  projectCashLine,
} from "@/components/finances/FinanceCharts";

afterEach(() => {
  cleanup();
});

describe("Gauge", () => {
  it("exposes the value as text and as a meter", () => {
    render(<Gauge label="Fan sentiment" value={72.4} />);
    const meter = screen.getByRole("meter", { name: "Fan sentiment" });
    expect(meter.getAttribute("aria-valuenow")).toBe("72.4");
    expect(screen.getByText("72")).toBeTruthy();
  });

  it("clamps out-of-range values", () => {
    render(<Gauge label="Chem" value={140} />);
    expect(
      screen.getByRole("meter", { name: "Chem" }).getAttribute("aria-valuenow"),
    ).toBe("100");
  });
});

describe("ResultSparkline", () => {
  it("names the strip with a W-L summary", () => {
    render(<ResultSparkline results={["W", "W", "L"]} />);
    expect(
      screen.getByRole("img", { name: "Last 3 games: 2 wins, 1 losses" }),
    ).toBeTruthy();
  });

  it("renders a dash with no results", () => {
    render(<ResultSparkline results={[]} />);
    expect(screen.getByText("—")).toBeTruthy();
  });
});

describe("finance chart data", () => {
  it("builds a waterfall from revenue down to net", () => {
    const steps = buildWaterfall({
      revenue: 100,
      expenses: [
        { label: "Staff", amount: 30 },
        { label: "Skipped", amount: 0 },
        { label: "Ops", amount: 90 },
      ],
    });
    expect(steps.map((s) => s.label)).toEqual([
      "Revenue",
      "Staff",
      "Ops",
      "Net",
    ]);
    expect(steps[1]!.range).toEqual([70, 100]);
    expect(steps[2]!.range).toEqual([-20, 70]);
    expect(steps[3]!.amount).toBe(-20);
    expect(steps[3]!.range).toEqual([-20, 0]);
  });

  it("projects cash along the burn rate", () => {
    const points = projectCashLine({
      cash: 1000,
      netWeeklyBurn: 100,
      runwayWeeks: 10,
    });
    expect(points[0]).toEqual({ week: 0, cash: 1000 });
    expect(points[10]!.cash).toBe(0);
    expect(points.length).toBe(15);
  });
});
