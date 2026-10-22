import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { InjuryAttachmentCard } from "@/components/media-hub/timeline/InjuryAttachmentCard";
import { PlayoffAttachmentCard } from "@/components/media-hub/timeline/PlayoffAttachmentCard";
import { StreakAttachmentCard } from "@/components/media-hub/timeline/StreakAttachmentCard";
import type { PlayerPortraitAssignment } from "@/domain/entities/player-portrait";
import type { TeamBranding } from "@/domain/entities/team-branding";
import type { TimelineDisplayContext } from "@/state/media-timeline/post-view";
import type {
  InjuryAttachment,
  PlayoffAttachment,
  StreakAttachment,
  TimelineTeamRef,
} from "@/state/media-timeline/types";

afterEach(cleanup);

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

function brandingOf(primary: string, secondary: string): TeamBranding {
  return {
    primaryColor: primary,
    secondaryColor: secondary,
    accentColor: "#FFFFFF",
    logoId: "shield",
  };
}

function teamRef(
  id: string,
  abbreviation: string,
  displayName: string,
  branding: TeamBranding,
): TimelineTeamRef {
  return { teamId: id, abbreviation, displayName, name: displayName, branding };
}

const BLUE = brandingOf("#1D4ED8", "#FACC15");
const HAR = teamRef("t1", "HAR", "Harbor City Gulls", BLUE);
const DEN = teamRef(
  "t2",
  "DEN",
  "Denver Nuggets",
  brandingOf("#0B1F3A", "#C4CED4"),
);

const context: TimelineDisplayContext = {
  saveId: "s1",
  teams: {
    t1: { branding: BLUE, href: "/dashboard/s1/teams/t1" },
  },
  portraits: { p1: PORTRAIT },
};

const LEO = {
  playerId: "p1",
  firstName: "Leo",
  lastName: "Drake",
  teamId: "t1",
};

const injury: InjuryAttachment = {
  type: "injury",
  player: LEO,
  team: HAR,
  severity: "severe",
  bodyPart: "left_knee",
  expectedReturn: { earliest: "2026-10-19", latest: "2026-10-29" },
};

function expectClean(container: HTMLElement) {
  expect(container.innerHTML).not.toContain("amber");
  expect(container.innerHTML).not.toContain("font-mono");
  expect(container.querySelectorAll("[data-team-band]")).toHaveLength(1);
}

describe("injury report", () => {
  it("renders the status chip, body part and return window", () => {
    const { container } = render(
      <InjuryAttachmentCard attachment={injury} context={context} />,
    );
    expect(screen.getByText("out")).toBeTruthy();
    expect(screen.getByText("Left knee")).toBeTruthy();
    expect(screen.getByText("Expected back Oct 19 – Oct 29")).toBeTruthy();
    const portrait = container.querySelector("[data-portrait-size]")!;
    expect(portrait.getAttribute("data-portrait-size")).toBe("md");
    expect(portrait.getAttribute("data-portrait-uniform")).toBe("team");
    expectClean(container);
  });

  it("keeps team colour out of the status chip", () => {
    const { container } = render(
      <InjuryAttachmentCard attachment={injury} context={context} />,
    );
    const chip = container.querySelector("[data-injury-chip]")!;
    expect(chip.className).not.toMatch(/team/);
    expect(chip.className).toContain("warning");
  });
});

describe("playoff graphics", () => {
  const series: PlayoffAttachment = {
    type: "playoff",
    event: "series_won",
    seasonYear: 2026,
    seriesId: "s",
    roundLabel: "Conference Finals",
    winner: HAR,
    loser: DEN,
    seriesScore: { winner: 4, loser: 1 },
    sweep: false,
    wentDistance: false,
  };

  it("draws pips matching the series score", () => {
    const { container } = render(
      <PlayoffAttachmentCard attachment={series} context={context} />,
    );
    expect(container.querySelectorAll("[data-pip='won']")).toHaveLength(4);
    expect(container.querySelectorAll("[data-pip='lost']")).toHaveLength(1);
    expect(screen.getByText("4 games to 1")).toBeTruthy();
    expect(screen.getByText("HAR wins 4–1")).toBeTruthy();
    expectClean(container);
  });

  it("tags game seven", () => {
    const { container } = render(
      <PlayoffAttachmentCard
        attachment={{
          ...series,
          seriesScore: { winner: 4, loser: 3 },
          wentDistance: true,
        }}
        context={context}
      />,
    );
    expect(container.querySelectorAll("[data-pip]")).toHaveLength(7);
    expect(screen.getByText("Game 7")).toBeTruthy();
  });

  it("shows the previous champion with a band only", () => {
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
    expect(container.querySelector(".bg-team")).toBeNull();
    expectClean(container);
  });

  const cases = [
    ["very light", "#FFFFFF", "#F4F4F5"],
    ["very dark", "#0B1F3A", "#C4CED4"],
    ["neon", "#39FF14", "#0A0A0A"],
  ] as const;
  for (const [name, primary, secondary] of cases) {
    it(`renders the champion slab for a ${name} team`, () => {
      const branding = brandingOf(primary, secondary);
      const champ = teamRef("t1", "HAR", "Harbor City Gulls", branding);
      const { container } = render(
        <PlayoffAttachmentCard
          attachment={{ ...series, event: "champion", winner: champ }}
          context={{
            ...context,
            teams: { t1: { branding, href: "/dashboard/s1/teams/t1" } },
          }}
        />,
      );
      expect(screen.getByText("Champions")).toBeTruthy();
      const slab = container.querySelector(".bg-team")!;
      expect(slab.className).toContain("text-on-team");
      expect(slab.textContent).toContain("Champions");
      expectClean(container);
    });
  }
});

describe("streak chain", () => {
  const streak: StreakAttachment = {
    type: "streak",
    team: HAR,
    event: "win_streak",
    length: 7,
    snappedBy: null,
    gameId: "g1",
  };

  it("draws one square per game", () => {
    const { container } = render(
      <StreakAttachmentCard attachment={streak} context={context} />,
    );
    expect(container.querySelectorAll("[data-chain-square='W']")).toHaveLength(
      7,
    );
    expectClean(container);
  });

  it("caps the chain at 10 and shows the remainder", () => {
    const { container } = render(
      <StreakAttachmentCard
        attachment={{ ...streak, event: "losing_streak", length: 13 }}
        context={context}
      />,
    );
    expect(container.querySelectorAll("[data-chain-square='L']")).toHaveLength(
      10,
    );
    expect(screen.getByText("+3")).toBeTruthy();
    expect(screen.getByText("13")).toBeTruthy();
  });

  it("names the team that snapped the streak", () => {
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
    expect(screen.getByText("game win streak snapped")).toBeTruthy();
    expect(screen.getByText("snapped by DEN")).toBeTruthy();
  });
});
