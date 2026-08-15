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
    const { unmount } = render(
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
    unmount();
  });

  it("delete save confirm exposes submit and cancel closes without submit", () => {
    const onSubmit = vi.fn((event: Event) => {
      event.preventDefault();
    });
    const { unmount } = render(
      <ConfirmDialog
        title="Delete save?"
        description='Delete “Harbor Franchise”? This cannot be undone.'
        confirmLabel="Delete"
      >
        <form
          onSubmit={(event) => {
            onSubmit(event.nativeEvent);
          }}
        >
          <input type="hidden" name="saveId" value="save_test" />
          <button type="submit">Confirm delete</button>
        </form>
      </ConfirmDialog>,
    );

    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Confirm delete" }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onSubmit).not.toHaveBeenCalled();
    unmount();
  });

  it("confirm submit keeps the form mounted so the action can run", () => {
    const onSubmit = vi.fn((event: Event) => {
      event.preventDefault();
    });
    const { unmount } = render(
      <ConfirmDialog
        title="Delete save?"
        description="Delete this save?"
        confirmLabel="Delete"
      >
        <form
          onSubmit={(event) => {
            onSubmit(event.nativeEvent);
          }}
        >
          <input type="hidden" name="saveId" value="save_test" />
          <button type="submit">Confirm delete</button>
        </form>
      </ConfirmDialog>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    const confirmButton = screen.getByRole("button", { name: "Confirm delete" });
    const form = confirmButton.closest("form");
    expect(form).not.toBeNull();

    fireEvent.click(confirmButton);
    expect(form!.isConnected).toBe(true);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    unmount();
  });
});
