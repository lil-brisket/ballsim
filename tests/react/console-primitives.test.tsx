import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DataTable, numericCellClass } from "@/components/ui/DataTable";
import { HubTile } from "@/components/ui/HubTile";
import { KeyHint } from "@/components/ui/KeyHint";
import { OvrBadge } from "@/components/ui/OvrBadge";
import { Tabs } from "@/components/ui/Tabs";
import { ratingTier } from "@/presentation/rating-tier";

afterEach(cleanup);

describe("HubTile", () => {
  it("renders a link with the href and the title as its name", () => {
    render(
      <HubTile
        href="/roster"
        title="Roster"
        stat={{ value: 14, label: "Players" }}
      />,
    );
    const link = screen.getByRole("link", { name: /Roster/ });
    expect(link.getAttribute("href")).toBe("/roster");
    expect(link.getAttribute("data-shape")).toBe("corner");
    expect(link.className).toContain("console-focus");
  });

  it("renders a button that calls onSelect", () => {
    const onSelect = vi.fn();
    render(<HubTile title="Scouting" onSelect={onSelect} />);
    const button = screen.getByRole("button", { name: /Scouting/ });
    expect(button.getAttribute("type")).toBe("button");
    expect(button.getAttribute("data-shape")).toBe("corner");
    fireEvent.click(button);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});

describe("OvrBadge", () => {
  it("exposes an image role with the rating and the tier", () => {
    render(<OvrBadge overall={77} />);
    const badge = screen.getByRole("img", { name: "Overall 77" });
    expect(badge.getAttribute("data-tier")).toBe(ratingTier(77).id);
  });

  it("maps 91 to the elite tier", () => {
    render(<OvrBadge overall={91} size="lg" />);
    expect(
      screen.getByRole("img", { name: "Overall 91" }).getAttribute("data-tier"),
    ).toBe("elite");
  });

  it("names a ghost badge as potential", () => {
    render(<OvrBadge overall={82} ghost />);
    expect(screen.getByRole("img", { name: "Potential 82" })).toBeTruthy();
  });
});

describe("KeyHint", () => {
  it("renders one kbd per key", () => {
    const { container } = render(
      <KeyHint keys={["Ctrl", "K"]} label="Search" />,
    );
    const caps = container.querySelectorAll("kbd");
    expect(caps).toHaveLength(2);
    expect(caps[0]!.textContent).toBe("Ctrl");
    expect(screen.getByText("Search")).toBeTruthy();
  });
});

describe("Tabs slant variant", () => {
  const items = [
    { key: "a", label: "Overview", href: "/a" },
    { key: "b", label: "Stats", href: "/b" },
  ];

  it("marks the active link and uses the slant class", () => {
    render(<Tabs aria-label="t" activeKey="a" items={items} variant="slant" />);
    const active = screen.getByRole("link", { name: "Overview" });
    expect(active.getAttribute("aria-current")).toBe("page");
    expect(active.className).toContain("slant");
  });

  it("keeps the default underline output without the slant class", () => {
    render(<Tabs aria-label="t" activeKey="a" items={items} />);
    const active = screen.getByRole("link", { name: "Overview" });
    expect(active.getAttribute("aria-current")).toBe("page");
    expect(active.className).not.toContain("slant");
    expect(active.className).toContain("after:bg-team-ink");
  });
});

describe("DataTable", () => {
  it("still renders string headers", () => {
    render(
      <DataTable headers={["Player", "PTS"]}>
        <tr>
          <td>Leo Drake</td>
          <td>28.4</td>
        </tr>
      </DataTable>,
    );
    expect(screen.getByRole("columnheader", { name: "Player" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "PTS" })).toBeTruthy();
  });

  it("right-aligns numeric headers and marks sortable ones", () => {
    render(
      <DataTable
        headers={[
          "Player",
          {
            label: "PTS",
            numeric: true,
            sort: { href: "/players?sort=pts", direction: "desc" },
          },
        ]}
      >
        <tr>
          <td>Leo Drake</td>
          <td className={numericCellClass}>28.4</td>
        </tr>
      </DataTable>,
    );
    const header = screen.getByRole("columnheader", { name: /PTS/ });
    expect(header.className).toContain("text-right");
    expect(header.getAttribute("aria-sort")).toBe("descending");
    const link = screen.getByRole("link", { name: /PTS/ });
    expect(link.getAttribute("href")).toBe("/players?sort=pts");
  });

  it("reports aria-sort none for an inactive sortable header", () => {
    render(
      <DataTable headers={[{ label: "Age", sort: { onSelect: () => {} } }]}>
        <tr>
          <td>24</td>
        </tr>
      </DataTable>,
    );
    expect(
      screen
        .getByRole("columnheader", { name: /Age/ })
        .getAttribute("aria-sort"),
    ).toBe("none");
  });
});
