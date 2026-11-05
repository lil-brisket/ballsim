import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ pathname: "/team", search: "" }));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
}));

import { NavigationPendingBar } from "@/components/game/shell/NavigationPendingBar";

function setup() {
  const view = render(
    <>
      <NavigationPendingBar />
      <a href="/league" onClick={(event) => event.preventDefault()}>
        League
      </a>
      <a href="/team" onClick={(event) => event.preventDefault()}>
        Same page
      </a>
      <a href="/team?tab=stats" onClick={(event) => event.preventDefault()}>
        Stats
      </a>
      <a href="/api/saves/s1/export" onClick={(e) => e.preventDefault()}>
        Export
      </a>
    </>,
  );
  const shown = () =>
    screen
      .getByTestId("navigation-pending-bar")
      .classList.contains("opacity-100");
  return { ...view, shown };
}

beforeEach(() => {
  nav.pathname = "/team";
  nav.search = "";
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("NavigationPendingBar", () => {
  it("shows after a link click and ends when the page changes", () => {
    const { shown, rerender } = setup();
    expect(shown()).toBe(false);

    fireEvent.click(screen.getByRole("link", { name: "League" }));
    expect(shown()).toBe(true);

    nav.pathname = "/league";
    rerender(<NavigationPendingBar />);
    expect(shown()).toBe(false);
  });

  it("treats a query change as a navigation", () => {
    const { shown, rerender } = setup();
    fireEvent.click(screen.getByRole("link", { name: "Stats" }));
    expect(shown()).toBe(true);

    nav.search = "tab=stats";
    rerender(<NavigationPendingBar />);
    expect(shown()).toBe(false);
  });

  it("ignores the current page, new-tab clicks and file downloads", () => {
    const { shown } = setup();
    fireEvent.click(screen.getByRole("link", { name: "Same page" }));
    fireEvent.click(screen.getByRole("link", { name: "League" }), {
      ctrlKey: true,
    });
    fireEvent.click(screen.getByRole("link", { name: "Export" }));
    expect(shown()).toBe(false);
  });

  it("gives up when a navigation never lands", () => {
    vi.useFakeTimers();
    const { shown } = setup();
    fireEvent.click(screen.getByRole("link", { name: "League" }));
    expect(shown()).toBe(true);

    act(() => vi.advanceTimersByTime(15_000));
    expect(shown()).toBe(false);
  });
});
