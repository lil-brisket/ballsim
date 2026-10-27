import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/save_test",
}));

import { HubBar } from "@/components/game/shell/HubBar";
import { SubTabBar } from "@/components/game/shell/SubTabBar";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ConfirmDialog } from "@/components/owner/ConfirmDialog";
import { OWNER_NAV_GROUPS } from "@/application/owner-nav-config";

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

  it("renders hub links with the saveId and marks the active hub", () => {
    const { unmount } = render(
      <HubBar saveId="save_test" groups={OWNER_NAV_GROUPS} />,
    );
    const hubs = screen.getByRole("navigation", { name: "Hubs" });
    const link = (name: string) =>
      hubs.querySelector(`a[href="${name}"]`) as HTMLAnchorElement | null;
    expect(link("/dashboard/save_test")?.textContent).toContain("Home");
    expect(link("/dashboard/save_test")?.getAttribute("aria-current")).toBe(
      "true",
    );
    expect(link("/dashboard/save_test/team")?.textContent).toContain("Team");
    expect(link("/dashboard/save_test/finances")?.textContent).toContain(
      "Front Office",
    );
    expect(link("/dashboard/save_test/media")?.textContent).toContain("Media");
    expect(
      screen.getByRole("link", { name: "Settings" }).getAttribute("href"),
    ).toBe("/dashboard/save_test/settings");
    expect(screen.queryByText("Team Management")).toBeNull();
    expect(screen.queryByText("Relocation")).toBeNull();
    unmount();
  });

  it("renders the active hub's sub-tabs", () => {
    const { unmount } = render(
      <SubTabBar saveId="save_test" groups={OWNER_NAV_GROUPS} />,
    );
    const tabs = screen.getByRole("navigation", { name: "Home sections" });
    expect(tabs.querySelector("[aria-current=page]")?.textContent).toBe("Home");
    expect(
      screen.getByRole("link", { name: "Schedule" }).getAttribute("href"),
    ).toBe("/dashboard/save_test/calendar");
    unmount();
  });

  it("static nav config matches canonical destinations", () => {
    const hrefs = OWNER_NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href));
    expect(hrefs).toContain("/franchise");
    expect(hrefs).toContain("/development");
    expect(hrefs).toContain("/team/contracts");
    expect(hrefs).not.toContain("/relocation");
    expect(hrefs).not.toContain("/contracts");
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
    expect(screen.getByRole("button", { name: "Confirm trade" })).toBeTruthy();
    unmount();
  });

  it("delete save confirm exposes submit and cancel closes without submit", () => {
    const onSubmit = vi.fn((event: Event) => {
      event.preventDefault();
    });
    const { unmount } = render(
      <ConfirmDialog
        title="Delete save?"
        description="Delete “Harbor Franchise”? This cannot be undone."
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
    expect(screen.getByRole("button", { name: "Confirm delete" })).toBeTruthy();

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
    const confirmButton = screen.getByRole("button", {
      name: "Confirm delete",
    });
    const form = confirmButton.closest("form");
    expect(form).not.toBeNull();

    fireEvent.click(confirmButton);
    expect(form!.isConnected).toBe(true);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    unmount();
  });
});
