import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TradeReviewPanel } from "@/components/trades/TradeReviewPanel";
import type { TradeReviewView } from "@/state/trade-review-view";

const review: TradeReviewView = {
  decisionId: "od_1",
  offeringTeamName: "Boston Harriers",
  receivingTeamName: "Toronto Hawks",
  motivationLabel: "Looking for help at SF",
  youReceive: [
    {
      id: "p1",
      kind: "player",
      name: "Wei Bright",
      detail: "C · OVR 59 · Age 27 · $4.6M",
      href: null,
      playerId: "p1",
      firstName: "Wei",
      lastName: "Bright",
      position: "C",
      overall: 59,
      age: 27,
      salary: 4_600_000,
      portrait: null,
    },
  ],
  youSend: [
    {
      id: "p2",
      kind: "player",
      name: "OG Anunoby",
      detail: "SF · OVR 84 · Age 28 · $7.3M",
      href: null,
      playerId: "p2",
      firstName: "OG",
      lastName: "Anunoby",
      position: "SF",
      overall: 84,
      age: 28,
      salary: 7_300_000,
      portrait: null,
    },
    {
      id: "pk1",
      kind: "pick",
      name: "2027 Round 1",
      detail: "Lottery · ~#6",
      href: null,
    },
  ],
  recommendation: "favor_send",
  netValue: -52,
  reasons: ["Trade favors the other side on asset value"],
  rosterFitPct: 61,
  strategicFitPct: 50,
  financialPct: 75,
  rosterImpact: [{ position: "SF", before: 5, after: 4 }],
  bothSidesOwned: false,
  evenBand: 8,
  offeringTeamBranding: null,
  receivingTeamBranding: null,
};

describe("TradeReviewPanel", () => {
  afterEach(cleanup);

  it("renders evaluation and invokes callbacks", () => {
    const onAccept = vi.fn();
    const onDecline = vi.fn();
    render(
      <TradeReviewPanel
        review={review}
        onAccept={onAccept}
        onDecline={onDecline}
        onNegotiate={vi.fn()}
        onLetAiDecide={vi.fn()}
        showLetAiDecide
      />,
    );
    expect(screen.getByText("Boston Harriers → Toronto Hawks")).toBeTruthy();
    expect(screen.getByText(/Wei Bright/)).toBeTruthy();
    expect(screen.getByTestId("trade-verdict").textContent).toMatch(
      /Favors them/,
    );
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    fireEvent.click(screen.getByRole("button", { name: "Decline" }));
    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onDecline).toHaveBeenCalledTimes(1);
  });

  it("renders player cards with OVR badge, position and age", () => {
    render(<TradeReviewPanel review={review} />);
    const cards = screen.getAllByTestId("trade-player-card");
    expect(cards).toHaveLength(2);
    expect(screen.getByRole("img", { name: "Overall 59" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Overall 84" })).toBeTruthy();
    expect(cards[0]!.textContent).toContain("C · Age 27 · $4.6M");
  });

  it("shows a secondary position next to the primary one", () => {
    const withSecondary: TradeReviewView = {
      ...review,
      youReceive: [{ ...review.youReceive[0]!, secondaryPosition: "PF" }],
    };
    render(<TradeReviewPanel review={withSecondary} />);
    const cards = screen.getAllByTestId("trade-player-card");
    expect(cards[0]!.textContent).toContain("C/PF · Age 27 · $4.6M");
    expect(cards[1]!.textContent).toContain("SF · Age 28");
  });

  it("renders picks as text chips without a player card", () => {
    render(<TradeReviewPanel review={review} />);
    const chip = screen.getByTestId("trade-pick-chip");
    expect(chip.textContent).toContain("2027 Round 1");
    expect(screen.getAllByTestId("trade-player-card")).toHaveLength(2);
  });

  it.each([
    ["favor_receive", "Favors you", "+3.2"],
    ["favor_send", "Favors them", "-3.2"],
    ["even", "Roughly even", "0.0"],
  ] as const)("shows verdict for %s", (recommendation, label, signed) => {
    const netValue = signed === "0.0" ? 0 : signed === "+3.2" ? 3.2 : -3.2;
    render(
      <TradeReviewPanel review={{ ...review, recommendation, netValue }} />,
    );
    const verdict = screen.getByTestId("trade-verdict");
    expect(verdict.dataset.recommendation).toBe(recommendation);
    expect(verdict.textContent).toContain(label);
    expect(screen.getByTestId("trade-net-value").textContent).toBe(signed);
  });

  it("exposes fit meters with their percentages", () => {
    render(<TradeReviewPanel review={review} />);
    const bars = screen.getAllByRole("progressbar");
    expect(
      bars.map((bar) => [
        bar.getAttribute("aria-label"),
        bar.getAttribute("aria-valuenow"),
      ]),
    ).toEqual([
      ["Roster fit", "61"],
      ["Strategic fit", "50"],
      ["Financial", "75"],
    ]);
  });

  it("applies each team's uniform to its own column only", () => {
    const branding = (primaryColor: string) => ({
      primaryColor,
      secondaryColor: "#ffffff",
      accentColor: "#000000",
      logoId: "logo",
    });
    const { container } = render(
      <TradeReviewPanel
        review={{
          ...review,
          offeringTeamBranding: branding("#aa0000"),
          receivingTeamBranding: null,
        }}
      />,
    );
    const cards = screen.getAllByTestId("trade-player-card");
    // youReceive has one player (offering branding); youSend has one (null).
    expect(
      cards[0]!.querySelector("[data-portrait-uniform='team']"),
    ).not.toBeNull();
    expect(
      cards[1]!.querySelector("[data-portrait-uniform='team']"),
    ).toBeNull();
    expect(
      container.querySelectorAll("[data-portrait-uniform='team']"),
    ).toHaveLength(1);
  });

  it("leaves portraits neutral when no branding is given", () => {
    const { container } = render(<TradeReviewPanel review={review} />);
    expect(container.querySelector("[data-portrait-uniform]")).toBeNull();
  });

  it.each([
    [100, 24, "favor_receive", "Favors you, net value +100.0"],
    [-100, -24, "favor_send", "Favors them, net value -100.0"],
    [3, 3, "even", "Roughly even, net value +3.0"],
  ] as const)(
    "balance meter for net %s clamps to %s",
    (netValue, now, recommendation, text) => {
      render(
        <TradeReviewPanel review={{ ...review, netValue, recommendation }} />,
      );
      const meter = screen.getByRole("meter");
      expect(meter.getAttribute("aria-valuemin")).toBe("-24");
      expect(meter.getAttribute("aria-valuemax")).toBe("24");
      expect(meter.getAttribute("aria-valuenow")).toBe(String(now));
      expect(meter.getAttribute("aria-valuetext")).toBe(text);
      const zone = screen.getByTestId("trade-balance-even-zone");
      expect(zone.style.left).toBe("33.33333333333333%");
      expect(zone.style.width).toBe("33.33333333333333%");
    },
  );

  it("does not import server actions", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/trades/TradeReviewPanel.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/from ["']@\/application/);
  });
});
