import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { OnboardingShell } from "@/components/game/OnboardingShell";

describe("OnboardingShell", () => {
  it("links completed steps from setup so users can return to mode", () => {
    const { unmount } = render(
      <OnboardingShell step="setup" title="Game setup">
        <p>form</p>
      </OnboardingShell>,
    );

    expect(
      screen.getByRole("link", { name: "← Owner Mode" }).getAttribute("href"),
    ).toBe("/owner");
    expect(
      screen.getByRole("link", { name: "1. Mode" }).getAttribute("href"),
    ).toBe("/home");
    expect(screen.queryByRole("link", { name: "2. Setup" })).toBeNull();
    expect(screen.queryByRole("link", { name: "3. Franchise" })).toBeNull();
    expect(screen.getByText("2. Setup").getAttribute("aria-current")).toBe(
      "step",
    );
    unmount();
  });

  it("links completed steps from franchise so users can return to mode and setup", () => {
    const { unmount } = render(
      <OnboardingShell step="franchise" title="Choose your franchise location">
        <p>map</p>
      </OnboardingShell>,
    );

    expect(
      screen.getByRole("link", { name: "1. Mode" }).getAttribute("href"),
    ).toBe("/home");
    expect(
      screen.getByRole("link", { name: "2. Setup" }).getAttribute("href"),
    ).toBe("/new/setup?mode=owner");
    expect(screen.queryByRole("link", { name: "3. Franchise" })).toBeNull();
    expect(screen.getByText("3. Franchise").getAttribute("aria-current")).toBe(
      "step",
    );
    unmount();
  });
});
