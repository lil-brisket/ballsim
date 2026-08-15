import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import SplashPage from "@/app/page";

describe("Splash page", () => {
  it("links the title screen to the home menu", () => {
    const { unmount } = render(<SplashPage />);
    expect(
      screen.getByRole("link", { name: /click to continue/i }).getAttribute(
        "href",
      ),
    ).toBe("/home");
    expect(screen.queryByText("New Game")).toBeNull();
    unmount();
  });
});
