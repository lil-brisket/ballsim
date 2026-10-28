import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CapSheet } from "@/components/finances/CapSheet";
import type { CapSheetView } from "@/state/cap-sheet-selectors";

const openPlayer = vi.fn();
vi.mock("@/components/entity/EntityDrawerProvider", () => ({
  useEntityDrawer: () => ({ openPlayer }),
}));

afterEach(() => {
  cleanup();
  openPlayer.mockReset();
});

function view(overrides: Partial<CapSheetView> = {}): CapSheetView {
  const payroll = 100_000_000;
  return {
    teamId: "t1",
    seasons: [2027, 2028],
    payroll,
    lines: [
      { key: "floor", label: "Floor", amount: 80_000_000, delta: 20_000_000 },
      { key: "cap", label: "Cap", amount: 104_000_000, delta: -4_000_000 },
      {
        key: "tax",
        label: "Tax line",
        amount: 120_000_000,
        delta: -20_000_000,
      },
    ],
    rows: [
      {
        key: "c1",
        playerId: "p1",
        name: "Alex Rivera",
        position: "PG",
        kind: "player",
        note: null,
        cells: [
          { kind: "salary", amount: 30_000_000 },
          { kind: "option", option: "team", amount: 31_000_000 },
        ],
      },
      {
        key: "c2",
        playerId: "p2",
        name: "Sam Okafor",
        position: "C",
        kind: "player",
        note: null,
        cells: [
          { kind: "salary", amount: 10_000_000 },
          { kind: "option", option: "player", amount: 11_000_000 },
        ],
      },
      {
        key: "c3",
        playerId: "p3",
        name: "Dee Lane",
        position: "SG",
        kind: "development_league",
        note: "Development league",
        cells: [{ kind: "salary", amount: 2_000_000 }, { kind: "empty" }],
      },
      {
        key: "d1",
        playerId: "p4",
        name: "Former Guy",
        position: "SF",
        kind: "dead_money",
        note: "Waived",
        cells: [{ kind: "dead", amount: 3_000_000 }, { kind: "empty" }],
      },
    ],
    totals: [
      { season: 2027, payroll, cap: 104_000_000, room: 4_000_000 },
      {
        season: 2028,
        payroll: 110_000_000,
        cap: 104_000_000,
        room: -6_000_000,
      },
    ],
    ...overrides,
  };
}

describe("CapSheet bar", () => {
  it("prints the lines with room and over text", () => {
    render(<CapSheet view={view()} saveId="s1" />);
    expect(screen.getAllByText(/Floor \$80\.0M/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Cap \$104\.0M/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Tax line \$120\.0M/).length).toBeGreaterThan(0);
    expect(screen.getByText("$4.0M under the cap")).toBeTruthy();
    expect(screen.getByText("$20.0M under the tax line")).toBeTruthy();
    expect(screen.getByText("$20.0M above the floor")).toBeTruthy();
  });

  it("says over when payroll passes a line", () => {
    render(
      <CapSheet
        view={view({
          payroll: 125_000_000,
          lines: [
            {
              key: "tax",
              label: "Tax line",
              amount: 120_000_000,
              delta: 5_000_000,
            },
          ],
        })}
        saveId="s1"
      />,
    );
    expect(screen.getByText("$5.0M over the tax line")).toBeTruthy();
  });

  it("has an accessible name summarising payroll and lines", () => {
    render(<CapSheet view={view()} saveId="s1" />);
    const bar = screen.getByRole("img");
    const name = bar.getAttribute("aria-label") ?? "";
    expect(name).toContain("Payroll $100.0M");
    expect(name).toContain("$4.0M under the cap");
    expect(name).toContain("$20.0M under the tax line");
  });

  it("hides lines whose rules are off", () => {
    render(
      <CapSheet
        view={view({
          lines: [
            {
              key: "cap",
              label: "Cap",
              amount: 104_000_000,
              delta: -4_000_000,
            },
          ],
        })}
        saveId="s1"
      />,
    );
    expect(screen.queryByText(/Tax line/)).toBeNull();
    expect(screen.queryByText(/floor/)).toBeNull();
    expect(screen.getByText("$4.0M under the cap")).toBeTruthy();
  });

  it("has no line labels when every rule is off", () => {
    render(
      <CapSheet
        view={view({
          lines: [],
          totals: [
            { season: 2027, payroll: 100_000_000, cap: null, room: null },
            { season: 2028, payroll: 110_000_000, cap: null, room: null },
          ],
        })}
        saveId="s1"
      />,
    );
    expect(screen.queryByText(/Cap \$/)).toBeNull();
    expect(screen.queryByText(/Room/)).toBeNull();
  });
});

describe("CapSheet grid", () => {
  it("renders season headers and the totals row", () => {
    render(<CapSheet view={view()} saveId="s1" />);
    expect(screen.getByRole("columnheader", { name: "2027" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "2028" })).toBeTruthy();
    const totals = screen.getByRole("row", { name: /^Payroll/ });
    expect(totals.textContent).toContain("$100.0M");
    expect(totals.textContent).toContain("Cap $104.0M · Room $4.0M");
    expect(totals.textContent).toContain("Cap $104.0M · Over by $6.0M");
  });

  it("marks options and dead money and explains them in the legend", () => {
    render(<CapSheet view={view()} saveId="s1" />);
    expect(
      screen.getAllByTitle("Team option").some((el) => el.tagName === "ABBR"),
    ).toBe(true);
    expect(
      screen.getAllByTitle("Player option").some((el) => el.tagName === "ABBR"),
    ).toBe(true);
    expect(screen.getAllByText(/pending, not counted/).length).toBe(2);
    expect(screen.getByTitle("Dead money").textContent).toBe("†");
    expect(screen.getByText(/dead money from released players/)).toBeTruthy();
    expect(
      screen.getByText(/Development league players are muted/),
    ).toBeTruthy();
    expect(screen.getByText("Waived")).toBeTruthy();
    expect(screen.getByText("Development league")).toBeTruthy();
  });

  it("opens the player drawer from a name", () => {
    render(<CapSheet view={view()} saveId="s1" />);
    fireEvent.click(screen.getByRole("button", { name: "Alex Rivera" }));
    expect(openPlayer).toHaveBeenCalledWith("p1");
  });
});
