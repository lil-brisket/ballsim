import { describe, expect, it } from "vitest";
import {
  formatLabScenarioList,
  LAB_SCENARIO_IDS,
  listLabScenarios,
  OWNER_CAREER_SCENARIO_ID,
  SCHEDULE_SCENARIO_ID,
} from "@/simulation/lab";

describe("listLabScenarios", () => {
  it("lists game scenarios plus career and schedule with versions", () => {
    const listings = listLabScenarios();
    const ids = listings.map((item) => item.id);
    expect(ids).toEqual([
      ...LAB_SCENARIO_IDS,
      OWNER_CAREER_SCENARIO_ID,
      SCHEDULE_SCENARIO_ID,
    ]);
    expect(listings.every((item) => item.version >= 1)).toBe(true);
    expect(listings.find((item) => item.id === "normal")?.kind).toBe("game");
    expect(
      listings.find((item) => item.id === OWNER_CAREER_SCENARIO_ID)?.kind,
    ).toBe("owner-career");
    expect(listings.find((item) => item.id === SCHEDULE_SCENARIO_ID)?.kind).toBe(
      "schedule",
    );
    const text = formatLabScenarioList(listings);
    expect(text).toContain("normal  v1  game");
    expect(text).toContain("owner-career  v1  owner-career");
    expect(text).toContain("schedule  v1  schedule");
  });
});
