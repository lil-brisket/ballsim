import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("server-only", () => ({}));

import { PlayerCard } from "@/components/basketball/PlayerCard";
import { PlayerProfileHero } from "@/components/basketball/PlayerProfileHero";
import { CategoryBoxes } from "@/components/basketball/PlayerBoxes";
import type { PlayerAttributes } from "@/domain/entities/player";

function heroProps(overrides: Record<string, unknown> = {}) {
  return {
    playerId: "player_1",
    firstName: "Alex",
    lastName: "Rivera",
    jerseyNumber: 23,
    position: "SF",
    age: 23,
    overall: 78,
    potential: 88,
    archetypeLabel: "Two-Way Wing",
    heightInches: 79,
    contractSummary: "$12.4M · 3y",
    teamName: "Harbor Waves",
    teamAbbreviation: "HAR",
    branding: null,
    availabilityStatus: "available",
    ...overrides,
  };
}

describe("player identity", () => {
  afterEach(cleanup);

  it.each(["full", "compact"] as const)(
    "%s hero shows the archetype once, the identity line and OVR badge",
    (variant) => {
      render(<PlayerProfileHero {...heroProps()} variant={variant} />);
      expect(screen.getAllByText("Two-Way Wing")).toHaveLength(1);
      expect(screen.getByRole("img", { name: "Overall 78" })).toBeTruthy();
      const line = document.querySelector("[data-identity-line]")!;
      expect(line.textContent).toContain("SF");
      expect(line.textContent).toContain("Age 23");
      expect(line.textContent).toContain("6'7\"");
      expect(line.textContent).toContain("$12.4M · 3y");
      expect(screen.getAllByText("Age 23")).toHaveLength(1);
    },
  );

  it("shows ghost POT for age 24 or younger when potential is provided", () => {
    render(<PlayerProfileHero {...heroProps({ age: 24 })} />);
    expect(screen.getByRole("img", { name: "POT 88" })).toBeTruthy();
  });

  it("hides POT above age 24 or without potential", () => {
    const { rerender } = render(
      <PlayerProfileHero {...heroProps({ age: 25 })} />,
    );
    expect(screen.queryByRole("img", { name: /POT/ })).toBeNull();
    rerender(<PlayerProfileHero {...heroProps({ potential: undefined })} />);
    expect(screen.queryByRole("img", { name: /POT/ })).toBeNull();
  });

  it("player card shows archetype, OVR and ghost POT", () => {
    render(
      <PlayerCard
        playerId="p1"
        firstName="Alex"
        lastName="Rivera"
        position="SF"
        age={22}
        overall={70}
        potential={85}
        archetypeLabel="Slasher"
        heightInches={78}
      />,
    );
    expect(screen.getByText("Slasher")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Overall 70" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "POT 85" })).toBeTruthy();
  });
});

describe("attribute group rows", () => {
  afterEach(cleanup);

  const attrs: PlayerAttributes = {
    speed: 60,
    strength: 60,
    athleticism: 60,
    stamina: 60,
    finishing: 96,
    midRange: 50,
    threePoint: 50,
    freeThrow: 50,
    ballHandling: 82,
    passing: 78,
    perimeterDefense: 60,
    interiorDefense: 60,
    steal: 60,
    block: 60,
    rebounding: 60,
    basketballIq: 60,
    offensiveIq: 60,
    defensiveIq: 60,
    consistency: 60,
  };

  it("renders a tier-coloured box and the group grade per category", () => {
    render(<CategoryBoxes attributes={attrs} />);
    const list = screen.getByRole("list", { name: "Category ratings" });
    const boxes = Array.from(
      list.querySelectorAll<HTMLElement>(":scope > li[data-category]"),
    );
    expect(boxes).toHaveLength(7);
    const byKey = (key: string) =>
      boxes.find((box) => box.getAttribute("data-category") === key)!;
    const inside = byKey("insideScoring");
    expect(inside.getAttribute("data-tier")).toBe("elite");
    const value = inside.querySelector(".font-display")!;
    expect(value.textContent).toContain("A+");
    expect(value.className).toContain("text-tier");
    const playmaking = byKey("playmaking");
    expect(playmaking.getAttribute("data-tier")).toBe("star");
    expect(playmaking.querySelector(".font-display")?.textContent).toContain(
      "B+",
    );
  });
});
