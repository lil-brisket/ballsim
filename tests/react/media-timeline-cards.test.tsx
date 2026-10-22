import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { AwardAttachmentCard } from "@/components/media-hub/timeline/AwardAttachmentCard";
import { InjuryAttachmentCard } from "@/components/media-hub/timeline/InjuryAttachmentCard";
import { PlayoffAttachmentCard } from "@/components/media-hub/timeline/PlayoffAttachmentCard";
import { SigningAttachmentCard } from "@/components/media-hub/timeline/SigningAttachmentCard";
import { StreakAttachmentCard } from "@/components/media-hub/timeline/StreakAttachmentCard";
import { TradeAttachmentCard } from "@/components/media-hub/timeline/TradeAttachmentCard";
import type { PlayerPortraitAssignment } from "@/domain/entities/player-portrait";
import type { TeamBranding } from "@/domain/entities/team-branding";
import type { TimelineDisplayContext } from "@/state/media-timeline/post-view";
import type {
  AwardAttachment,
  InjuryAttachment,
  PlayoffAttachment,
  SigningAttachment,
  StreakAttachment,
  TimelinePlayerRef,
  TimelineTeamRef,
  TradeAttachment,
} from "@/state/media-timeline/types";

afterEach(cleanup);

const LIGHT: TeamBranding = {
  primaryColor: "#F5F5DC",
  secondaryColor: "#FFFFFF",
  accentColor: "#EEEEEE",
  logoId: "bull",
};
const DARK: TeamBranding = {
  primaryColor: "#050505",
  secondaryColor: "#111111",
  accentColor: "#222222",
  logoId: "bull",
};

function team(
  id: string,
  abbreviation: string,
  name: string,
  branding: TeamBranding | null,
): TimelineTeamRef {
  return {
    teamId: id,
    abbreviation,
    displayName: `City ${name}`,
    name,
    branding,
  };
}

const TOR = team("t1", "TOR", "Raptors", LIGHT);
const DEN = team("t2", "DEN", "Nuggets", DARK);

function player(id: string, first: string, last: string): TimelinePlayerRef {
  return { playerId: id, firstName: first, lastName: last, teamId: null };
}

const LEO = player("p1", "Leo", "Drake");
const MIA = player("p2", "Mia", "Voss");

const PORTRAIT: PlayerPortraitAssignment = {
  version: 1,
  salt: 0,
  traits: {
    skinTone: 0,
    faceShape: 0,
    hairStyle: 0,
    hairColor: 0,
    facialHair: 0,
    brows: 0,
    eyes: 0,
    nose: 0,
    mouth: 0,
    ears: 0,
    accessory: 0,
  },
};

const context: TimelineDisplayContext = {
  saveId: "s1",
  teams: {
    t1: { branding: LIGHT, href: "/dashboard/s1/teams/t1" },
    t2: { branding: DARK, href: "/dashboard/s1/teams/t2" },
  },
  portraits: { p1: PORTRAIT, p2: PORTRAIT },
};

function expectNoMono(container: HTMLElement) {
  expect(container.innerHTML).not.toContain("font-mono");
}

const award: AwardAttachment = {
  type: "award",
  awardResultId: "a1",
  awardId: "mvp" as AwardAttachment["awardId"],
  awardName: "Player of the Month",
  cadence: "monthly",
  seasonYear: 2026,
  period: "2026-10",
  winner: LEO,
  winnerCoachName: null,
  team: TOR,
  perGame: { points: 28.46, rebounds: 7.2, assists: 9 },
  teamRecord: { wins: 50, losses: 12 },
  runnerUp: { name: "Mia Voss", teamAbbreviation: "DEN" },
};

describe("AwardAttachmentCard", () => {
  it("shows the monthly period, per-game numbers, record and runner-up", () => {
    const { container } = render(
      <AwardAttachmentCard attachment={award} context={context} />,
    );
    expect(screen.getByText("Player of the Month")).toBeTruthy();
    expect(screen.getByText("October 2026")).toBeTruthy();
    expect(screen.getByText("28.5")).toBeTruthy();
    expect(screen.getByText("7.2")).toBeTruthy();
    expect(screen.getByText("9.0")).toBeTruthy();
    expect(screen.getByText("50–12")).toBeTruthy();
    expect(screen.getByText("Runner-up: Mia Voss (DEN)")).toBeTruthy();
    const link = screen.getByRole("link", { name: "Leo Drake" });
    expect(link.getAttribute("href")).toBe("/dashboard/s1/players/p1");
    const portrait = container.querySelector("[data-portrait-player-id]");
    expect(portrait?.getAttribute("aria-hidden")).toBe("true");
    expectNoMono(container);
  });

  it("shows the season for yearly awards", () => {
    render(
      <AwardAttachmentCard
        attachment={{
          ...award,
          cadence: "yearly",
          period: null,
          perGame: null,
          teamRecord: null,
          runnerUp: null,
        }}
        context={context}
      />,
    );
    expect(screen.getByText("2026–27 season")).toBeTruthy();
    expect(screen.queryByText("PPG")).toBeNull();
    expect(screen.queryByText(/Runner-up/)).toBeNull();
    expect(screen.queryByText(/Team record/)).toBeNull();
  });

  it("renders a coach award without a portrait", () => {
    const { container } = render(
      <AwardAttachmentCard
        attachment={{
          ...award,
          winner: null,
          winnerCoachName: "Gene Auriemma",
          team: DEN,
          perGame: null,
        }}
        context={context}
      />,
    );
    expect(container.querySelector("[data-portrait-player-id]")).toBeNull();
    expect(screen.getByText("Gene Auriemma")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
    expectNoMono(container);
  });
});

describe("TradeAttachmentCard", () => {
  const trade: TradeAttachment = {
    type: "trade",
    teams: [TOR, DEN],
    movements: [
      { player: LEO, fromTeamId: "t1", toTeamId: "t2" },
      { player: MIA, fromTeamId: "t2", toTeamId: "t1" },
    ],
    otherPieces: ["2028 first-round pick"],
  };

  it("lists players under the receiving team", () => {
    const { container } = render(
      <TradeAttachmentCard attachment={trade} context={context} />,
    );
    const torSection = screen.getByRole("region", {
      name: "City Raptors trade",
    });
    const denSection = screen.getByRole("region", {
      name: "City Nuggets trade",
    });
    expect(within(torSection).getByText("Mia Voss")).toBeTruthy();
    expect(within(torSection).queryByText("Leo Drake")).toBeNull();
    expect(within(denSection).getByText("Leo Drake")).toBeTruthy();
    expect(within(denSection).getAllByText("Receives")).toHaveLength(1);
    expect(screen.getByText("2028 first-round pick")).toBeTruthy();
    expect(container.querySelector(".sm\\:grid-cols-2")).not.toBeNull();
    expect(container.querySelectorAll("[aria-hidden]").length).toBeGreaterThan(
      0,
    );
    expectNoMono(container);
  });
});

describe("SigningAttachmentCard", () => {
  it("shows team, player and summary", () => {
    const signing: SigningAttachment = {
      type: "signing",
      player: LEO,
      team: TOR,
      headline: "h",
      summary: "Three years, $30M.",
    };
    const { container } = render(
      <SigningAttachmentCard attachment={signing} context={context} />,
    );
    expect(screen.getByRole("link", { name: "Leo Drake" })).toBeTruthy();
    expect(screen.getByText("Three years, $30M.")).toBeTruthy();
    expectNoMono(container);
  });

  it("shows only team and summary without a player", () => {
    const { container } = render(
      <SigningAttachmentCard
        attachment={{
          type: "signing",
          player: null,
          team: DEN,
          headline: "h",
          summary: "Signed a veteran.",
        }}
        context={context}
      />,
    );
    expect(screen.queryByRole("link")).toBeNull();
    expect(container.querySelector("[data-portrait-player-id]")).toBeNull();
    expect(screen.getByText("City Nuggets")).toBeTruthy();
    expect(screen.getByText("Signed a veteran.")).toBeTruthy();
  });
});

describe("InjuryAttachmentCard", () => {
  const injury: InjuryAttachment = {
    type: "injury",
    player: LEO,
    team: TOR,
    severity: "moderate",
    bodyPart: "left_knee",
    expectedReturn: { earliest: "2026-10-19", latest: "2026-10-29" },
  };

  it("shows severity, body part and the return window", () => {
    const { container } = render(
      <InjuryAttachmentCard attachment={injury} context={context} />,
    );
    expect(screen.getByText("questionable")).toBeTruthy();
    expect(screen.getByText("Left knee")).toBeTruthy();
    expect(screen.getByText("Expected back Oct 19 – Oct 29")).toBeTruthy();
    expect(screen.getByText("TOR")).toBeTruthy();
    expectNoMono(container);
  });

  it("maps every severity to its label", () => {
    const labels = { minor: "minor", major: "injured", severe: "out" } as const;
    for (const [severity, label] of Object.entries(labels)) {
      const { unmount } = render(
        <InjuryAttachmentCard
          attachment={{
            ...injury,
            severity: severity as keyof typeof labels,
          }}
          context={context}
        />,
      );
      expect(screen.getByText(label)).toBeTruthy();
      unmount();
    }
  });

  it("renders no empty rows for null fields", () => {
    const { container } = render(
      <InjuryAttachmentCard
        attachment={{
          ...injury,
          player: null,
          severity: null,
          bodyPart: null,
          expectedReturn: null,
        }}
        context={context}
      />,
    );
    expect(screen.queryByText(/Expected back/)).toBeNull();
    expect(container.querySelector("[data-portrait-player-id]")).toBeNull();
    const empties = Array.from(
      container.querySelectorAll("p, span, div"),
    ).filter((el) => el.children.length === 0 && !el.textContent?.trim());
    // Only the decorative badge may be text-free.
    expect(empties.every((el) => el.getAttribute("aria-hidden"))).toBe(true);
  });

  it("renders nothing when there is nothing to say", () => {
    const { container } = render(
      <InjuryAttachmentCard
        attachment={{
          type: "injury",
          player: null,
          team: null,
          severity: null,
          bodyPart: null,
          expectedReturn: null,
        }}
        context={context}
      />,
    );
    expect(container.innerHTML).toBe("");
  });
});

describe("PlayoffAttachmentCard", () => {
  const series: PlayoffAttachment = {
    type: "playoff",
    event: "series_won",
    seasonYear: 2026,
    seriesId: "s",
    roundLabel: "Conference Finals",
    winner: TOR,
    loser: DEN,
    seriesScore: { winner: 4, loser: 1 },
    sweep: false,
    wentDistance: false,
  };

  it("shows the series score bug and round", () => {
    const { container } = render(
      <PlayoffAttachmentCard attachment={series} context={context} />,
    );
    expect(screen.getByText("Conference Finals")).toBeTruthy();
    expect(screen.getByText("TOR wins 4–1")).toBeTruthy();
    expect(screen.getByText("DEN")).toBeTruthy();
    expect(screen.queryByText("Sweep")).toBeNull();
    expect(screen.queryByText("Game 7")).toBeNull();
    expectNoMono(container);
  });

  it("tags sweeps and game sevens", () => {
    const { unmount } = render(
      <PlayoffAttachmentCard
        attachment={{
          ...series,
          seriesScore: { winner: 4, loser: 0 },
          sweep: true,
        }}
        context={context}
      />,
    );
    expect(screen.getByText("TOR wins 4–0")).toBeTruthy();
    expect(screen.getByText("Sweep")).toBeTruthy();
    unmount();
    render(
      <PlayoffAttachmentCard
        attachment={{
          ...series,
          seriesScore: { winner: 4, loser: 3 },
          wentDistance: true,
        }}
        context={context}
      />,
    );
    expect(screen.getByText("TOR wins 4–3")).toBeTruthy();
    expect(screen.getByText("Game 7")).toBeTruthy();
  });

  it("gives champions the big treatment", () => {
    const { container } = render(
      <PlayoffAttachmentCard
        attachment={{ ...series, event: "champion", roundLabel: "Finals" }}
        context={context}
      />,
    );
    expect(screen.getByText("Champions")).toBeTruthy();
    expect(screen.getByText("2026–27")).toBeTruthy();
    expect(screen.getByText("TOR wins 4–1")).toBeTruthy();
    expect(screen.queryByText("Finals")).toBeNull();
    expectNoMono(container);
  });

  it("shows the previous champion line", () => {
    const { container } = render(
      <PlayoffAttachmentCard
        attachment={{
          ...series,
          event: "previous_champion",
          seasonYear: 2025,
          loser: null,
          seriesScore: null,
          roundLabel: null,
        }}
        context={context}
      />,
    );
    expect(screen.getByText("2025–26 champions")).toBeTruthy();
    expect(screen.getByText("City Raptors")).toBeTruthy();
    expect(screen.queryByText(/wins/)).toBeNull();
    expectNoMono(container);
  });
});

describe("StreakAttachmentCard", () => {
  const streak: StreakAttachment = {
    type: "streak",
    team: TOR,
    event: "win_streak",
    length: 12,
    snappedBy: null,
    gameId: "g1",
  };

  it("shows the length and label for each event", () => {
    const { container, unmount } = render(
      <StreakAttachmentCard attachment={streak} context={context} />,
    );
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("straight wins")).toBeTruthy();
    expectNoMono(container);
    unmount();

    const losing = render(
      <StreakAttachmentCard
        attachment={{ ...streak, event: "losing_streak", length: 9 }}
        context={context}
      />,
    );
    expect(screen.getByText("9")).toBeTruthy();
    expect(screen.getByText("straight losses")).toBeTruthy();
    losing.unmount();

    render(
      <StreakAttachmentCard
        attachment={{
          ...streak,
          event: "streak_snapped",
          length: 15,
          snappedBy: DEN,
        }}
        context={context}
      />,
    );
    expect(screen.getByText("15")).toBeTruthy();
    expect(screen.getByText("game win streak snapped")).toBeTruthy();
    expect(screen.getByText(/snapped by DEN/)).toBeTruthy();
  });

  it("hides the team badge from assistive tech with the name adjacent", () => {
    const { container } = render(
      <StreakAttachmentCard attachment={streak} context={context} />,
    );
    expect(container.querySelector("[aria-hidden='true']")).not.toBeNull();
    expect(container.querySelector("[role='img']")).toBeNull();
    expect(screen.getByText(/City Raptors/)).toBeTruthy();
  });
});
