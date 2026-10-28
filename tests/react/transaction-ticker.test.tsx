import { afterEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

const openPlayer = vi.fn();
vi.mock("@/components/entity/EntityDrawerProvider", () => ({
  useEntityDrawer: () => ({
    openPlayer,
    openTeam: () => {},
    openStaff: () => {},
    close: () => {},
  }),
}));

import {
  TransactionTicker,
  dispatchTickerUpdate,
} from "@/components/game/TransactionTicker";
import type {
  TransactionTickerItem,
  TransactionTickerView,
} from "@/state/transaction-ticker-selectors";

function item(
  id: string,
  overrides: Partial<TransactionTickerItem> = {},
): TransactionTickerItem {
  return {
    id,
    kind: "signing",
    occurredOn: "2027-07-01",
    headline: `BAL sign Player ${id}`,
    teams: [{ teamId: "t1", abbreviation: "BAL", branding: null }],
    players: [
      {
        playerId: `p_${id}`,
        name: `Player ${id}`,
        overall: 71,
        portrait: null,
      },
    ],
    contractValue: 12_000_000,
    isMyTeam: false,
    ...overrides,
  };
}

function view(
  items: TransactionTickerItem[],
  overrides: Partial<TransactionTickerView> = {},
): TransactionTickerView {
  return {
    window: "free_agency",
    title: "Free agency",
    status: "Day 1 of free agency",
    items,
    summary: null,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  openPlayer.mockClear();
});

describe("TransactionTicker", () => {
  it("renders nothing without a ticker", () => {
    const { container } = render(
      <TransactionTicker saveId="s" ticker={null} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders title, status and items with your team first", () => {
    render(
      <TransactionTicker
        saveId="s"
        ticker={view([item("mine", { isMyTeam: true }), item("other")])}
      />,
    );
    expect(screen.getByText("Free agency")).toBeTruthy();
    expect(screen.getByText("Day 1 of free agency")).toBeTruthy();
    const list = screen.getByRole("list", { name: "Free agency moves" });
    const entries = list.querySelectorAll("li");
    expect(entries).toHaveLength(2);
    expect(entries[0]!.textContent).toContain("Your team");
    expect(entries[0]!.textContent).toContain("Player mine");
    expect(entries[1]!.textContent).not.toContain("Your team");
    expect(screen.getAllByRole("img", { name: "Overall 71" })).toHaveLength(2);
  });

  it("opens the player drawer from a player name", () => {
    render(<TransactionTicker saveId="s" ticker={view([item("a")])} />);
    fireEvent.click(screen.getByRole("button", { name: "Player a" }));
    expect(openPlayer).toHaveBeenCalledWith("p_a");
  });

  it("shows an empty state", () => {
    const { rerender } = render(
      <TransactionTicker saveId="s" ticker={view([])} />,
    );
    expect(screen.getByText("No moves yet")).toBeTruthy();
    rerender(
      <TransactionTicker
        saveId="s"
        ticker={view([], { window: "deadline", title: "Trade deadline" })}
      />,
    );
    expect(
      screen.getByText("Deadline day: moves will appear here"),
    ).toBeTruthy();
  });

  it("shows the deadline summary card", () => {
    render(
      <TransactionTicker
        saveId="s"
        ticker={view([item("t", { kind: "trade" })], {
          window: "deadline",
          title: "Trade deadline",
          status: "Deadline passed",
          summary: { trades: 2, biggestMove: "BAL get Q. Holt" },
        })}
      />,
    );
    expect(screen.getByText(/Deadline is over: 2 trades/)).toBeTruthy();
    expect(screen.getByText(/Biggest move: BAL get Q. Holt/)).toBeTruthy();
  });

  it("replaces items on a live update and announces new moves", () => {
    render(<TransactionTicker saveId="s" ticker={view([item("a")])} />);
    expect(document.querySelector("[aria-live=polite]")!.textContent).toBe("");
    act(() => {
      dispatchTickerUpdate(view([item("a"), item("b"), item("c")]));
    });
    const list = screen.getByRole("list", { name: "Free agency moves" });
    expect(list.querySelectorAll("li")).toHaveLength(3);
    expect(document.querySelector("[aria-live=polite]")!.textContent).toBe(
      "2 new moves",
    );
    act(() => {
      dispatchTickerUpdate(null);
    });
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("uses no marquee or animation classes", () => {
    const { container } = render(
      <TransactionTicker saveId="s" ticker={view([item("a")])} />,
    );
    expect(container.innerHTML).not.toMatch(/animate-|marquee/);
  });
});
