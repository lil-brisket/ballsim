import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { FreeAgentInterest } from "@/components/free-agency/FreeAgentInterest";
import { formatMoney } from "@/components/owner/MoneyDisplay";

afterEach(cleanup);

describe("FreeAgentInterest", () => {
  it("renders what he cares about", () => {
    render(
      <FreeAgentInterest
        caresAbout={["winning", "minutes"]}
        factors={[]}
        salaryToSign={3_000_000}
      />,
    );
    expect(screen.getByText("Cares about: winning, minutes")).toBeTruthy();
  });

  it("renders signed, rounded chips and skips zeros", () => {
    render(
      <FreeAgentInterest
        caresAbout={["winning"]}
        factors={[
          { label: "winning", points: 3.24 },
          { label: "minutes", points: -1.04 },
          { label: "loyalty", points: 0 },
          { label: "the coach", points: 0.04 },
        ]}
        salaryToSign={3_000_000}
      />,
    );
    expect(screen.getByText("+3.2 winning")).toBeTruthy();
    expect(screen.getByText("−1.0 minutes")).toBeTruthy();
    expect(screen.queryByText(/loyalty/)).toBeNull();
    expect(screen.queryByText(/the coach/)).toBeNull();
  });

  it("shows the salary line", () => {
    render(
      <FreeAgentInterest
        caresAbout={[]}
        factors={[]}
        salaryToSign={4_500_000}
      />,
    );
    expect(
      screen.getByText(`Would sign for about ${formatMoney(4_500_000)}`),
    ).toBeTruthy();
  });

  it("shows the not-interested message when no salary would do", () => {
    render(
      <FreeAgentInterest caresAbout={[]} factors={[]} salaryToSign={null} />,
    );
    expect(
      screen.getByText("Not interested in your team right now."),
    ).toBeTruthy();
  });
});
