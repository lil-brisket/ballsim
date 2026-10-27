import { describe, expect, it } from "vitest";
import { OWNER_NAV_GROUPS } from "@/application/owner-nav-config";
import {
  hubDirection,
  hubTransitionTypes,
} from "@/components/game/shell/transition-direction";

const groups = OWNER_NAV_GROUPS;
// Offseason sits between Media and Settings.
const withOffseason = [
  ...groups.filter((group) => group.id !== "settings"),
  { ...groups[0], id: "offseason" as const },
  groups[groups.length - 1],
];

describe("hubDirection", () => {
  it("moves forward to a later hub and back to an earlier one", () => {
    expect(hubDirection(groups, "home", "team")).toBe("forward");
    expect(hubDirection(groups, "league", "front-office")).toBe("forward");
    expect(hubDirection(groups, "media", "team")).toBe("back");
    expect(hubDirection(groups, "team", "home")).toBe("back");
  });

  it("is null within one hub", () => {
    expect(hubDirection(groups, "team", "team")).toBeNull();
  });

  it("counts Settings as after the last hub", () => {
    expect(hubDirection(groups, "media", "settings")).toBe("forward");
    expect(hubDirection(groups, "settings", "home")).toBe("back");
    expect(hubDirection(withOffseason, "offseason", "settings")).toBe(
      "forward",
    );
    expect(hubDirection(withOffseason, "settings", "offseason")).toBe("back");
  });

  it("orders the Offseason hub after Media when present", () => {
    expect(hubDirection(withOffseason, "media", "offseason")).toBe("forward");
  });

  it("is null for unknown or missing hubs", () => {
    expect(hubDirection(groups, undefined, "team")).toBeNull();
    expect(hubDirection(groups, "team", undefined)).toBeNull();
    expect(hubDirection(groups, "offseason", "team")).toBeNull();
    expect(hubDirection(groups, "team", "offseason")).toBeNull();
  });
});

describe("hubTransitionTypes", () => {
  it("names the slide, or nothing for a crossfade", () => {
    expect(hubTransitionTypes(groups, "home", "team")).toEqual(["hub-forward"]);
    expect(hubTransitionTypes(groups, "team", "home")).toEqual(["hub-back"]);
    expect(hubTransitionTypes(groups, "team", "team")).toEqual([]);
    expect(hubTransitionTypes(groups, undefined, "team")).toEqual([]);
  });
});
