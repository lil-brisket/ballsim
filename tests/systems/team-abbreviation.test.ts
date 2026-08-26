import { describe, expect, it } from "vitest";
import { uniqueTeamAbbreviation } from "@/systems/team-abbreviation";

describe("uniqueTeamAbbreviation", () => {
  it("derives a 3-letter base from the city", () => {
    expect(uniqueTeamAbbreviation("Los Angeles", new Set())).toBe("LOS");
    expect(uniqueTeamAbbreviation("Toronto", new Set())).toBe("TOR");
  });

  it("pads short letter sequences", () => {
    expect(uniqueTeamAbbreviation("LA", new Set())).toBe("LAX");
  });

  it("uses numeric suffixes on collision", () => {
    const used = new Set(["LOS"]);
    expect(uniqueTeamAbbreviation("Los Angeles", used)).toBe("LO0");
  });

  it("uses letter suffixes after numeric namespace", () => {
    const used = new Set([
      "LOS",
      "LO0",
      "LO1",
      "LO2",
      "LO3",
      "LO4",
      "LO5",
      "LO6",
      "LO7",
      "LO8",
      "LO9",
    ]);
    expect(uniqueTeamAbbreviation("Los Angeles", used)).toBe("LOA");
  });

  it("fails deterministically when namespace is exhausted", () => {
    const used = new Set<string>(["LOS"]);
    for (let suffix = 0; suffix < 10; suffix += 1) {
      used.add(`LO${suffix}`);
    }
    for (let code = 65; code <= 90; code += 1) {
      used.add(`LO${String.fromCharCode(code)}`);
    }
    expect(() => uniqueTeamAbbreviation("Los Angeles", used)).toThrow(
      /unique abbreviation/,
    );
  });
});
