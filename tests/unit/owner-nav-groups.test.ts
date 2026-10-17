import { describe, expect, it } from "vitest";
import { OWNER_NAV_GROUPS } from "@/application/owner-nav-config";
import { NAV_ICONS } from "@/components/game/NavGroups";

describe("owner sidebar groups", () => {
  it("labels only groups with more than one item", () => {
    const labelledSingles = OWNER_NAV_GROUPS.filter(
      (group) => group.label !== "" && group.items.length < 2,
    ).map((group) => group.id);
    expect(labelledSingles).toEqual([]);
  });

  it("keeps the sidebar to four persistent groups", () => {
    expect(OWNER_NAV_GROUPS.map((group) => group.id)).toEqual([
      "main",
      "team",
      "league",
      "franchise",
    ]);
  });

  it("gives every item an icon and Team and League different ones", () => {
    for (const item of OWNER_NAV_GROUPS.flatMap((group) => group.items)) {
      expect(NAV_ICONS[item.icon ?? ""], item.label).toBeDefined();
    }
    expect(NAV_ICONS.team).not.toEqual(NAV_ICONS.league);
  });
});
