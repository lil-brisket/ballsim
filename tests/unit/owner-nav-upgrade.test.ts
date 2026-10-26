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
    expect(isRelocationAccessible(baseState({ phase: "regular" }))).toBe(false);
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

describe("owner hub config invariants", () => {
  it("exposes canonical destinations, never legacy redirect routes", () => {
    const hrefs = flattenOwnerNavItems().map((item) => item.href);
    for (const href of [
      "",
      "/calendar",
      "/roster",
      "/team/contracts",
      "/trades",
      "/staff-coaching/staff",
      "/development",
      "/media",
      "/franchise",
      "/finances",
      "/business",
    ]) {
      expect(hrefs).toContain(href);
    }
    for (const legacy of [
      "/team-management",
      "/team-management/transactions",
      "/relocation",
      "/staff",
      "/staff-coaching",
      "/contracts",
      "/facilities",
      "/standings",
      "/transactions",
      "/schedule",
      "/teams",
    ]) {
      expect(hrefs).not.toContain(legacy);
    }
  });

  it("contains no My Teams nav item or /teams route", () => {
    const items = flattenOwnerNavItems();
    expect(items.some((item) => item.href === "/teams")).toBe(false);
    expect(items.some((item) => item.label === "My Teams")).toBe(false);
  });

  it("merges Schedule into the calendar tab and Fan Voting into Awards", () => {
    const items = flattenOwnerNavItems();
    const schedule = items.find((item) => item.label === "Schedule");
    expect(schedule?.href).toBe("/calendar");
    expect(schedule?.also).toContain("/schedule");
    const awards = items.find((item) => item.href === "/awards");
    expect(awards?.also).toContain("/season-events/fan-voting");
    expect(items.some((item) => item.label === "Fan Voting")).toBe(false);
  });

  it("league hub has its evergreen tabs", () => {
    const league = OWNER_NAV_GROUPS.find((g) => g.id === "league");
    expect(league?.items.map((i) => i.href)).toEqual([
      "/league",
      "/league/standings",
      "/league/player-stats",
      "/league/team-stats",
      "/league/transactions",
      "/awards",
      "/history",
    ]);
  });

  it("settings hub has League, Rules, AI Management and Tools", () => {
    const settings = OWNER_NAV_GROUPS.find((g) => g.id === "settings");
    expect(settings?.items.map((i) => [i.label, i.href])).toEqual([
      ["League", "/settings"],
      ["Rules", "/settings/rules"],
      ["AI Management", "/settings/ai"],
      ["Tools", "/settings/tools"],
    ]);
  });

  it("injects the Offseason hub with Draft/Scouting/FA only during offseason", () => {
    const regular = ownerNavGroupsForState(baseState({ phase: "regular" }));
    expect(regular.some((g) => g.id === "offseason")).toBe(false);
    const regularHrefs = regular.flatMap((g) => g.items.map((i) => i.href));
    expect(regularHrefs).not.toContain("/draft");
    expect(regularHrefs).not.toContain("/scouting");
    // In season, free agents are signed from Front Office.
    const office = regular.find((g) => g.id === "front-office");
    expect(office?.items.map((i) => i.href)).toContain("/free-agency");

    const offseason = ownerNavGroupsForState(baseState({ phase: "offseason" }));
    const offHub = offseason.find((g) => g.id === "offseason");
    expect(offHub?.items.map((i) => i.href)).toEqual([
      "/offseason",
      "/draft",
      "/scouting",
      "/free-agency",
    ]);
    // Free Agency lives in one hub at a time.
    const officeOff = offseason.find((g) => g.id === "front-office");
    expect(officeOff?.items.map((i) => i.href)).not.toContain("/free-agency");
  });

  it("injects Playoffs into League during playoffs and postseason", () => {
    for (const phase of ["playoffs", "postseason"] as const) {
      const groups = ownerNavGroupsForState(baseState({ phase }));
      const league = groups.find((g) => g.id === "league");
      expect(league?.items.some((i) => i.href === "/playoffs")).toBe(true);
    }
    const regular = ownerNavGroupsForState(baseState({ phase: "regular" }));
    const league = regular.find((g) => g.id === "league");
    expect(league?.items.some((i) => i.href === "/playoffs")).toBe(false);
  });

  it("never includes relocation as a tab", () => {
    for (const phase of ["regular", "postseason", "offseason"] as const) {
      const groups = ownerNavGroupsForState(baseState({ phase }));
      const hrefs = groups.flatMap((g) => g.items.map((i) => i.href));
      expect(hrefs).not.toContain("/relocation");
      expect(hrefs).not.toContain("/franchise/relocation");
    }
  });

  it("orders hubs Home, Team, League, Front Office, Media, Offseason, Settings", () => {
    const groups = ownerNavGroupsForState(baseState({ phase: "offseason" }));
    expect(groups.map((g) => g.id)).toEqual([
      "home",
      "team",
      "league",
      "front-office",
      "media",
      "offseason",
      "settings",
    ]);
  });
});

describe("shared league nav items", () => {
  function hrefsFor(mode: "single" | "local_shared" | "online"): string[] {
    const base = baseState();
    const state: GameState = {
      ...base,
      user: {
        ...base.user,
        participation:
          mode === "single"
            ? { mode: "single" }
            : {
                mode,
                participants: [],
                activeParticipantId: "p1",
                readyParticipantIds: [],
                assignmentsConfirmed: true,
              },
      },
    };
    return ownerNavGroupsForState(state).flatMap((g) =>
      g.items.map((i) => i.href),
    );
  }

  it("single-player leagues show neither item", () => {
    const hrefs = hrefsFor("single");
    expect(hrefs).not.toContain("/trades/propose");
    expect(hrefs).not.toContain("/league-members");
  });

  it("local shared shows Propose Trade only", () => {
    const hrefs = hrefsFor("local_shared");
    expect(hrefs).toContain("/trades/propose");
    expect(hrefs).not.toContain("/league-members");
  });

  it("online shows Propose Trade and League Members", () => {
    const hrefs = hrefsFor("online");
    expect(hrefs).toContain("/trades/propose");
    expect(hrefs).toContain("/league-members");
  });
});
