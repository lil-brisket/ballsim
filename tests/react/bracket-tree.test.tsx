import { afterEach, describe, expect, it } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import type { Game } from "@/domain/entities/game";
import type { PlayoffSeries } from "@/domain/entities/playoffs";
import { asGameId, asTeamId } from "@/domain/ids";
import { BracketTree } from "@/components/playoffs/BracketTree";
import type { GameState } from "@/state/game-state";
import { layoutBracket } from "@/state/playoff-bracket-layout";
import { toPlayoffHubView } from "@/state/playoff-hub-selectors";
import { createTestGame } from "../factories/game";
import {
  conferenceBracketState,
  leagueWideState,
} from "../state/playoff-bracket-fixtures";

afterEach(cleanup);

const east1 = asTeamId("conf_east_1");
const east8 = asTeamId("conf_east_8");

function patchSeries(
  state: GameState,
  id: string,
  patch: Partial<PlayoffSeries>,
  games: Record<string, Game> = {},
): GameState {
  return {
    ...state,
    competition: {
      ...state.competition,
      games: { ...state.competition.games, ...games },
      playoffs: {
        ...state.competition.playoffs,
        series: state.competition.playoffs.series.map((s) =>
          s.id === id ? { ...s, ...patch } : s,
        ),
      },
    },
  };
}

function finalGame(id: string): Game {
  return {
    ...createTestGame({
      id: asGameId(id),
      homeTeamId: east1,
      awayTeamId: east8,
    }),
    status: "final",
    date: "2027-04-20",
    score: { home: 110, away: 98 },
  };
}

/** 8-team league-wide: opener 0 won by the owner (#1); the other openers are live. */
function midPlayoffs(): GameState {
  const base = leagueWideState(1, 16, 8, "bracket-tree");
  const decided = patchSeries(
    base,
    "playoff_r0_s0",
    {
      higherSeedTeamId: east1,
      lowerSeedTeamId: east8,
      wins: { [east1]: 4, [east8]: 2 },
      gameIds: [asGameId("game_1"), asGameId("game_2")],
      status: "complete",
      winnerTeamId: east1,
    },
    { game_1: finalGame("game_1") },
  );
  return decided;
}

function renderTree(state: GameState) {
  const hub = toPlayoffHubView(state);
  return render(
    <BracketTree saveId="save_1" hub={hub} layout={layoutBracket(hub)} />,
  );
}

const desktop = () => screen.getByRole("group", { name: "Playoff bracket" });
const round = () => screen.getByRole("region", { name: /^Playoff round:/ });

describe("BracketTree desktop", () => {
  it("renders every series as a button with a descriptive name", () => {
    renderTree(midPlayoffs());
    const slots = within(desktop()).getAllByRole("button");
    expect(slots).toHaveLength(7);
    expect(slots.every((slot) => slot.hasAttribute("data-focus-item"))).toBe(
      true,
    );
    const decided = within(desktop()).getByRole("button", {
      name: "quarterfinal: #1 conf_east T1 4 (your team), #8 conf_east T8 2, conf_east T1 won",
    });
    expect(decided.tagName).toBe("BUTTON");
    expect(
      within(desktop()).getByRole("button", {
        name: /^quarterfinal: #4 conf_east T4 0, #5 conf_east T5 0, in progress$/,
      }),
    ).toBeTruthy();
    expect(
      within(desktop()).getByRole("button", {
        name: "final: TBD, TBD, not started",
      }),
    ).toBeTruthy();
  });

  it("marks the winner and the user's team with text, not only colour", () => {
    renderTree(midPlayoffs());
    const decided = within(desktop())
      .getAllByRole("button")
      .find((slot) => slot.getAttribute("data-series-id") === "playoff_r0_s0")!;
    expect(within(decided).getByText("won series")).toBeTruthy();
    expect(decided.textContent).toContain("✓");
    expect(within(decided).getByText("(your team)")).toBeTruthy();
    // Only the winner is marked.
    expect(within(decided).getAllByText("won series")).toHaveLength(1);
    const other = within(desktop())
      .getAllByRole("button")
      .find((slot) => slot.getAttribute("data-series-id") === "playoff_r0_s2")!;
    expect(within(other).queryByText("won series")).toBeNull();
    expect(within(other).queryByText("(your team)")).toBeNull();
  });

  it("badges the live series", () => {
    renderTree(midPlayoffs());
    // Openers 1-3 are live; the decided opener and later rounds are not.
    expect(within(desktop()).getAllByText("Live")).toHaveLength(3);
    const decided = within(desktop())
      .getAllByRole("button")
      .find((slot) => slot.getAttribute("data-series-id") === "playoff_r0_s0")!;
    expect(decided.parentElement?.textContent).not.toContain("Live");
  });

  it("draws one connector per feeder link in an aria-hidden svg", () => {
    const { container } = renderTree(midPlayoffs());
    const svg = container.querySelector("svg[aria-hidden='true']")!;
    expect(svg.querySelectorAll("path")).toHaveLength(6);
  });

  it("opens the series drawer with game links", () => {
    renderTree(midPlayoffs());
    fireEvent.click(
      within(desktop())
        .getAllByRole("button")
        .find(
          (slot) => slot.getAttribute("data-series-id") === "playoff_r0_s0",
        )!,
    );
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("heading", {
        name: "quarterfinal: conf_east T1 vs conf_east T8",
      }),
    ).toBeTruthy();
    const links = within(dialog).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/dashboard/save_1/games/game_1",
      "/dashboard/save_1/games/game_2",
    ]);
    expect(links[0]!.textContent).toContain("Game 1");
    expect(links[0]!.textContent).toContain("T8 98 @ T1 110");
    // game_2 is not stored anywhere: it still links, with no score.
    expect(links[1]!.textContent).toContain("Scheduled");
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("BracketTree below lg", () => {
  const tabs = () =>
    within(screen.getByRole("navigation", { name: "Playoff rounds" }));

  it("renders both branches and starts on the round with a live series", () => {
    renderTree(midPlayoffs());
    expect(desktop()).toBeTruthy();
    expect(tabs().getAllByRole("button")).toHaveLength(3);
    expect(round().getAttribute("aria-label")).toBe(
      "Playoff round: quarterfinal",
    );
    expect(
      tabs()
        .getByRole("button", { name: "quarterfinal" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(within(round()).getAllByRole("button")).toHaveLength(4);
  });

  it("starts on the last round when nothing is live", () => {
    const base = leagueWideState(1, 16, 8, "bracket-tree-idle");
    renderTree({
      ...base,
      competition: {
        ...base.competition,
        playoffs: {
          ...base.competition.playoffs,
          series: base.competition.playoffs.series.map((s) => ({
            ...s,
            status: "pending" as const,
          })),
        },
      },
    });
    expect(round().getAttribute("aria-label")).toBe("Playoff round: final");
  });

  it("switches rounds from the tabs", () => {
    renderTree(midPlayoffs());
    fireEvent.click(tabs().getByRole("button", { name: "semifinal" }));
    expect(round().getAttribute("aria-label")).toBe("Playoff round: semifinal");
    expect(within(round()).getAllByRole("button")).toHaveLength(2);
  });

  it("moves between tabs with ArrowLeft and ArrowRight only", () => {
    renderTree(midPlayoffs());
    const first = tabs().getByRole("button", { name: "quarterfinal" });
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(round().getAttribute("aria-label")).toBe("Playoff round: semifinal");
    expect(document.activeElement?.textContent).toBe("semifinal");
    fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" });
    fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" });
    expect(round().getAttribute("aria-label")).toBe("Playoff round: final");
    fireEvent.keyDown(document.activeElement!, { key: "ArrowLeft" });
    expect(round().getAttribute("aria-label")).toBe("Playoff round: semifinal");
    // Q and E belong to the shell's previous/next hub keys.
    fireEvent.keyDown(document.activeElement!, { key: "q" });
    fireEvent.keyDown(document.activeElement!, { key: "e" });
    fireEvent.keyDown(document, { key: "e" });
    expect(round().getAttribute("aria-label")).toBe("Playoff round: semifinal");
  });

  it("changes round on a horizontal swipe, ignoring short or vertical ones", () => {
    renderTree(midPlayoffs());
    const swipe = (from: number, to: number, fromY = 0, toY = 0) => {
      fireEvent.pointerDown(round(), { clientX: from, clientY: fromY });
      fireEvent.pointerUp(round(), { clientX: to, clientY: toY });
    };
    swipe(200, 190);
    expect(round().getAttribute("aria-label")).toBe(
      "Playoff round: quarterfinal",
    );
    swipe(200, 100, 0, 150);
    expect(round().getAttribute("aria-label")).toBe(
      "Playoff round: quarterfinal",
    );
    swipe(200, 100);
    expect(round().getAttribute("aria-label")).toBe("Playoff round: semifinal");
    swipe(100, 200);
    expect(round().getAttribute("aria-label")).toBe(
      "Playoff round: quarterfinal",
    );
  });
});

describe("BracketTree conference bracket", () => {
  it("labels tabs and columns with the conference", () => {
    const state = conferenceBracketState(2, 10, 4, "bracket-tree-conf");
    renderTree(state);
    const tabs = within(
      screen.getByRole("navigation", { name: "Playoff rounds" }),
    ).getAllByRole("button");
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "EAST First Round",
      "EAST Conference Finals",
      "Finals",
      "WEST Conference Finals",
      "WEST First Round",
    ]);
  });
});
