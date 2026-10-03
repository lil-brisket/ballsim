import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/save_test",
}));

import { MobileNavigationDrawer } from "@/components/game/MobileNavigationDrawer";
import { DataTable } from "@/components/ui/DataTable";
import { tapTargetClass } from "@/components/ui/styles";

describe("mobile tap targets", () => {
  it("exposes a 44px tap-target token", () => {
    expect(tapTargetClass).toContain("min-h-11");
  });

  it("Menu control meets the 44px minimum height", () => {
    const { unmount } = render(<MobileNavigationDrawer saveId="save_test" />);
    expect(screen.getByRole("button", { name: "Menu" }).className).toContain(
      "min-h-11",
    );
    unmount();
  });

  it("pins the first box-score column while the rest can scroll", () => {
    const { unmount } = render(
      <DataTable headers={["Player", "PTS"]} stickyFirstColumn>
        <tr>
          <td>Harbor</td>
          <td>22</td>
        </tr>
      </DataTable>,
    );
    expect(screen.getByRole("table").className).toContain("table-sticky-first");
    unmount();
  });
});
