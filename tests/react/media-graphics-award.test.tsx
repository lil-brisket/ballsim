import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AwardAttachmentCard } from "@/components/media-hub/timeline/AwardAttachmentCard";
import { contrastRatio } from "@/domain/color-contrast";
import type { PlayerPortraitAssignment } from "@/domain/entities/player-portrait";
import type { TeamBranding } from "@/domain/entities/team-branding";
import { TEAM_INK_SURFACE } from "@/presentation/team-theme";
import type { TimelineDisplayContext } from "@/state/media-timeline/post-view";
import type {
  AwardAttachment,
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

function teamRef(branding: TeamBranding | null): TimelineTeamRef {
  return {
    teamId: "t1",
    abbreviation: "HAR",
    displayName: "Harbor City Gulls",
    name: "Gulls",
    branding,
  };
}

function contextFor(branding: TeamBranding | null): TimelineDisplayContext {
  return {
    saveId: "s1",
    teams: branding ? { t1: { branding, href: "/dashboard/s1/teams/t1" } } : {},
    portraits: { p1: PORTRAIT },
  };
}

function award(overrides: Partial<AwardAttachment> = {}): AwardAttachment {
  return {
    type: "award",
    awardResultId: "a1",
    awardId: "mvp" as AwardAttachment["awardId"],
    awardName: "Most Valuable Player",
    cadence: "yearly",
    seasonYear: 2026,
    period: null,
    winner: {
      playerId: "p1",
      firstName: "Leo",
      lastName: "Drake",
      teamId: "t1",
    },
    winnerCoachName: null,
    team: teamRef(brandingOf("#1D4ED8", "#FACC15")),
    stats: [],
    improvement: null,
    teamRecord: null,
    runnerUp: null,
    ...overrides,
  };
}

function renderAward(a: AwardAttachment, branding = a.team?.branding ?? null) {
  return render(
    <AwardAttachmentCard attachment={a} context={contextFor(branding)} />,
  );
}

describe("award trophy card", () => {
  it("renders each stat label and value (defensive player)", () => {
    renderAward(
      award({
        awardName: "Defensive Player of the Year",
        stats: [
          { label: "SPG", value: "2.1" },
          { label: "BPG", value: "2.8" },
          { label: "RPG", value: "9.4" },
        ],
      }),
    );
    for (const text of ["SPG", "2.1", "BPG", "2.8", "RPG", "9.4"]) {
      expect(screen.getByText(text)).toBeTruthy();
    }
  });

  it("tones the improvement win and shows the record in the secondary row", () => {
    renderAward(
      award({
        awardName: "Most Improved Player",
        stats: [
          { label: "PPG", value: "21.3" },
          { label: "Change", value: "+9.1", tone: "win" },
        ],
        improvement: 9.1,
        teamRecord: { wins: 44, losses: 38 },
      }),
    );
    expect(screen.getByText("+9.1").className).toContain("text-win");
    expect(screen.getByText("21.3").className).toContain("text-zinc-50");
    expect(screen.getByText("Record")).toBeTruthy();
    expect(screen.getByText("44–38")).toBeTruthy();
  });

  it("shows a coach record once and a loss-toned change", () => {
    renderAward(
      award({
        awardName: "Coach of the Year",
        winner: null,
        winnerCoachName: "Gene Auriemma",
        stats: [
          { label: "Record", value: "30–52" },
          { label: "Wins vs last season", value: "−5", tone: "loss" },
        ],
        improvement: -5,
        teamRecord: { wins: 30, losses: 52 },
      }),
    );
    expect(screen.getAllByText("30–52")).toHaveLength(1);
    expect(screen.getByText("−5").className).toContain("text-loss");
    expect(screen.getByText("Harbor City Gulls head coach")).toBeTruthy();
  });

  it("uses a trophy for yearly and a medal for monthly awards", () => {
    const yearly = renderAward(award());
    expect(
      yearly.container.querySelector("[data-award-icon='trophy']"),
    ).not.toBeNull();
    expect(
      yearly.container.querySelector("[data-award-icon='medal']"),
    ).toBeNull();
    cleanup();
    const monthly = renderAward(
      award({ cadence: "monthly", period: "2026-10" }),
    );
    expect(
      monthly.container.querySelector("[data-award-icon='medal']"),
    ).not.toBeNull();
    expect(
      monthly.container.querySelector("[data-award-icon='trophy']"),
    ).toBeNull();
  });

  it("has one team band, a team-uniform lg portrait, and no mono or amber", () => {
    const { container } = renderAward(award());
    expect(container.querySelectorAll("[data-team-band]")).toHaveLength(1);
    const portrait = container.querySelector("[data-portrait-size]")!;
    expect(portrait.getAttribute("data-portrait-size")).toBe("lg");
    expect(portrait.getAttribute("data-portrait-uniform")).toBe("team");
    expect(container.innerHTML).not.toContain("amber");
    expect(container.innerHTML).not.toContain("font-mono");
    expect(screen.getByText("Harbor City Gulls")).toBeTruthy();
  });

  const cases = [
    ["very light", "#FFFFFF", "#F4F4F5"],
    ["very dark", "#0B1F3A", "#C4CED4"],
    ["neon", "#39FF14", "#0A0A0A"],
  ] as const;
  for (const [name, primary, secondary] of cases) {
    it(`renders readably for a ${name} team`, () => {
      const { container } = renderAward(
        award({
          stats: [{ label: "PPG", value: "30.1" }],
          team: teamRef(brandingOf(primary, secondary)),
        }),
      );
      const root = container.firstElementChild as HTMLElement;
      expect(screen.getByText("30.1")).toBeTruthy();
      expect(
        contrastRatio(
          root.style.getPropertyValue("--team-ink"),
          TEAM_INK_SURFACE,
        ) ?? 0,
      ).toBeGreaterThanOrEqual(4.5);
    });
  }
});
