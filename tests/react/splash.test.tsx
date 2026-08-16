import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import SplashPage from "@/app/page";

describe("Splash page", () => {
  it("links Enter Game to the mode-selection home", () => {
    const { unmount } = render(<SplashPage />);
    expect(
      screen.getByRole("link", { name: /enter game/i }).getAttribute("href"),
    ).toBe("/home");
    expect(screen.getByText("Franchise Simulation")).toBeTruthy();
    expect(screen.queryByText("Continue")).toBeNull();
    expect(screen.queryByText("New Game")).toBeNull();
    unmount();
  });
});
