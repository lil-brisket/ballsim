import { describe, expect, it } from "vitest";
import {
  OWNER_NAV_GROUPS,
  flattenOwnerNavItems,
  ownerNavGroupsForState,
} from "@/application/owner-nav-config";
import {
  isOffseasonPeriod,
  isRelocationAccessible,
} from "@/state/owner-season-context";
import type { GameState } from "@/state/game-state";
import { createFourTeamInitialGameState } from "@/state/create-initial-state";

function baseState(
  overrides: Partial<{
    phase: GameState["competition"]["season"]["phase"];
  }> = {},
): GameState {
  const state = createFourTeamInitialGameState({
    saveId: "save_nav_test",
  });
  if (overrides.phase) {
    return {
      ...state,
      competition: {
        ...state.competition,
        season: {
          ...state.competition.season,
          phase: overrides.phase,
          offseasonStage:
            overrides.phase === "offseason"
              ? "free_agency"
              : state.competition.season.offseasonStage,
        },
      },
    };
  }
  return state;
}

describe("owner season context", () => {
  it("isOffseasonPeriod is true only for offseason phase", () => {
    expect(isOffseasonPeriod(baseState({ phase: "regular" }))).toBe(false);
    expect(isOffseasonPeriod(baseState({ phase: "postseason" }))).toBe(false);
    expect(isOffseasonPeriod(baseState({ phase: "offseason" }))).toBe(true);
  });

  it("isRelocationAccessible requires offseason", () => {
    expect(isRelocationAccessible(baseState({ phase: "regular" }))).toBe(
      false,
    );
    expect(isRelocationAccessible(baseState({ phase: "postseason" }))).toBe(
      false,
    );
    const offseason = baseState({ phase: "offseason" });
    expect(typeof isRelocationAccessible(offseason)).toBe("boolean");
    if (isRelocationAccessible(offseason)) {
      expect(isOffseasonPeriod(offseason)).toBe(true);
    }
  });
});

describe("owner nav config invariants", () => {
  it("exposes canonical destinations without legacy TM / relocation / staff", () => {
    const hrefs = flattenOwnerNavItems().map((item) => item.href);
    expect(hrefs).toContain("");
    expect(hrefs).toContain("/calendar");
    expect(hrefs).toContain("/roster");
    expect(hrefs).toContain("/staff-coaching");
    expect(hrefs).toContain("/development");
    expect(hrefs).toContain("/media");
    expect(hrefs).toContain("/franchise");
    expect(hrefs).toContain("/finances");
    expect(hrefs).toContain("/transactions");
    expect(hrefs).not.toContain("/team-management");
    expect(hrefs).not.toContain("/relocation");
    expect(hrefs).not.toContain("/staff");
    expect(hrefs).not.toContain("/business");
    expect(hrefs).not.toContain("/facilities");
    expect(hrefs).not.toContain("/draft");
    expect(hrefs).not.toContain("/scouting");
    expect(hrefs).not.toContain("/free-agency");
  });

  it("league group has five evergreen items including Awards", () => {
    const league = OWNER_NAV_GROUPS.find((g) => g.id === "league");
    expect(league?.items).toHaveLength(5);
    expect(league?.items.some((i) => i.href === "/transactions")).toBe(true);
    expect(league?.items.some((i) => i.href === "/awards")).toBe(true);
    expect(league?.items.some((i) => i.href === "/draft")).toBe(false);
  });

  it("injects Offseason group with Draft/Scouting/FA only during offseason", () => {
    const regular = ownerNavGroupsForState(baseState({ phase: "regular" }));
    expect(regular.some((g) => g.id === "offseason")).toBe(false);
    const regularHrefs = regular.flatMap((g) => g.items.map((i) => i.href));
    expect(regularHrefs).not.toContain("/draft");
    expect(regularHrefs).not.toContain("/scouting");
    expect(regularHrefs).not.toContain("/free-agency");

    const offseason = ownerNavGroupsForState(baseState({ phase: "offseason" }));
    expect(offseason.some((g) => g.id === "offseason")).toBe(true);
    const offGroup = offseason.find((g) => g.id === "offseason");
    expect(offGroup?.items.map((i) => i.href)).toEqual([
      "/offseason",
      "/draft",
      "/scouting",
      "/free-agency",
    ]);
  });

  it("injects Playoffs into League nav during playoffs and postseason", () => {
    for (const phase of ["playoffs", "postseason"] as const) {
      const groups = ownerNavGroupsForState(baseState({ phase }));
      const league = groups.find((g) => g.id === "league");
      expect(league?.items.some((i) => i.href === "/playoffs")).toBe(true);
    }
    const regular = ownerNavGroupsForState(baseState({ phase: "regular" }));
    const league = regular.find((g) => g.id === "league");
    expect(league?.items.some((i) => i.href === "/playoffs")).toBe(false);
  });

  it("never includes relocation in computed nav groups", () => {
    for (const phase of ["regular", "postseason", "offseason"] as const) {
      const groups = ownerNavGroupsForState(baseState({ phase }));
      const hrefs = groups.flatMap((g) => g.items.map((i) => i.href));
      expect(hrefs).not.toContain("/relocation");
    }
  });

  it("places Offseason after Simulation", () => {
    const groups = ownerNavGroupsForState(baseState({ phase: "offseason" }));
    const ids = groups.map((g) => g.id);
    expect(ids.indexOf("simulation")).toBeLessThan(ids.indexOf("offseason"));
    expect(ids.indexOf("offseason")).toBeLessThan(ids.indexOf("team"));
  });
});
