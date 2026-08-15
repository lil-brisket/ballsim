import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/save_test",
}));

import { OwnerNav } from "@/components/owner/OwnerNav";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { StatusBadge } from "@/components/owner/StatusBadge";
import { ConfirmDialog } from "@/components/owner/ConfirmDialog";

describe("Owner UI primitives", () => {
  it("formats money display", () => {
    const { unmount } = render(<MoneyDisplay amount={12_500_000} />);
    expect(screen.getByText("$12.5M")).toBeTruthy();
    unmount();
  });

  it("renders status badge", () => {
    const { unmount } = render(<StatusBadge label="active" />);
    expect(screen.getByText("active")).toBeTruthy();
    unmount();
  });

  it("renders owner nav links with saveId", () => {
    const { unmount } = render(<OwnerNav saveId="save_test" unreadCount={2} />);
    expect(
      screen.getByText("Dashboard").closest("a")?.getAttribute("href"),
    ).toBe("/dashboard/save_test");
    expect(screen.getByText("Roster").closest("a")?.getAttribute("href")).toBe(
      "/dashboard/save_test/roster",
    );
    expect(
      screen.getByText("Notifications (2)").closest("a")?.getAttribute("href"),
    ).toBe("/dashboard/save_test/notifications");
    unmount();
  });

  it("confirm dialog opens and exposes form children without mutating", () => {
    render(
      <ConfirmDialog
        title="Trade?"
        description="Confirm trade"
        confirmLabel="Trade"
      >
        <form>
          <button type="submit">Confirm trade</button>
        </form>
      </ConfirmDialog>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Trade" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Confirm trade" }),
    ).toBeTruthy();
  });
});
