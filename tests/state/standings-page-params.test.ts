import { describe, expect, it } from "vitest";
import {
  buildStandingsHref,
  parseStandingsPageParams,
} from "@/state/standings-page-params";

describe("parseStandingsPageParams", () => {
  it("falls back to overall and standard when missing", () => {
    expect(parseStandingsPageParams({}, { divisionsEnabled: true })).toEqual({
      view: "overall",
      stats: "standard",
    });
  });

  it("falls back when values are invalid", () => {
    expect(
      parseStandingsPageParams(
        { view: "planet", stats: "plus-minus" },
        { divisionsEnabled: true },
      ),
    ).toEqual({ view: "overall", stats: "standard" });
  });

  it("accepts valid view and stats", () => {
    expect(
      parseStandingsPageParams(
        { view: "conference", stats: "advanced" },
        { divisionsEnabled: true },
      ),
    ).toEqual({ view: "conference", stats: "advanced" });
  });

  it("uses the first value when search params are arrays", () => {
    expect(
      parseStandingsPageParams(
        { view: ["division", "overall"], stats: ["advanced"] },
        { divisionsEnabled: true },
      ),
    ).toEqual({ view: "division", stats: "advanced" });
  });

  it("treats division as overall when divisions are disabled", () => {
    expect(
      parseStandingsPageParams(
        { view: "division", stats: "advanced" },
        { divisionsEnabled: false },
      ),
    ).toEqual({ view: "overall", stats: "advanced" });
  });
});

describe("buildStandingsHref", () => {
  const pathname = "/dashboard/s1/standings";

  it("omits default view and stats", () => {
    expect(
      buildStandingsHref({
        pathname,
        currentSearch: "",
        view: "overall",
        stats: "standard",
      }),
    ).toBe(pathname);
  });

  it("preserves unrelated params and drops only error", () => {
    expect(
      buildStandingsHref({
        pathname,
        currentSearch: "stats=advanced&foo=bar&error=boom",
        view: "conference",
        stats: "advanced",
      }),
    ).toBe(`${pathname}?stats=advanced&foo=bar&view=conference`);
  });

  it("keeps the other control when changing one", () => {
    expect(
      buildStandingsHref({
        pathname,
        currentSearch: { view: "conference", stats: "advanced" },
        view: "division",
        stats: "advanced",
      }),
    ).toBe(`${pathname}?view=division&stats=advanced`);
  });
});
