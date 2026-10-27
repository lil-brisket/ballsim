import { describe, expect, it } from "vitest";
import {
  activeOwnerNav,
  OWNER_NAV_GROUPS,
  type OwnerNavGroup,
} from "@/application/owner-nav-config";
import { hubForKey } from "@/components/game/shell/hub-keys";
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
    expect(where("/roster/injuries")).toEqual(["team", "Injuries"]);
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

describe("hubForKey", () => {
  const groups: readonly OwnerNavGroup[] = OWNER_NAV_GROUPS;

  it("steps with Q and E and wraps", () => {
    expect(hubForKey("e", groups, "home")?.id).toBe("team");
    expect(hubForKey("E", groups, "team")?.id).toBe("league");
    expect(hubForKey("q", groups, "home")?.id).toBe("media");
    expect(hubForKey("e", groups, "media")?.id).toBe("home");
  });

  it("jumps with number keys and never numbers Settings", () => {
    expect(hubForKey("1", groups, "media")?.id).toBe("home");
    expect(hubForKey("4", groups, "home")?.id).toBe("front-office");
    expect(hubForKey("6", groups, "home")).toBeUndefined();
  });

  it("enters the hub row from Settings", () => {
    expect(hubForKey("e", groups, "settings")?.id).toBe("home");
    expect(hubForKey("q", groups, "settings")?.id).toBe("media");
  });

  it("ignores other keys", () => {
    expect(hubForKey("x", groups, "home")).toBeUndefined();
    expect(hubForKey(" ", groups, "home")).toBeUndefined();
  });
});
