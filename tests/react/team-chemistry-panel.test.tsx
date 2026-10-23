// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TeamChemistryPanel } from "@/components/team/hub/TeamChemistryPanel";

describe("TeamChemistryPanel", () => {
  afterEach(cleanup);

  it("shows the gauge, continuity and a trade note", () => {
    render(
      <TeamChemistryPanel
        chemistry={{
          value: 48,
          label: "Shaky",
          continuity: 0.5,
          recentTrades: 2,
          note: "2 recent trades: the group needs time to gel.",
        }}
      />,
    );
    expect(screen.getByRole("meter", { name: "Chemistry Shaky" })).toBeTruthy();
    expect(screen.getByText(/50% of the core rotation/)).toBeTruthy();
    expect(screen.getByText(/2 recent trades/)).toBeTruthy();
  });

  it("omits the note when there were no trades", () => {
    render(
      <TeamChemistryPanel
        chemistry={{
          value: 72,
          label: "Strong",
          continuity: 0.875,
          recentTrades: 0,
          note: null,
        }}
      />,
    );
    expect(screen.queryByText(/recent trade/)).toBeNull();
  });
});
