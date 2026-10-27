import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

vi.mock("server-only", () => ({}));

const push = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/save_test/roster",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push, refresh: () => {} }),
}));

const openPlayer = vi.fn();
const openTeam = vi.fn();
vi.mock("@/components/entity/EntityDrawerProvider", () => ({
  useEntityDrawer: () => ({
    openPlayer,
    openTeam,
    openStaff: () => {},
    close: () => {},
  }),
}));

import {
  CommandPalette,
  resetSearchIndexCacheForTests,
} from "@/components/game/shell/CommandPalette";
import { SearchButton } from "@/components/game/shell/SearchButton";
import { OPEN_COMMAND_PALETTE } from "@/components/game/shell/hub-keys";
import { OWNER_NAV_GROUPS } from "@/application/owner-nav-config";
import { resetDrawerScrollLockForTests } from "@/components/ui/drawer-scroll-lock";

const INDEX = {
  players: [
    { id: "p1", name: "Marcus Reed", position: "PG", team: "HAR", overall: 78 },
    { id: "p2", name: "Reed Allen", position: "C", team: "FA", overall: 61 },
  ],
  teams: [{ id: "t1", name: "Harbor Waves", abbreviation: "HAR" }],
};

function mockFetch(ok = true) {
  const fetchMock = vi.fn(async () =>
    ok
      ? new Response(JSON.stringify(INDEX), { status: 200 })
      : new Response("{}", { status: 500 }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function openPalette() {
  await act(async () => {
    window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE));
  });
}

function renderPalette() {
  return render(
    <>
      <button type="button">trigger</button>
      <CommandPalette saveId="save_test" groups={OWNER_NAV_GROUPS} />
    </>,
  );
}

function input() {
  return screen.getByRole("combobox") as HTMLInputElement;
}

async function type(value: string) {
  await act(async () => {
    fireEvent.change(input(), { target: { value } });
  });
}

function optionLabels() {
  return screen.getAllByRole("option").map((o) => o.textContent ?? "");
}

describe("CommandPalette", () => {
  beforeEach(() => {
    push.mockClear();
    openPlayer.mockClear();
    openTeam.mockClear();
    resetSearchIndexCacheForTests();
    resetDrawerScrollLockForTests();
    mockFetch();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("opens on the window event with the current hub and actions", async () => {
    renderPalette();
    expect(screen.queryByRole("dialog")).toBeNull();
    await openPalette();
    expect(screen.getByRole("dialog").getAttribute("aria-modal")).toBe("true");
    expect(document.activeElement).toBe(input());
    expect(input().getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Pages")).toBeTruthy();
    expect(screen.getByText("Actions")).toBeTruthy();
    expect(optionLabels()).toContain("Team › Roster");
    expect(optionLabels()).not.toContain("League › Standings");
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("filters by every token and loads the index once", async () => {
    const fetchMock = mockFetch();
    renderPalette();
    await openPalette();
    await type("league stand");
    expect(optionLabels()).toEqual(["League › Standings"]);
    await type("reed");
    expect(screen.getByText("Players")).toBeTruthy();
    const names = optionLabels();
    // Label-prefix match ranks first.
    expect(names[0]).toContain("Reed Allen");
    expect(names[1]).toContain("Marcus Reed");
    await type("harbor");
    expect(screen.getByText("Teams")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/dashboard/save_test/search-index",
      expect.anything(),
    );
  });

  it("Enter pushes the page href and closes", async () => {
    renderPalette();
    await openPalette();
    await type("standings");
    const box = input();
    expect(box.getAttribute("aria-activedescendant")).toBe(
      screen.getAllByRole("option")[0]!.id,
    );
    await act(async () => {
      fireEvent.keyDown(box, { key: "ArrowUp" });
    });
    // A single result wraps back to itself.
    expect(box.getAttribute("aria-activedescendant")).toBe(
      screen.getAllByRole("option")[0]!.id,
    );
    await act(async () => {
      fireEvent.keyDown(box, { key: "Enter" });
    });
    expect(push).toHaveBeenCalledWith("/dashboard/save_test/league/standings");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("ArrowDown/ArrowUp move the active option and wrap", async () => {
    renderPalette();
    await openPalette();
    const box = input();
    const options = screen.getAllByRole("option");
    expect(box.getAttribute("aria-activedescendant")).toBe(options[0]!.id);
    await act(async () => {
      fireEvent.keyDown(box, { key: "ArrowUp" });
    });
    expect(box.getAttribute("aria-activedescendant")).toBe(
      options[options.length - 1]!.id,
    );
    await act(async () => {
      fireEvent.keyDown(box, { key: "ArrowDown" });
    });
    expect(box.getAttribute("aria-activedescendant")).toBe(options[0]!.id);
    // The last option is the notifications action.
    await act(async () => {
      fireEvent.keyDown(box, { key: "ArrowUp" });
    });
    await act(async () => {
      fireEvent.keyDown(box, { key: "Enter" });
    });
    expect(push).toHaveBeenCalledWith("/dashboard/save_test/notifications");
  });

  it("clicking an option activates it", async () => {
    renderPalette();
    await openPalette();
    fireEvent.click(screen.getByRole("option", { name: "Find a trade" }));
    expect(push).toHaveBeenCalledWith(
      "/dashboard/save_test/roster?tab=trade-finder",
    );
  });

  it("Sim to next game goes to the calendar next-game focus", async () => {
    renderPalette();
    await openPalette();
    await type("sim to next");
    await act(async () => {
      fireEvent.keyDown(input(), { key: "Enter" });
    });
    expect(push).toHaveBeenCalledWith(
      "/dashboard/save_test/calendar?focus=next-game",
    );
  });

  it("Sim to trade deadline opens the calendar on the deadline", async () => {
    renderPalette();
    await openPalette();
    await type("trade deadline");
    await act(async () => {
      fireEvent.keyDown(input(), { key: "Enter" });
    });
    expect(push).toHaveBeenCalledWith(
      "/dashboard/save_test/calendar?focus=trade-deadline",
    );
  });

  it("Esc closes, restores focus and releases the scroll lock", async () => {
    renderPalette();
    const trigger = screen.getByRole("button", { name: "trigger" });
    trigger.focus();
    await openPalette();
    await act(async () => {
      fireEvent.keyDown(input(), { key: "Escape" });
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(document.body.style.overflow).toBe("");
  });

  it("Enter on a player opens the player drawer and closes the palette", async () => {
    renderPalette();
    await openPalette();
    await type("marcus");
    await act(async () => {
      fireEvent.keyDown(input(), { key: "Enter" });
    });
    expect(openPlayer).toHaveBeenCalledWith("p1");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens the team drawer for a team result", async () => {
    renderPalette();
    await openPalette();
    await type("waves");
    fireEvent.click(screen.getByRole("option", { name: /Harbor Waves/ }));
    expect(openTeam).toHaveBeenCalledWith("t1");
  });

  it("typing / in the input does not close or reopen anything", async () => {
    renderPalette();
    await openPalette();
    const box = input();
    await act(async () => {
      fireEvent.keyDown(box, { key: "/" });
    });
    await type("a/b");
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(box.value).toBe("a/b");
    await openPalette();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(push).not.toHaveBeenCalled();
  });

  it("shows an error row when the index cannot be loaded", async () => {
    mockFetch(false);
    renderPalette();
    await openPalette();
    await type("reed");
    expect(screen.getByRole("alert").textContent).toMatch(
      /could not be loaded/,
    );
  });

  it("shows a loading row while the index is pending", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );
    renderPalette();
    await openPalette();
    await type("reed");
    expect(screen.getByText("Loading players…")).toBeTruthy();
  });
});

describe("SearchButton", () => {
  it("dispatches the open event", () => {
    const listener = vi.fn();
    window.addEventListener(OPEN_COMMAND_PALETTE, listener);
    render(<SearchButton />);
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(OPEN_COMMAND_PALETTE, listener);
  });
});
