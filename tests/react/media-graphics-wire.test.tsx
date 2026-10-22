import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { SigningAttachmentCard } from "@/components/media-hub/timeline/SigningAttachmentCard";
import { TradeAttachmentCard } from "@/components/media-hub/timeline/TradeAttachmentCard";
import {
  contrastRatio,
  readableTextOnBackground,
} from "@/domain/color-contrast";
import type { PlayerPortraitAssignment } from "@/domain/entities/player-portrait";
import type { TeamBranding } from "@/domain/entities/team-branding";
import type { TimelineDisplayContext } from "@/state/media-timeline/post-view";
import type {
  TimelinePlayerRef,
  TimelineTeamRef,
  TradeAttachment,
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
  displayName: string,
  branding: TeamBranding | null,
): TimelineTeamRef {
  return {
    teamId: id,
    abbreviation: id.toUpperCase(),
    displayName,
    name: displayName,
    branding,
  };
}

const LEO: TimelinePlayerRef = {
  playerId: "p1",
  firstName: "Leo",
  lastName: "Drake",
  teamId: "t1",
};
const MIA: TimelinePlayerRef = {
  playerId: "p2",
  firstName: "Mia",
  lastName: "Voss",
  teamId: "t2",
};

function contextFor(teams: TimelineTeamRef[]): TimelineDisplayContext {
  return {
    saveId: "s1",
    teams: Object.fromEntries(
      teams
        .filter((t) => t.branding)
        .map((t) => [
          t.teamId,
          { branding: t.branding!, href: `/dashboard/s1/teams/${t.teamId}` },
        ]),
    ) as TimelineDisplayContext["teams"],
    portraits: { p1: PORTRAIT, p2: PORTRAIT },
  };
}

function tradeOf(a: TimelineTeamRef, b: TimelineTeamRef): TradeAttachment {
  return {
    type: "trade",
    teams: [a, b],
    movements: [
      { player: LEO, fromTeamId: a.teamId, toTeamId: b.teamId },
      { player: MIA, fromTeamId: b.teamId, toTeamId: a.teamId },
    ],
    otherPieces: ["2028 first-round pick"],
  };
}

function colorOf(value: string): string {
  const probe = document.createElement("span");
  probe.style.color = value;
  return probe.style.color;
}

describe("trade wire", () => {
  it("links every moving player, labels receivers and uses receiving uniforms", () => {
    const a = teamRef(
      "t1",
      "Harbor City Gulls",
      brandingOf("#1D4ED8", "#FACC15"),
    );
    const b = teamRef("t2", "Metro Foxes", brandingOf("#B91C1C", "#FFFFFF"));
    const { container } = render(
      <TradeAttachmentCard
        attachment={tradeOf(a, b)}
        context={contextFor([a, b])}
      />,
    );
    expect(screen.getByRole("link", { name: "Leo Drake" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Mia Voss" })).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Harbor City Gulls" }),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Metro Foxes" })).toBeTruthy();
    expect(screen.getAllByText("Receives")).toHaveLength(2);
    expect(container.querySelectorAll("[data-team-band]")).toHaveLength(1);
    const portraits = container.querySelectorAll("[data-portrait-uniform]");
    expect(portraits).toHaveLength(2);
    for (const portrait of portraits) {
      expect(portrait.getAttribute("data-portrait-uniform")).toBe("team");
      expect(portrait.getAttribute("data-portrait-size")).toBe("sm");
    }
    expect(screen.getByText("2028 first-round pick")).toBeTruthy();
    expect(container.innerHTML).not.toContain("amber");
    expect(container.innerHTML).not.toContain("font-mono");
  });

  const cases = [
    ["very light", "#FFFFFF", "#F4F4F5"],
    ["very dark", "#0B1F3A", "#C4CED4"],
    ["neon", "#39FF14", "#0A0A0A"],
  ] as const;
  for (const [name, primary, secondary] of cases) {
    it(`keeps header text readable for a ${name} primary`, () => {
      const a = teamRef(
        "t1",
        "Harbor City Gulls",
        brandingOf(primary, secondary),
      );
      const b = teamRef("t2", "Metro Foxes", brandingOf("#1D4ED8", "#FACC15"));
      const { container } = render(
        <TradeAttachmentCard
          attachment={tradeOf(a, b)}
          context={contextFor([a, b])}
        />,
      );
      const header = container.querySelector<HTMLElement>(
        "[data-trade-header]",
      )!;
      const text = readableTextOnBackground(primary);
      expect(header.style.color).toBe(colorOf(text));
      expect(contrastRatio(text, primary) ?? 0).toBeGreaterThanOrEqual(4.5);
    });
  }

  it("falls back to a neutral header without branding", () => {
    const a = teamRef("t1", "Harbor City Gulls", null);
    const b = teamRef("t2", "Metro Foxes", null);
    const { container } = render(
      <TradeAttachmentCard
        attachment={tradeOf(a, b)}
        context={contextFor([a, b])}
      />,
    );
    const header = container.querySelector("[data-trade-header]")!;
    expect(header.className).toContain("bg-zinc-800");
    expect(container.querySelectorAll("[data-team-band]")).toHaveLength(1);
  });
});

describe("signing wire", () => {
  const team = teamRef(
    "t1",
    "Harbor City Gulls",
    brandingOf("#1D4ED8", "#FACC15"),
  );

  it("shows team slab, md team-uniform portrait, link and summary", () => {
    const { container } = render(
      <SigningAttachmentCard
        attachment={{
          type: "signing",
          player: LEO,
          team,
          headline: "h",
          summary: "Three years, $30M.",
        }}
        context={contextFor([team])}
      />,
    );
    expect(screen.getByRole("link", { name: "Leo Drake" })).toBeTruthy();
    expect(screen.getByText("Harbor City Gulls")).toBeTruthy();
    expect(screen.getByText("Three years, $30M.")).toBeTruthy();
    const portrait = container.querySelector("[data-portrait-size]")!;
    expect(portrait.getAttribute("data-portrait-size")).toBe("md");
    expect(portrait.getAttribute("data-portrait-uniform")).toBe("team");
    expect(container.querySelectorAll("[data-team-band]")).toHaveLength(1);
    expect(container.innerHTML).not.toContain("amber");
    expect(container.innerHTML).not.toContain("font-mono");
  });

  it("shows only team and summary without a player", () => {
    const { container } = render(
      <SigningAttachmentCard
        attachment={{
          type: "signing",
          player: null,
          team,
          headline: "h",
          summary: "Signed a veteran.",
        }}
        context={contextFor([team])}
      />,
    );
    expect(container.querySelector("[data-portrait-size]")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Signed a veteran.")).toBeTruthy();
    expect(container.querySelectorAll("[data-team-band]")).toHaveLength(1);
  });
});
