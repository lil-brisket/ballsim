import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { LotteryNight } from "@/components/draft/LotteryNight";
import type {
  DraftLotterySlotView,
  DraftLotteryView,
} from "@/state/draft-lottery-selectors";

function slot(
  n: number,
  overrides: Partial<DraftLotterySlotView> = {},
): DraftLotterySlotView {
  return {
    slot: n,
    teamId: `t${n}`,
    teamName: `Team ${n}`,
    abbreviation: `T${n}`,
    branding: null,
    preLotterySlot: n,
    movement: 0,
    odds: 0.14,
    drawn: n <= 2,
    ownerTeamId: `t${n}`,
    isUserTeam: false,
    ...overrides,
  };
}

const view: DraftLotteryView = {
  draftYear: 2027,
  heldOn: "2027-05-01",
  picksDrawn: 2,
  slots: [
    slot(1, { preLotterySlot: 4, movement: 3, odds: 0.125 }),
    slot(2, { preLotterySlot: 1, movement: -1 }),
    slot(3, { isUserTeam: true, ownerTeamId: "other" }),
    slot(4),
  ],
  biggestJump: { teamName: "Team 1", movement: 3 },
};

function mockReducedMotion(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

describe("LotteryNight", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockReducedMotion(false);
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("starts with nothing revealed", () => {
    render(<LotteryNight view={view} />);
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  it("reveals the last slot first", () => {
    render(<LotteryNight view={view} />);
    fireEvent.click(screen.getByRole("button", { name: "Reveal next" }));
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(items[0]!.textContent).toContain("Team 4");
    expect(items[0]!.textContent).toContain("#4");
  });

  it("reveals on a timer", () => {
    render(<LotteryNight view={view} />);
    act(() => {
      vi.advanceTimersByTime(1300);
    });
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("show all reveals everything and the winner summary", () => {
    render(<LotteryNight view={view} />);
    fireEvent.click(screen.getByRole("button", { name: "Show all" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    const summary = screen.getByRole("status");
    expect(summary.textContent).toContain("Team 1 won the lottery");
    expect(summary.textContent).toContain("moved up 3");
  });

  it("shows everything immediately under reduced motion", () => {
    mockReducedMotion(true);
    render(<LotteryNight view={view} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("highlights the user team and labels trade and record picks", () => {
    render(<LotteryNight view={view} />);
    fireEvent.click(screen.getByRole("button", { name: "Show all" }));
    const items = screen.getAllByRole("listitem");
    const mine = items.find((li) => li.getAttribute("data-user-team"));
    expect(mine?.textContent).toContain("Team 3");
    expect(mine?.textContent).toContain("via trade");
    expect(mine?.textContent).toContain("By record");
    expect(
      items.filter((li) => li.getAttribute("data-user-team")),
    ).toHaveLength(1);
  });

  it("renders movement chips and odds", () => {
    render(<LotteryNight view={view} />);
    fireEvent.click(screen.getByRole("button", { name: "Show all" }));
    expect(screen.getByText("+3")).toBeTruthy();
    expect(screen.getByText("−1")).toBeTruthy();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    expect(screen.getByText(/12\.5% odds/)).toBeTruthy();
  });
});
