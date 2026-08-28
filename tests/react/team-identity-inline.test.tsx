import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TeamIdentityInline } from "@/components/team/TeamIdentityInline";
import { TeamLogoMark } from "@/components/team/logos/TeamLogoMark";

afterEach(() => {
  cleanup();
});

describe("TeamIdentityInline", () => {
  it("renders logo and team text when branding is present", () => {
    render(
      <TeamIdentityInline
        city="Atlanta"
        name="Knights"
        abbreviation="ATL"
        branding={{
          primaryColor: "#0B1F3A",
          secondaryColor: "#C4CED4",
          accentColor: "#F5B800",
          logoId: "shield",
        }}
        size="sm"
      />,
    );
    expect(screen.getByText(/Atlanta Knights/)).toBeTruthy();
    expect(screen.getByText(/\(ATL\)/)).toBeTruthy();
    // Decorative logo should be aria-hidden
    const hidden = document.querySelector('[aria-hidden="true"]');
    expect(hidden).toBeTruthy();
  });

  it("falls back to abbreviation monogram when branding is null", () => {
    render(
      <TeamIdentityInline
        city="Boston"
        name="Wolves"
        abbreviation="BOS"
        branding={null}
      />,
    );
    expect(screen.getByText("BOS")).toBeTruthy();
    expect(screen.getByText(/Boston Wolves/)).toBeTruthy();
  });
});

describe("TeamLogoMark", () => {
  it("accepts branding shorthand and size", () => {
    const { container } = render(
      <TeamLogoMark
        branding={{
          primaryColor: "#0B1F3A",
          secondaryColor: "#C4CED4",
          accentColor: "#F5B800",
          logoId: "wolf",
        }}
        size="md"
        title="Boston Wolves"
      />,
    );
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute("aria-label")).toBe("Boston Wolves");
  });

  it("falls back safely for unknown logo ids via branding", () => {
    const { container } = render(
      <TeamLogoMark
        branding={{
          primaryColor: "#0B1F3A",
          secondaryColor: "#C4CED4",
          accentColor: "#F5B800",
          logoId: "not-a-real-logo",
        }}
        size="sm"
        decorative
      />,
    );
    expect(container.querySelector("svg")).toBeTruthy();
  });
});
