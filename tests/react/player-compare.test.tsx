import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

vi.mock("server-only", () => ({}));

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/save_test/players/compare",
  useRouter: () => ({ replace, push: vi.fn(), refresh: () => {} }),
}));

import { resetSearchIndexCacheForTests } from "@/components/game/shell/CommandPalette";
import {
  PlayerComparePicker,
  rankPickerPlayers,
} from "@/components/player-compare/PlayerComparePicker";
import { setRatingDisplay } from "@/components/ui/rating-display";
import { PlayerCompareBoard } from "@/components/player-compare/PlayerCompareBoard";
import type { PlayerAttributes } from "@/domain/entities/player";
import type { PlayerCompareView } from "@/state/player-compare";

function attributes(value: number): PlayerAttributes {
  return {
    speed: value,
    strength: value,
    athleticism: value,
    stamina: value,
    finishing: value,
    midRange: value,
    threePoint: value,
    freeThrow: value,
    ballHandling: value,
    passing: value,
    perimeterDefense: value,
    interiorDefense: value,
    steal: value,
    block: value,
    rebounding: value,
    basketballIq: value,
    offensiveIq: value,
    defensiveIq: value,
    consistency: value,
  };
}

function view(
  id: string,
  lastName: string,
  overall: number,
  attr: number,
): PlayerCompareView {
  return {
    playerId: id,
    firstName: "Test",
    lastName,
    position: "PG",
    age: 25,
    heightInches: 79,
    archetypeLabel: "Floor General",
    overall,
    teamAbbreviation: "HAR",
    contract: { salary: 12_400_000, yearsRemaining: 3 },
    attributes: attributes(attr),
  };
}

const INDEX = {
  players: [
    { id: "p1", name: "Marcus Reed", position: "PG", team: "HAR", overall: 78 },
    { id: "p2", name: "Reed Allen", position: "C", team: "FA", overall: 61 },
    {
      id: "p3",
      name: "Reed Rookie",
      position: "SF",
      team: "Draft",
      overall: null,
      prospect: true,
    },
  ].map((p) => ({ mine: false, prospect: false, ...p })),
  teams: [],
};

describe("PlayerCompareBoard", () => {
  afterEach(() => {
    cleanup();
    setRatingDisplay("grades");
  });

  it("shows both values and signed, coloured deltas (b minus a)", () => {
    // Ratings mode: every cell then carries the number as visible text.
    setRatingDisplay("ratings");
    render(
      <PlayerCompareBoard
        saveId="save_test"
        a={view("p1", "Alpha", 70, 60)}
        b={view("p2", "Bravo", 75, 58)}
      />,
    );
    const table = screen.getByRole("table");
    const overall = within(table).getByRole("row", { name: /Overall/ });
    const win = within(overall).getByText("+5");
    expect(win.className).toContain("text-win");
    expect(win.className).toContain("tabular-nums");

    const finishing = within(table).getByRole("row", { name: /Finishing/ });
    const loss = within(finishing).getByText("−2");
    expect(loss.className).toContain("text-loss");
    expect(within(finishing).getAllByText("60").length).toBeGreaterThan(0);
    expect(within(finishing).getAllByText("58").length).toBeGreaterThan(0);
    expect(within(table).getAllByText("Inside Scoring")).toHaveLength(1);
  });

  it("shows an identity line and OvrBadge for each loaded player", () => {
    render(
      <PlayerCompareBoard
        saveId="save_test"
        a={view("p1", "Alpha", 70, 60)}
        b={view("p2", "Bravo", 75, 58)}
      />,
    );
    expect(screen.getByRole("img", { name: "Overall 70" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Overall 75" })).toBeTruthy();
    expect(screen.getAllByText("$12.4M · 3y")).toHaveLength(2);
    expect(screen.getAllByText("Floor General")).toHaveLength(2);
  });

  it("shows a picker prompt for a missing slot and no table", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(INDEX))),
    );
    render(
      <PlayerCompareBoard
        saveId="save_test"
        a={view("p1", "Alpha", 70, 60)}
        b={null}
      />,
    );
    const second = screen.getByRole("region", { name: "Second player" });
    expect(within(second).getByText("Choose a player")).toBeTruthy();
    expect(within(second).getByRole("combobox")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    vi.unstubAllGlobals();
  });
});

describe("rankPickerPlayers", () => {
  it("drops prospects and the excluded player", () => {
    const ids = rankPickerPlayers(INDEX.players, "reed", "p1").map((p) => p.id);
    expect(ids).toEqual(["p2"]);
  });
});

describe("PlayerComparePicker", () => {
  beforeEach(() => {
    resetSearchIndexCacheForTests();
    replace.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(INDEX))),
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  async function openPicker(otherId: string | null = "p9") {
    render(
      <PlayerComparePicker
        saveId="save_test"
        slot="b"
        otherId={otherId}
        slotLabel="Second player"
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Change player/ }));
    });
    return screen.getByRole("combobox");
  }

  it("moves with arrow keys, picks with Enter and keeps the other slot", async () => {
    const input = await openPicker();
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options[0]!.getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(
      screen.getAllByRole("option")[1]!.getAttribute("aria-selected"),
    ).toBe("true");
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(replace).toHaveBeenCalledWith(
      "/dashboard/save_test/players/compare?a=p9&b=p2",
    );
  });

  it("excludes draft prospects from the listbox", async () => {
    const input = await openPicker();
    await act(async () => {
      fireEvent.change(input, { target: { value: "rookie" } });
    });
    expect(screen.queryByText("Reed Rookie")).toBeNull();
    expect(screen.getByText("No matches.")).toBeTruthy();
  });

  it("closes on Escape", async () => {
    const input = await openPicker();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByRole("button", { name: /Change player/ })).toBeTruthy();
  });
});
