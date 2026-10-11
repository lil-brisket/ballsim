import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TradeReviewPanel } from "@/components/trades/TradeReviewPanel";
import type { TradeReviewView } from "@/state/trade-review-view";

const review: TradeReviewView = {
  decisionId: "od_1",
  offeringTeamName: "Boston Celtics",
  receivingTeamName: "Toronto Hawks",
  motivationLabel: "Looking for help at SF",
  youReceive: [
    {
      id: "p1",
      kind: "player",
      name: "Wei Bright",
      detail: "C · OVR 59 · Age 27 · $4.6M",
      href: null,
    },
  ],
  youSend: [
    {
      id: "p2",
      kind: "player",
      name: "OG Anunoby",
      detail: "SF · OVR 84 · Age 28 · $7.3M",
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
};

describe("TradeReviewPanel", () => {
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
    expect(screen.getByText("Boston Celtics → Toronto Hawks")).toBeTruthy();
    expect(screen.getByText(/Wei Bright/)).toBeTruthy();
    expect(screen.getByText(/Favors them/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    fireEvent.click(screen.getByRole("button", { name: "Decline" }));
    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onDecline).toHaveBeenCalledTimes(1);
  });

  it("does not import server actions", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/trades/TradeReviewPanel.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/from ["']@\/application/);
  });
});
