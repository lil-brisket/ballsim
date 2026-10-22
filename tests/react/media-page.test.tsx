import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { GameState } from "@/state/game-state";
import { toMediaTimelinePageView } from "@/state/media-timeline/page-view";
import {
  finalGame,
  otherTeams,
  seasonDay,
  timelineState,
  viewerTeam,
  withGames,
} from "../state/media-timeline/fixtures";

let fixtureState: GameState;

vi.mock("@/application/game-service", () => ({
  loadMediaPageView: vi.fn(
    async (saveId: string, options: Record<string, string | undefined>) =>
      toMediaTimelinePageView(fixtureState, saveId, options),
  ),
}));
vi.mock("@/application/actions", () => ({
  markAllMediaReadAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound");
  },
}));

import MediaPage from "@/app/dashboard/[saveId]/media/page";

function playedState(): GameState {
  const base = timelineState();
  const others = otherTeams(base);
  const games = Array.from({ length: 4 }, (_, i) =>
    finalGame(base, {
      id: `g${i}`,
      date: seasonDay(55),
      home: i === 0 ? viewerTeam(base) : others[2 * i]!,
      away: others[2 * i + 1]!,
      homeScore: 130 + i,
      awayScore: 100,
    }),
  );
  const state = withGames(base, games);
  return {
    ...state,
    world: {
      ...state.world,
      calendar: { ...state.world.calendar, currentDate: seasonDay(56) },
    },
  };
}

async function renderPage(search: Record<string, string> = {}) {
  const page = await MediaPage({
    params: Promise.resolve({ saveId: "save_test" }),
    searchParams: Promise.resolve(search),
  });
  return render(page);
}

afterEach(cleanup);

describe("Media Hub page", () => {
  it("renders one h1, the feed and no primary button", async () => {
    fixtureState = playedState();
    const { container } = await renderPage();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("feed")).toBeTruthy();
    expect(screen.getByRole("button", { name: /mark all read/i })).toBeTruthy();
    for (const el of container.querySelectorAll("button, a")) {
      // The primary button style is the solid team plate.
      expect(el.className.split(/\s+/)).not.toContain("bg-team");
    }
  });

  it("shows the top story above the feed without repeating it", async () => {
    fixtureState = playedState();
    await renderPage();
    const top = screen.getByRole("region", { name: "Top story" });
    const topArticle = within(top).getByRole("article");
    const feedArticles = within(screen.getByRole("feed")).queryAllByRole(
      "article",
    );
    const topName = topArticle.textContent ?? "";
    expect(feedArticles.every((a) => a.textContent !== topName)).toBe(true);
  });

  it("lands an old ?tab=games link on the Scores filter", async () => {
    fixtureState = playedState();
    await renderPage({ tab: "games" });
    const current = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");
    expect(current.map((link) => link.textContent)).toContain("Scores");
    expect(screen.queryByRole("region", { name: "Top story" })).toBeNull();
  });

  it("greets a fresh save with a league-office post", async () => {
    fixtureState = timelineState();
    await renderPage();
    const articles = within(screen.getByRole("feed")).getAllByRole("article");
    expect(articles).toHaveLength(1);
    expect(articles[0]!.textContent).toMatch(/Welcome to the/);
    expect(screen.queryByRole("button", { name: /mark all read/i })).toBeNull();
  });
});
