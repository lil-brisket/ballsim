import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { HubPageSwitch } from "@/components/game/shell/HubPageSwitch";

afterEach(cleanup);

const CASES = [
  {
    pair: "roster",
    active: "injuries",
    other: "roster",
    labels: ["Roster", "Injuries"],
    hrefs: ["/dashboard/s1/roster", "/dashboard/s1/roster/injuries"],
  },
  {
    pair: "roster",
    active: "roster",
    other: "injuries",
    labels: ["Roster", "Injuries"],
    hrefs: ["/dashboard/s1/roster", "/dashboard/s1/roster/injuries"],
  },
  {
    pair: "development",
    active: "development-league",
    other: "development",
    labels: ["Development", "Dev League"],
    hrefs: ["/dashboard/s1/development", "/dashboard/s1/development-league"],
  },
  {
    pair: "stats",
    active: "team-stats",
    other: "player-stats",
    labels: ["Players", "Teams"],
    hrefs: [
      "/dashboard/s1/league/player-stats",
      "/dashboard/s1/league/team-stats",
    ],
  },
] as const;

describe("HubPageSwitch", () => {
  for (const c of CASES) {
    it(`${c.pair}: renders both links and marks ${c.active} current`, () => {
      render(<HubPageSwitch saveId="s1" pair={c.pair} active={c.active} />);
      const links = screen.getAllByRole("link");
      expect(links.map((l) => l.textContent)).toEqual([...c.labels]);
      expect(links.map((l) => l.getAttribute("href"))).toEqual([...c.hrefs]);
      const current = links.filter(
        (l) => l.getAttribute("aria-current") === "page",
      );
      expect(current).toHaveLength(1);
      const activeIndex = c.hrefs.findIndex((h) => h.endsWith(c.active));
      expect(links[activeIndex]).toBe(current[0]);
    });
  }
});
