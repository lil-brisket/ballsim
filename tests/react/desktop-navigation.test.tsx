import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/save_test",
}));

import { DesktopNavigation } from "@/components/game/DesktopNavigation";

const STORAGE_KEY = "ballsim:ownerNavCollapsed";

describe("DesktopNavigation collapsed preference", () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("starts expanded when no preference is stored", () => {
    render(<DesktopNavigation saveId="save_test" />);
    expect(
      screen.getByRole("button", { name: "Collapse sidebar" }),
    ).toBeTruthy();
  });

  it("applies a stored collapsed preference after mount", async () => {
    window.localStorage.setItem(STORAGE_KEY, "1");
    render(<DesktopNavigation saveId="save_test" />);
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Expand sidebar" }),
      ).toBeTruthy();
    });
  });

  it("persists the collapsed preference when toggled", () => {
    render(<DesktopNavigation saveId="save_test" />);
    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("1");
    expect(
      screen.getByRole("button", { name: "Expand sidebar" }),
    ).toBeTruthy();
  });
});
