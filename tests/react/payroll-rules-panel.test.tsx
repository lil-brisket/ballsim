import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import {
  PayrollRulesPanel,
  TaxLineNote,
} from "@/components/finances/PayrollRulesPanel";
import { asTeamId } from "@/domain/ids";
import type { PayrollRulesView } from "@/state/payroll-rules-selectors";

afterEach(cleanup);

function rules(overrides: Partial<PayrollRulesView> = {}): PayrollRulesView {
  return {
    seasonYear: 2031,
    payroll: 100_000_000,
    luxuryTaxEnabled: true,
    threshold: 120_000_000,
    projectedTax: 0,
    salaryFloorEnabled: true,
    floor: 80_000_000,
    projectedFloorShortfall: 0,
    veteranRightsEnabled: true,
    veteranRightsSeasons: 3,
    lastAssessment: null,
    ...overrides,
  };
}

describe("PayrollRulesPanel", () => {
  it("shows room under the tax line", () => {
    render(<PayrollRulesPanel rules={rules()} />);
    expect(screen.getByText("Payroll rules")).toBeTruthy();
    expect(screen.getByText("Payroll for 2031")).toBeTruthy();
    expect(screen.getByText(/\$20\.0M\s+under/)).toBeTruthy();
    expect(screen.queryByText("Projected tax")).toBeNull();
  });

  it("shows how far over the line and the projected tax", () => {
    render(
      <PayrollRulesPanel
        rules={rules({ payroll: 130_000_000, projectedTax: 1_500_000 })}
      />,
    );
    expect(screen.getByText(/\$10\.0M\s+over/)).toBeTruthy();
    expect(screen.getByText("Projected tax")).toBeTruthy();
    expect(screen.getByText("$1.5M")).toBeTruthy();
  });

  it("hides tax parts when the luxury tax is off", () => {
    render(
      <PayrollRulesPanel
        rules={rules({
          luxuryTaxEnabled: false,
          threshold: null,
          payroll: 70_000_000,
          projectedFloorShortfall: 10_000_000,
        })}
      />,
    );
    expect(screen.queryByText("Tax line")).toBeNull();
    expect(screen.getByText("Salary floor")).toBeTruthy();
    expect(screen.getByText("Projected floor charge")).toBeTruthy();
  });

  it("summarises the last assessment's non-zero parts", () => {
    render(
      <PayrollRulesPanel
        rules={rules({
          lastAssessment: {
            teamId: asTeamId("t1"),
            seasonYear: 2030,
            payroll: 130_000_000,
            threshold: 120_000_000,
            floor: 80_000_000,
            taxBill: 2_000_000,
            floorShortfall: 0,
            taxShare: 0,
          },
        })}
      />,
    );
    expect(screen.getByText(/2030: paid \$2\.0M tax$/)).toBeTruthy();
  });

  it("says nothing was charged when all parts are zero", () => {
    render(
      <PayrollRulesPanel
        rules={rules({
          lastAssessment: {
            teamId: asTeamId("t1"),
            seasonYear: 2030,
            payroll: 100_000_000,
            threshold: 120_000_000,
            floor: 80_000_000,
            taxBill: 0,
            floorShortfall: 0,
            taxShare: 0,
          },
        })}
      />,
    );
    expect(screen.getByText(/No tax or floor charge\./)).toBeTruthy();
  });

  it("is hidden when both rules are off", () => {
    const { container } = render(
      <PayrollRulesPanel
        rules={rules({
          luxuryTaxEnabled: false,
          threshold: null,
          salaryFloorEnabled: false,
          floor: null,
        })}
      />,
    );
    expect(container.textContent).toBe("");
  });
});

describe("TaxLineNote", () => {
  it("renders room below, over with projected tax, and nothing when off", () => {
    const below = render(<TaxLineNote rules={rules()} />);
    expect(below.container.textContent).toBe("Tax line $120.0M: $20.0M below");
    cleanup();
    const over = render(
      <TaxLineNote
        rules={rules({ payroll: 125_000_000, projectedTax: 1_000_000 })}
      />,
    );
    expect(over.container.textContent).toBe(
      "Tax line $120.0M: $5.0M over — projected tax $1.0M",
    );
    cleanup();
    const off = render(
      <TaxLineNote
        rules={rules({ luxuryTaxEnabled: false, threshold: null })}
      />,
    );
    expect(off.container.textContent).toBe("");
  });
});
