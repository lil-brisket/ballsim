import { describe, expect, it } from "vitest";
import {
  activeOwnerNav,
  OWNER_NAV_GROUPS,
} from "@/application/owner-nav-config";
import { NAV_ICONS } from "@/components/game/shell/NavIcon";

function where(path: string): [string | undefined, string | undefined] {
  const active = activeOwnerNav(OWNER_NAV_GROUPS, path);
  return [active?.hub.id, active?.item?.label];
}

describe("owner hubs", () => {
  it("lists the persistent hubs in order", () => {
    expect(OWNER_NAV_GROUPS.map((group) => group.id)).toEqual([
      "home",
      "team",
      "league",
      "front-office",
      "media",
      "settings",
    ]);
  });

  it("gives every hub and tab an icon, Team and League different ones", () => {
    for (const hub of OWNER_NAV_GROUPS) {
      expect(NAV_ICONS[hub.icon], hub.label).toBeDefined();
      for (const item of hub.items) {
        expect(NAV_ICONS[item.icon ?? ""], item.label).toBeDefined();
      }
    }
    expect(NAV_ICONS.team).not.toEqual(NAV_ICONS.league);
  });

  it("puts each tab in exactly one hub", () => {
    const hrefs = OWNER_NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href));
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});

describe("activeOwnerNav", () => {
  it("matches tabs by the longest prefix", () => {
    expect(where("")).toEqual(["home", "Home"]);
    expect(where("/team")).toEqual(["team", "Overview"]);
    expect(where("/roster")).toEqual(["team", "Roster"]);
    expect(where("/roster/injuries")).toEqual(["team", "Roster"]);
    // Contracts lives under /team but belongs to Front Office.
    expect(where("/team/contracts")).toEqual(["front-office", "Contracts"]);
    expect(where("/finances/payroll")).toEqual(["front-office", "Finances"]);
    expect(where("/franchise/relocation")).toEqual([
      "front-office",
      "Franchise",
    ]);
    expect(where("/league/expansion")).toEqual(["league", "Overview"]);
  });

  it("maps merged and nested pages to their tab", () => {
    expect(where("/schedule")).toEqual(["home", "Schedule"]);
    expect(where("/season-events/fan-voting")).toEqual(["league", "Awards"]);
    expect(where("/history/legacy")).toEqual(["league", "History"]);
    expect(where("/staff-coaching/hiring-market")).toEqual([
      "front-office",
      "Staff",
    ]);
    expect(where("/staff/staff_1")).toEqual(["front-office", "Staff"]);
    expect(where("/sponsorships")).toEqual(["front-office", "Business"]);
  });

  it("folds switcher pages into their hub tab", () => {
    expect(where("/development")).toEqual(["team", "Development"]);
    expect(where("/development-league")).toEqual(["team", "Development"]);
    expect(where("/league/player-stats")).toEqual(["league", "Stats"]);
    expect(where("/league/team-stats")).toEqual(["league", "Stats"]);
  });

  it("keeps Team at 5 tabs and League at 6", () => {
    const labels = (id: string) =>
      OWNER_NAV_GROUPS.find((g) => g.id === id)!.items.map((i) => i.label);
    expect(labels("team")).toEqual([
      "Overview",
      "Roster",
      "Lineups",
      "Development",
      "History",
    ]);
    expect(labels("league")).toEqual([
      "Overview",
      "Standings",
      "Stats",
      "Transactions",
      "Awards",
      "History",
    ]);
  });

  it("maps tab-less pages to a hub without a tab", () => {
    expect(where("/players/p1")).toEqual(["team", undefined]);
    expect(where("/games/g1/watch")).toEqual(["home", undefined]);
    expect(where("/notifications")).toEqual(["home", undefined]);
  });

  it("does not match a prefix inside a longer path segment", () => {
    expect(where("/teams")).toEqual([undefined, undefined]);
    expect(where("/rosterx")).toEqual([undefined, undefined]);
  });
});
