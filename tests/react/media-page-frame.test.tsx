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

/** Games on three different days; day 55 is the latest, one goes to OT. */
function framedState(): GameState {
  const base = timelineState();
  const others = otherTeams(base);
  const days = [50, 53, 55, 55, 55, 54, 52];
  const games = days.map((day, i) =>
    finalGame(base, {
      id: `g${i}`,
      date: seasonDay(day),
      home: i === 3 ? viewerTeam(base) : others[(2 * i) % others.length]!,
      away: others[(2 * i + 1) % others.length]!,
      homeScore: 120 + i,
      awayScore: 100,
      periods:
        i === 4
          ? [
              { home: 25, away: 25 },
              { home: 25, away: 25 },
              { home: 25, away: 25 },
              { home: 25, away: 25 },
              { home: 24, away: 4 },
            ]
          : undefined,
    }),
  );
  const state = withGames(base, games);
  return {
    ...state,
    world: {
      ...state.world,
      calendar: { ...state.world.calendar, currentDate: seasonDay(55) },
    },
  };
}

async function renderPage() {
  const page = await MediaPage({
    params: Promise.resolve({ saveId: "save_test" }),
    searchParams: Promise.resolve({}),
  });
  return render(page);
}

afterEach(cleanup);

describe("Media Hub page frame", () => {
  it("keeps the unread count off the Mark all read button", async () => {
    fixtureState = framedState();
    await renderPage();
    const button = screen.getByRole("button", { name: /mark all read/i });
    expect(button.querySelector('[aria-label$="unread"]')).toBeNull();
    expect(button.textContent?.trim()).toBe("Mark all read");
  });

  it("shows the unread count once per filter nav, never in the header", async () => {
    fixtureState = framedState();
    await renderPage();
    const labels = screen
      .getAllByLabelText(/\d+ unread/)
      .map((el) => el.closest("nav, header"));
    // One in the mobile tabs and one in the xl list; none in the page header.
    expect(labels).toHaveLength(2);
    expect(labels.every((el) => el?.tagName === "NAV")).toBe(true);
    const navs = new Set(labels);
    expect(navs.size).toBe(2);
  });

  it("renders the rail heading on a single line", async () => {
    fixtureState = framedState();
    await renderPage();
    const rail = screen.getByLabelText("Around the league");
    const heading = within(rail).getByRole("heading", { name: /^Scores · / });
    const classes = heading.className.split(/\s+/);
    expect(classes).toContain("whitespace-nowrap");
    expect(classes).toContain("truncate");
  });

  it("lists scores as one divided list without per-row Final text", async () => {
    fixtureState = framedState();
    await renderPage();
    const rail = screen.getByLabelText("Around the league");
    const heading = within(rail).getByRole("heading", { name: /^Scores · / });
    const list = heading.closest("section")!.querySelector("ul")!;
    expect(list.className).toContain("divide-y");
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(list.textContent).not.toMatch(/final/i);
    expect(within(list).getAllByText("OT")).toHaveLength(1);
    for (const link of within(list).getAllByRole("link")) {
      expect(link.getAttribute("href")).toMatch(/\/games\//);
      expect(link.className).toContain("min-h-11");
    }
  });

  it("marks the user's game with the team-ink edge", async () => {
    fixtureState = framedState();
    await renderPage();
    const rail = screen.getByLabelText("Around the league");
    const links = within(rail).getAllByRole("link", {
      name: (_, el) => el.getAttribute("href")?.includes("/games/") ?? false,
    });
    const mine = links.filter((l) => l.className.includes("border-team-ink"));
    expect(mine).toHaveLength(1);
    expect(
      links.filter((l) => l.className.includes("border-transparent")),
    ).toHaveLength(links.length - 1);
  });

  it("puts day dividers between posts from different dates", async () => {
    fixtureState = framedState();
    await renderPage();
    const feed = screen.getByRole("feed");
    const dividers = within(feed).getAllByRole("separator");
    expect(dividers.length).toBeGreaterThanOrEqual(2);
    const labels = dividers.map((d) => d.textContent);
    expect(labels).toContain("Today");
    expect(labels.some((l) => /^[A-Z][a-z]{2} \d{1,2}$/.test(l ?? ""))).toBe(
      true,
    );
    expect(new Set(labels).size).toBe(labels.length);
    // Articles stay direct feed items.
    for (const article of within(feed).getAllByRole("article")) {
      expect(article.parentElement).toBe(feed);
    }
  });
});
