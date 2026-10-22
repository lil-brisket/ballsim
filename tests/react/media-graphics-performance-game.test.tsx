import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { GameAttachmentCard } from "@/components/media-hub/timeline/GameAttachmentCard";
import { PerformanceAttachmentCard } from "@/components/media-hub/timeline/PerformanceAttachmentCard";
import {
  contrastRatio,
  readableTextOnBackground,
} from "@/domain/color-contrast";
import type { TimelineDisplayContext } from "@/state/media-timeline/post-view";
import type {
  GameAttachment,
  PerformanceAttachment,
  TimelineStatLine,
  TimelineTeamRef,
} from "@/state/media-timeline/types";

afterEach(cleanup);

function team(id: string, abbreviation: string): TimelineTeamRef {
  return {
    teamId: id,
    abbreviation,
    displayName: `${abbreviation} City`,
    name: abbreviation,
    branding: null,
  };
}

function brand(primaryColor: string, secondaryColor = "#888888") {
  return {
    primaryColor,
    secondaryColor,
    accentColor: "#777777",
    logoId: "bull",
  };
}

const HOME = team("home", "HOM");
const AWAY = team("away", "AWY");

function ctx(
  homePrimary: string | null,
  awayPrimary: string | null,
): TimelineDisplayContext {
  return {
    saveId: "s1",
    teams: {
      home: { branding: homePrimary ? brand(homePrimary) : null, href: "/t" },
      away: { branding: awayPrimary ? brand(awayPrimary) : null, href: "/t" },
    },
    portraits: {},
  };
}

const LINE: TimelineStatLine = {
  minutes: 33.4,
  points: 31,
  rebounds: 8,
  assists: 6,
  steals: 1,
  blocks: 2,
  fieldGoalsMade: 12,
  fieldGoalsAttempted: 21,
  threePointersMade: 3,
  threePointersAttempted: 7,
};

function game(): GameAttachment {
  const performer = (id: string) => ({
    player: { playerId: id, firstName: "Al", lastName: id, teamId: null },
    line: LINE,
  });
  return {
    type: "game",
    gameId: "g1",
    date: "2026-10-08",
    competitionType: "regular_season",
    home: HOME,
    away: AWAY,
    score: { home: 101, away: 97 },
    periodScores: [
      { home: 25, away: 20 },
      { home: 25, away: 25 },
      { home: 25, away: 26 },
      { home: 26, away: 26 },
    ],
    overtimePeriods: 0,
    winnerTeamId: "home",
    margin: 4,
    reasons: [],
    comebackDeficit: 0,
    winPctBefore: { home: null, away: null },
    topPerformers: { home: performer("p1"), away: performer("p2") },
    series: null,
  };
}

function perf(): PerformanceAttachment {
  return {
    type: "performance",
    gameId: "g1",
    player: {
      playerId: "p1",
      firstName: "Al",
      lastName: "One",
      teamId: "home",
    },
    team: HOME,
    opponent: AWAY,
    won: true,
    line: LINE,
    reasons: ["season_high"],
  };
}

function renderGame(c: TimelineDisplayContext) {
  return render(
    <GameAttachmentCard attachment={game()} context={c} boxScoreHref="/b" />,
  );
}

describe("game final-score graphic", () => {
  it("renders the numbers it was given", () => {
    const { container } = renderGame(ctx("#0B1F3A", "#C4CED4"));
    const text = container.textContent ?? "";
    for (const n of ["101", "97", "HOM", "AWY", "Final"]) {
      expect(text).toContain(n);
    }
    expect(text).toContain("31 PTS · 8 REB · 6 AST");
  });

  it.each(["#FFFFFF", "#F4F4F5", "#0B1F3A", "#C4CED4", "#39FF14", "#0A0A0A"])(
    "keeps score text readable on %s",
    (primary) => {
      const { container } = renderGame(ctx(primary, primary));
      const halves =
        container.querySelectorAll<HTMLElement>("[data-score-half]");
      expect(halves.length).toBe(2);
      halves.forEach((half) => {
        const expected = readableTextOnBackground(primary);
        expect(half.style.color.toLowerCase()).toBe(hexToRgb(expected));
        expect(contrastRatio(expected, primary)!).toBeGreaterThanOrEqual(4.5);
      });
    },
  );

  it("uses a neutral half without branding and has no amber or mono", () => {
    const { container } = renderGame(ctx(null, "#0B1F3A"));
    const [away, home] =
      container.querySelectorAll<HTMLElement>("[data-score-half]");
    expect(away.style.backgroundColor).not.toBe("");
    expect(home.className).toContain("bg-zinc-800");
    expect(withoutPortraits(container)).not.toContain("amber");
    expect(withoutPortraits(container)).not.toContain("font-mono");
  });

  it("has one team surface and team-uniform portraits", () => {
    const { container } = renderGame(ctx("#0B1F3A", "#C4CED4"));
    expect(container.querySelectorAll("[data-team-band]").length).toBe(1);
    const portraits = container.querySelectorAll("[data-portrait-size]");
    expect(portraits.length).toBe(2);
    portraits.forEach((p) =>
      expect(p.getAttribute("data-portrait-uniform")).toBe("team"),
    );
  });
});

describe("performance lower third", () => {
  it("renders the numbers it was given with one surface and uniform", () => {
    const { container } = render(
      <PerformanceAttachmentCard
        attachment={perf()}
        context={ctx("#0B1F3A", "#C4CED4")}
      />,
    );
    const text = container.textContent ?? "";
    for (const n of ["31", "8", "6", "12–21", "3–7", "33", "AWY", "W"]) {
      expect(text).toContain(n);
    }
    expect(container.querySelectorAll("[data-team-band]").length).toBe(1);
    expect(
      container
        .querySelector("[data-portrait-size]")!
        .getAttribute("data-portrait-uniform"),
    ).toBe("team");
    expect(withoutPortraits(container)).not.toContain("amber");
    expect(withoutPortraits(container)).not.toContain("font-mono");
  });

  it("omits the uniform when branding is missing", () => {
    const { container } = render(
      <PerformanceAttachmentCard
        attachment={perf()}
        context={ctx(null, null)}
      />,
    );
    expect(
      container
        .querySelector("[data-portrait-size]")!
        .getAttribute("data-portrait-uniform"),
    ).toBeNull();
  });
});

function hexToRgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

/** Portrait art owns its own palette and initials font; check everything else. */
function withoutPortraits(container: HTMLElement): string {
  const clone = container.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("[data-portrait-size]").forEach((el) => el.remove());
  return clone.innerHTML;
}
