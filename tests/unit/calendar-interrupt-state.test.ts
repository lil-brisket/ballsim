import { describe, expect, it } from "vitest";
import {
  INITIAL_INTERRUPT_STATE,
  interruptBannerVisible,
  interruptModalOpen,
  reduceInterruptState,
} from "@/components/calendar/calendar-interrupt-state";
import type { CalendarInterrupt } from "@/state/calendar-interrupt";

const tradeInterrupt: CalendarInterrupt = {
  kind: "trade_offer",
  decisionId: "od_1",
  review: {
    decisionId: "od_1",
    offeringTeamName: "Boston Celtics",
    receivingTeamName: "Toronto Hawks",
    motivationLabel: "Looking for help at SF",
    youReceive: [],
    youSend: [],
    recommendation: "favor_send",
    netValue: -52,
    reasons: ["Trade favors the other side on asset value"],
    rosterFitPct: 61,
    strategicFitPct: 50,
    financialPct: 75,
    rosterImpact: [],
    bothSidesOwned: false,
  },
};

const nextTrade: CalendarInterrupt = {
  ...tradeInterrupt,
  decisionId: "od_2",
  review: { ...tradeInterrupt.review, decisionId: "od_2" },
};

describe("reduceInterruptState", () => {
  it("opens a new interrupt and does not treat Stop simulation as resume", () => {
    let state = reduceInterruptState(INITIAL_INTERRUPT_STATE, {
      type: "sync",
      interrupt: tradeInterrupt,
    });
    expect(interruptModalOpen(state)).toBe(true);
    state = reduceInterruptState(state, { type: "dismiss" });
    expect(interruptModalOpen(state)).toBe(false);
    expect(interruptBannerVisible(state)).toBe(true);
    expect(state.status).toBe("interrupted");
  });

  it("reopens from the pause banner", () => {
    let state = reduceInterruptState(INITIAL_INTERRUPT_STATE, {
      type: "sync",
      interrupt: tradeInterrupt,
    });
    state = reduceInterruptState(state, { type: "dismiss" });
    state = reduceInterruptState(state, { type: "reopen" });
    expect(interruptModalOpen(state)).toBe(true);
  });

  it("keeps the modal open on resolve error", () => {
    let state = reduceInterruptState(INITIAL_INTERRUPT_STATE, {
      type: "sync",
      interrupt: tradeInterrupt,
    });
    state = reduceInterruptState(state, {
      type: "start_resolve",
      action: "accept",
    });
    state = reduceInterruptState(state, {
      type: "resolve_error",
      error: "Trade validation failed.",
    });
    expect(state.status).toBe("interrupted");
    if (state.status !== "interrupted") return;
    expect(state.dismissed).toBe(false);
    expect(state.error).toBe("Trade validation failed.");
    expect(interruptModalOpen(state)).toBe(true);
  });

  it("shows the next interrupt instead of resuming", () => {
    let state = reduceInterruptState(INITIAL_INTERRUPT_STATE, {
      type: "sync",
      interrupt: tradeInterrupt,
    });
    state = reduceInterruptState(state, {
      type: "start_resolve",
      action: "accept",
    });
    state = reduceInterruptState(state, {
      type: "resolve_success",
      interrupt: nextTrade,
      resumeTo: "2026-10-01",
    });
    expect(state.status).toBe("interrupted");
    if (state.status !== "interrupted") return;
    expect(
      state.interrupt.kind === "trade_offer" && state.interrupt.decisionId,
    ).toBe("od_2");
    expect(state.dismissed).toBe(false);
  });

  it("enters resuming when the queue is clear and a leftover target remains", () => {
    let state = reduceInterruptState(INITIAL_INTERRUPT_STATE, {
      type: "sync",
      interrupt: tradeInterrupt,
    });
    state = reduceInterruptState(state, {
      type: "start_resolve",
      action: "let_ai_decide",
    });
    state = reduceInterruptState(state, {
      type: "resolve_success",
      interrupt: null,
      resumeTo: "2026-10-01",
    });
    expect(state).toEqual({ status: "resuming", resumeTo: "2026-10-01" });
  });
});
