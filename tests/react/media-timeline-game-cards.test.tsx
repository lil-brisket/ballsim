import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { GameAttachmentCard } from "@/components/media-hub/timeline/GameAttachmentCard";
import { PerformanceAttachmentCard } from "@/components/media-hub/timeline/PerformanceAttachmentCard";
import type { TimelineDisplayContext } from "@/state/media-timeline/post-view";
import type {
  GameAttachment,
  PerformanceAttachment,
  PerformanceReason,
  TimelinePerformer,
  TimelineStatLine,
  TimelineTeamRef,
} from "@/state/media-timeline/types";

afterEach(cleanup);

const LIGHT = {
  primaryColor: "#F5F5DC",
  secondaryColor: "#FFFFFF",
  accentColor: "#EEEEEE",
  logoId: "bull",
};
const DARK = {
  primaryColor: "#0A0A12",
  secondaryColor: "#111111",
  accentColor: "#222222",
  logoId: "bull",
};

function teamRef(id: string, abbreviation: string): TimelineTeamRef {
  return {
    teamId: id,
    abbreviation,
    displayName: `${abbreviation} City`,
    name: abbreviation,
    branding: null,
  };
}

const TOR = teamRef("tor", "TOR");
const BOS = teamRef("bos", "BOS");

const context: TimelineDisplayContext = {
  saveId: "s1",
  teams: {
    tor: { branding: LIGHT, href: "/t/tor" },
    bos: { branding: DARK, href: "/t/bos" },
  },
  portraits: { p1: null, p2: null },
};

function line(over: Partial<TimelineStatLine> = {}): TimelineStatLine {
  return {
    minutes: 36,
    points: 38,
    rebounds: 11,
    assists: 7,
    steals: 2,
    blocks: 3,
    fieldGoalsMade: 14,
    fieldGoalsAttempted: 25,
    threePointersMade: 4,
    threePointersAttempted: 9,
    ...over,
  };
}

function performer(
  id: string,
  first: string,
  last: string,
  over: Partial<TimelineStatLine> = {},
): TimelinePerformer {
  return {
    player: { playerId: id, firstName: first, lastName: last, teamId: null },
    line: line(over),
  };
}

function game(over: Partial<GameAttachment> = {}): GameAttachment {
  return {
    type: "game",
    gameId: "g1",
    date: "2026-10-08",
    competitionType: "regular_season",
    home: TOR,
    away: BOS,
    score: { home: 112, away: 104 },
    periodScores: [
      { home: 30, away: 25 },
      { home: 28, away: 27 },
      { home: 26, away: 24 },
      { home: 28, away: 28 },
    ],
    overtimePeriods: 0,
    winnerTeamId: "tor",
    margin: 8,
    reasons: ["user_team"],
    comebackDeficit: 0,
    winPctBefore: { home: null, away: null },
    topPerformers: {
      home: performer("p1", "Leo", "Drake"),
      away: performer("p2", "Mia", "Voss", {
        points: 29,
        rebounds: 5,
        assists: 12,
      }),
    },
    series: null,
    ...over,
  };
}

function renderGame(a: GameAttachment, boxScoreHref: string | null = null) {
  return render(
    <GameAttachmentCard
      attachment={a}
      context={context}
      boxScoreHref={boxScoreHref}
    />,
  );
}

describe("GameAttachmentCard", () => {
  it("renders the attachment's scores in the score bug", () => {
    renderGame(game());
    expect(screen.getByText("Final: BOS 104, TOR 112, Oct 8")).toBeTruthy();
  });

  it("labels overtime columns OT and 2OT", () => {
    const ot = game({
      score: { home: 120, away: 118 },
      overtimePeriods: 1,
      periodScores: [...game().periodScores, { home: 8, away: 6 }],
    });
    renderGame(ot);
    expect(screen.getByText(/^Final\/OT:/)).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "OT" })).toBeTruthy();
    cleanup();

    renderGame(
      game({
        overtimePeriods: 2,
        periodScores: [
          ...game().periodScores,
          { home: 8, away: 6 },
          { home: 5, away: 5 },
        ],
      }),
    );
    expect(screen.getByRole("columnheader", { name: "OT" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "2OT" })).toBeTruthy();
  });

  it("has one column per period plus a total, matching periodScores", () => {
    const a = game();
    renderGame(a);
    const table = screen.getByRole("table", { name: "Score by quarter" });
    const headers = within(table)
      .getAllByRole("columnheader")
      .map((h) => h.textContent);
    expect(headers).toEqual(["Team", "Q1", "Q2", "Q3", "Q4", "Total"]);
    const rows = within(table).getAllByRole("row").slice(1);
    const cells = rows.map((r) =>
      within(r)
        .getAllByRole("cell")
        .map((c) => c.textContent),
    );
    expect(cells[0]).toEqual(["25", "27", "24", "28", "104"]);
    expect(cells[1]).toEqual(["30", "28", "26", "28", "112"]);
    expect(rows[0].textContent?.startsWith("BOS")).toBe(true);
    expect(rows[1].textContent?.startsWith("TOR")).toBe(true);
  });

  it("describes series leads, ties and clinches", () => {
    const lead = game({
      series: {
        seriesId: "s",
        roundLabel: "Finals",
        wins: { tor: 3, bos: 1 },
        gameNumber: 4,
        winsToClinch: 4,
      },
    });
    renderGame(lead);
    expect(screen.getByText("TOR leads 3–1")).toBeTruthy();
    expect(screen.getByText(/Finals/)).toBeTruthy();
    cleanup();

    renderGame(
      game({
        series: {
          seriesId: "s",
          roundLabel: "Finals",
          wins: { tor: 2, bos: 2 },
          gameNumber: 4,
          winsToClinch: 4,
        },
      }),
    );
    expect(screen.getByText("Series tied 2–2")).toBeTruthy();
    cleanup();

    renderGame(
      game({
        series: {
          seriesId: "s",
          roundLabel: "Finals",
          wins: { tor: 1, bos: 4 },
          gameNumber: 5,
          winsToClinch: 4,
        },
      }),
    );
    expect(screen.getByText("BOS wins 4–1")).toBeTruthy();
  });

  it("shows no series line for non-series games", () => {
    renderGame(game());
    expect(screen.queryByText(/leads|wins|tied/)).toBeNull();
  });

  it("shows each top performer's pts, reb and ast and skips null sides", () => {
    renderGame(game());
    expect(screen.getByText("38 PTS · 11 REB · 7 AST")).toBeTruthy();
    expect(screen.getByText("29 PTS · 5 REB · 12 AST")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Leo Drake" }).getAttribute("href"),
    ).toBe("/dashboard/s1/players/p1");
    cleanup();

    renderGame(
      game({
        topPerformers: { home: null, away: performer("p2", "Mia", "Voss") },
      }),
    );
    expect(screen.queryByRole("link", { name: "Leo Drake" })).toBeNull();
    expect(screen.getByRole("link", { name: "Mia Voss" })).toBeTruthy();
  });

  it("shows the box score link only with an href", () => {
    renderGame(game());
    expect(screen.queryByRole("link", { name: "Box score" })).toBeNull();
    cleanup();
    renderGame(game(), "/dashboard/s1/games/g1");
    const link = screen.getByRole("link", { name: "Box score" });
    expect(link.getAttribute("href")).toBe("/dashboard/s1/games/g1");
    expect(link.className).toContain("min-h-11");
  });

  it("shows a single muted label for comebacks and upsets only", () => {
    renderGame(game({ reasons: ["comeback"], comebackDeficit: 18 }));
    expect(screen.getByText("Comeback from 18 down")).toBeTruthy();
    cleanup();
    renderGame(game({ reasons: ["upset"] }));
    expect(screen.getByText("Upset")).toBeTruthy();
    cleanup();
    renderGame(game({ reasons: ["user_team"] }));
    expect(screen.queryByText("Upset")).toBeNull();
  });

  it("hides portraits and badges from assistive tech", () => {
    const { container } = renderGame(game());
    const portraits = container.querySelectorAll("[data-portrait-size]");
    expect(portraits.length).toBe(2);
    portraits.forEach((p) =>
      expect(p.getAttribute("aria-hidden")).toBe("true"),
    );
    expect(container.querySelectorAll('[role="img"]').length).toBe(0);
  });

  it("uses no mono text", () => {
    const { container } = renderGame(game(), "/b");
    const mono = Array.from(container.querySelectorAll(".font-mono")).filter(
      (el) => !el.closest("[data-portrait-size]"),
    );
    expect(mono).toEqual([]);
  });
});

function perf(
  reasons: PerformanceReason[],
  over: Partial<TimelineStatLine> = {},
): PerformanceAttachment {
  return {
    type: "performance",
    gameId: "g1",
    player: {
      playerId: "p1",
      firstName: "Leo",
      lastName: "Drake",
      teamId: "tor",
    },
    team: TOR,
    opponent: BOS,
    won: true,
    line: line({ points: 44, ...over }),
    reasons,
  };
}

function renderPerf(a: PerformanceAttachment) {
  return render(<PerformanceAttachmentCard attachment={a} context={context} />);
}

describe("PerformanceAttachmentCard", () => {
  it("renders every number in the stat strip from the stat line", () => {
    const a = perf(["forty_points"]);
    renderPerf(a);
    const value = (label: string) =>
      screen.getByText(label).parentElement!.textContent!.replace(label, "");
    expect(value("PTS")).toBe("44");
    expect(value("REB")).toBe("11");
    expect(value("AST")).toBe("7");
    expect(value("STL")).toBe("2");
    expect(value("BLK")).toBe("3");
    expect(value("FG")).toBe("14–25");
    expect(value("3P")).toBe("4–9");
    expect(value("MIN")).toBe("36");
  });

  it("shows identity, opponent and result", () => {
    const { container } = renderPerf(perf(["season_high"]));
    expect(
      screen.getByRole("link", { name: "Leo Drake" }).getAttribute("href"),
    ).toBe("/dashboard/s1/players/p1");
    expect(screen.getByText("vs")).toBeTruthy();
    expect(screen.getByText("BOS")).toBeTruthy();
    expect(screen.getByText("W")).toBeTruthy();
    const portrait = container.querySelector("[data-portrait-size]")!;
    expect(portrait.getAttribute("aria-hidden")).toBe("true");
    cleanup();
    renderPerf({ ...perf(["season_high"]), won: false });
    expect(screen.getByText("L")).toBeTruthy();
  });

  it.each<[PerformanceReason[], string]>([
    [["twenty_twenty"], "20-20 game"],
    [["triple_double"], "Triple-double"],
    [["season_high"], "Season high"],
    [["forty_points", "season_high"], "Season high"],
  ])("describes %j as %s", (reasons, expected) => {
    renderPerf(perf(reasons));
    expect(screen.getByText(expected)).toBeTruthy();
  });

  it.each<PerformanceReason>(["forty_points", "blocks", "steals", "assists"])(
    "adds no note for %s, which the stat strip already shows",
    (reason) => {
      renderPerf(perf([reason]));
      expect(
        screen.queryByText(/-point night| blocks| steals| assists/),
      ).toBeNull();
    },
  );

  it("uses no mono text", () => {
    const { container } = renderPerf(perf(["forty_points"]));
    const mono = Array.from(container.querySelectorAll(".font-mono")).filter(
      (el) => !el.closest("[data-portrait-size]"),
    );
    expect(mono).toEqual([]);
  });
});
